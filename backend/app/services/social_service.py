"""Social service: posts, feed, interactions, follows, moderation (LLD §2)."""

from datetime import timedelta
from pathlib import Path
import re
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnprocessableError,
)
from app.models.identity import User
from app.models.social import (
    BookmarkCollection,
    BookmarkCollectionPost,
    CommentLike,
    Post,
    PostBookmark,
    PostComment,
    PostHashtag,
    PostLike,
    PostMedia,
    PostMention,
    PostRepost,
    UserFollow,
)
from app.repositories.identity_repository import UserRepository
from app.repositories.social_repository import (
    BookmarkCollectionRepository,
    BookmarkRepository,
    HashtagRepository,
    PostCommentRepository,
    PostRepository,
    UserFollowRepository,
)
from app.schemas.social import (
    CollectionCreateRequest,
    CommentCreateRequest,
    CommentUpdateRequest,
    ModerationRequest,
    PostCreateRequest,
    PostUpdateRequest,
    RepostRequest,
    RelationshipPersonResponse,
    UserRelationshipResponse,
)
from app.services.base import BaseService
from app.services.permissions import require_platform_role, user_has_platform_role
from app.services.storage_service import StorageService
from app.utils import utcnow
from app.utils.ids import new_public_post_id

HASHTAG_RE = re.compile(r"#(\w+)")
MENTION_RE = re.compile(r"@(\w+)")
COMMENT_EDIT_WINDOW = timedelta(minutes=30)


class SocialService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.posts = PostRepository(db)
        self.follows = UserFollowRepository(db)
        self.hashtags = HashtagRepository(db)
        self.comments = PostCommentRepository(db)
        self.bookmarks = BookmarkRepository(db)
        self.collections = BookmarkCollectionRepository(db)
        self.users = UserRepository(db)
        self.storage = StorageService()

    # ----------------------------------------------------------------- posts
    def create_post(self, author: Optional[User], data: PostCreateRequest) -> dict:
        """Create a post with media/hashtags/mentions in ONE transaction.

        Guests (no account) post anonymously with public visibility.
        """
        is_guest = author is None
        post_type = (
            "reply" if data.reply_to_post_id
            else "quote" if data.quote_post_id
            else "post"
        )
        post = Post(
            author_user_id=None if is_guest else author.id,
            public_post_id=new_public_post_id(),
            is_anonymous=True if is_guest else data.is_anonymous,
            body=data.body,
            post_type=post_type,
            visibility="public" if is_guest else data.visibility,
            reply_to_post_id=data.reply_to_post_id,
            quote_post_id=data.quote_post_id,
            is_sensitive=data.is_sensitive,
        )
        self.posts.add(post)
        self.db.flush()

        for media in data.media:
            self.db.add(
                PostMedia(
                    post_id=post.id,
                    uploaded_by_user_id=None if is_guest else author.id,
                    **media.model_dump(),
                )
            )
        for tag in {t.lower() for t in HASHTAG_RE.findall(data.body)}:
            hashtag = self.hashtags.get_or_create(tag)
            self.db.add(PostHashtag(post_id=post.id, hashtag_id=hashtag.id))
        for handle in set(MENTION_RE.findall(data.body)):
            mentioned = self.users.get_by_handle(handle)
            if mentioned is not None:
                self.db.add(
                    PostMention(post_id=post.id, mentioned_user_id=mentioned.id)
                )
                self.notify(mentioned.id, "You were mentioned in a post",
                            template_key="mention", post_id=post.id)

        self.audit("created", "post", post.id,
                   actor_user_id=None if is_guest else author.id,
                   new={"public_post_id": post.public_post_id})
        self.db.commit()
        self.db.refresh(post)

        media_rows = list(
            self.db.scalars(
                select(PostMedia)
                .where(PostMedia.post_id == post.id)
                .order_by(PostMedia.sort_order, PostMedia.id)
            )
        )
        return {
            **post.__dict__,
            "media": media_rows,
            "like_count": 0,
            "comment_count": 0,
            "is_liked": False,
            "author_handle": None if is_guest or post.is_anonymous else author.user_handle,
            "author_full_name": None if is_guest or post.is_anonymous else author.full_name,
            "author_avatar_storage_key": (
                None if is_guest or post.is_anonymous else author.avatar_storage_key
            ),
        }

    def upload_post_media(
        self,
        author: Optional[User],
        post_id: int,
        file_name: str,
        content_type: Optional[str],
        content: bytes,
        alt_text: Optional[str] = None,
    ) -> PostMedia:
        """Upload media for an existing post.

        - If post is anonymous: saved under 'uploads/feed/anonymous/{post_id}/{category}'
        - If post is authenticated: saved under 'uploads/profile/{author_id}/{category}'
          where category is 'pdf' for documents, 'photo' for images, 'video' for videos.
        """
        post = self.posts.get_or_404(post_id)
        is_guest = author is None

        ext = Path(file_name).suffix.lower()
        mime = (content_type or "").lower()

        if ext == ".pdf" or mime == "application/pdf":
            category = "pdf"
            media_type = "document"
        elif mime.startswith("image/") or ext in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}:
            category = "photo"
            media_type = "image"
        elif mime.startswith("video/") or ext in {".mp4", ".webm", ".mov", ".avi", ".mkv"}:
            category = "video"
            media_type = "video"
        else:
            category = "pdf"
            media_type = "document"

        # Anonymous posts store feed uploads under uploads/feed/anonymous/{post_id}/{category}
        if post.is_anonymous or post.author_user_id is None:
            directory = f"uploads/feed/anonymous/{post.id}/{category}"
            uploader_id = None
        else:
            # Authenticated post uploads store under uploads/profile/{author_id}/{category}
            if not is_guest and author.id != post.author_user_id and not user_has_platform_role(self.db, author.id, "moderation_admin"):
                raise ForbiddenError("You can only upload media to your own posts")
            directory = f"uploads/profile/{post.author_user_id}/{category}"
            uploader_id = post.author_user_id

        key = self.storage.save(directory=directory, extension=ext, content=content)

        count = self.db.scalar(
            select(func.count()).select_from(PostMedia).where(PostMedia.post_id == post.id)
        ) or 0

        media = PostMedia(
            post_id=post.id,
            uploaded_by_user_id=uploader_id,
            file_name=file_name,
            storage_key=key,
            mime_type=content_type,
            file_size_bytes=len(content),
            alt_text=alt_text,
            media_type=media_type,
            sort_order=count,
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media

    def lookup_public(self, public_post_id: str) -> dict:
        """Anonymous lookup by public_post_id — public posts only (LLD §2.2)."""
        post = self.posts.get_by_public_id(public_post_id)
        if (
            post is None
            or post.moderation_status != "visible"
            or post.visibility != "public"
        ):
            raise NotFoundError("Post not found")
        media_rows = list(
            self.db.scalars(
                select(PostMedia)
                .where(PostMedia.post_id == post.id)
                .order_by(PostMedia.sort_order, PostMedia.id)
            )
        )
        return {
            **post.__dict__,
            "media": media_rows,
        }

    def feed(
        self, viewer: Optional[User], limit: int, offset: int
    ) -> list[dict]:
        viewer_id = None if viewer is None else viewer.id
        posts = self.posts.list_feed(viewer_id, limit, offset)
        return self._decorate_posts(posts, viewer_id)

    def profile_posts(
        self, viewer: Optional[User], handle: str, limit: int, offset: int
    ) -> list[dict]:
        """A user's own named posts plus the posts they reposted."""
        profile = self.users.get_by_handle(handle)
        if profile is None or not profile.is_active:
            raise NotFoundError("User not found")
        viewer_id = None if viewer is None else viewer.id
        activity = self.posts.list_profile_activity(
            profile.id, viewer_id, limit, offset
        )
        by_id = self.posts.get_many([post_id for post_id, _, _ in activity])
        decorated = self._decorate_posts(
            [by_id[post_id] for post_id, _, _ in activity], viewer_id
        )
        return [
            {
                **item,
                "activity_at": activity_at,
                "reposted_by_handle": profile.user_handle if is_repost else None,
                "reposted_by_full_name": profile.full_name if is_repost else None,
            }
            for item, (_, activity_at, is_repost) in zip(decorated, activity)
        ]

    def _decorate_posts(
        self, posts: list[Post], viewer_id: Optional[int]
    ) -> list[dict]:
        post_ids = list({post.id for post in posts})
        engagement = self.posts.engagement_for_posts(post_ids, viewer_id)
        media_map = self.posts.media_for_posts(post_ids)
        authors = self.posts.authors_for_posts(post_ids)
        views = []
        for post in posts:
            author = authors.get(post.id)
            views.append(
                {
                    **post.__dict__,
                    **engagement[post.id],
                    "media": media_map.get(post.id, []),
                    "author_handle": author.user_handle if author else None,
                    "author_full_name": author.full_name if author else None,
                    "author_avatar_storage_key": (
                        author.avatar_storage_key if author else None
                    ),
                }
            )
        return views

    def trending_hashtags(self, days: int, limit: int) -> list[dict]:
        since = utcnow() - timedelta(days=days)
        return [
            {"tag": tag, "post_count": count}
            for tag, count in self.hashtags.trending(since, limit)
        ]

    def comments_for_post(
        self, viewer: Optional[User], post_id: int, limit: int, offset: int
    ) -> list[dict[str, object]]:
        viewer_id = None if viewer is None else viewer.id
        post = self.posts.get_viewable(post_id, viewer_id)
        if post is None:
            raise NotFoundError("Post not found")
        return [
            self._comment_view(
                row,
                viewer_id,
                can_delete=viewer_id is not None
                and (row["user_id"] == viewer_id or post.author_user_id == viewer_id),
            )
            for row in self.comments.list_for_post(post.id, limit, offset, viewer_id)
        ]

    @staticmethod
    def _comment_view(
        comment: dict, viewer_id: Optional[int], can_delete: bool = False
    ) -> dict:
        within_window = utcnow() - comment["created_at"] <= COMMENT_EDIT_WINDOW
        return {
            **comment,
            "can_edit": viewer_id is not None
            and comment["user_id"] == viewer_id
            and within_window,
            "can_delete": can_delete
            or (viewer_id is not None and comment["user_id"] == viewer_id),
        }

    def edit_post(
        self, user: User, post_id: int, data: PostUpdateRequest
    ) -> dict:
        post = self.posts.get_or_404(post_id)
        if post.deleted_at is not None:
            raise NotFoundError("Post not found")
        if post.author_user_id != user.id:
            raise ForbiddenError("You can only edit your own posts")
        body = data.body.strip()
        if not body:
            raise UnprocessableError("Post cannot be empty")
        if body != post.body:
            old_mentions = set(
                self.db.scalars(
                    select(PostMention.mentioned_user_id).where(
                        PostMention.post_id == post.id
                    )
                )
            )
            self.db.execute(delete(PostHashtag).where(PostHashtag.post_id == post.id))
            self.db.execute(delete(PostMention).where(PostMention.post_id == post.id))
            for tag in {t.lower() for t in HASHTAG_RE.findall(body)}:
                hashtag = self.hashtags.get_or_create(tag)
                self.db.add(PostHashtag(post_id=post.id, hashtag_id=hashtag.id))
            for handle in set(MENTION_RE.findall(body)):
                mentioned = self.users.get_by_handle(handle)
                if mentioned is None:
                    continue
                self.db.add(
                    PostMention(post_id=post.id, mentioned_user_id=mentioned.id)
                )
                if mentioned.id not in old_mentions and mentioned.id != user.id:
                    self.notify(mentioned.id, "You were mentioned in a post",
                                template_key="mention", post_id=post.id)
            self.audit("edited", "post", post.id, actor_user_id=user.id,
                       old={"body": post.body}, new={"body": body})
            post.body = body
            post.edited_at = utcnow()
        self.db.commit()
        self.db.refresh(post)
        return self._decorate_posts([post], user.id)[0]

    def delete_post(self, actor: User, post_id: int) -> None:
        post = self.posts.get_or_404(post_id)
        is_author = post.author_user_id == actor.id
        if not is_author and not user_has_platform_role(self.db, actor.id, "moderation_admin"):
            raise ForbiddenError("Only the author or a moderation admin can delete a post")
        post.deleted_at = utcnow()
        # NOTE: Feed uploads are intentionally NOT deleted from storage upon post deletion.
        # This preserves all media in storage for future feed archiving workflows.
        self.audit("deleted", "post", post.id, actor_user_id=actor.id)
        self.db.commit()

    # ----------------------------------------------------------- interactions
    def toggle_like(self, user: User, post_id: int) -> bool:
        self.posts.get_or_404(post_id)
        existing = self.db.get(PostLike, (post_id, user.id))
        if existing is None:
            self.db.add(PostLike(post_id=post_id, user_id=user.id))
            liked = True
        else:
            self.db.delete(existing)
            liked = False
        self.db.commit()
        return liked

    def toggle_bookmark(self, user: User, post_id: int) -> bool:
        existing = self.db.get(PostBookmark, (post_id, user.id))
        if existing is None:
            if self.posts.get_viewable(post_id, user.id) is None:
                raise NotFoundError("Post not found")
            self.db.add(PostBookmark(post_id=post_id, user_id=user.id))
            saved = True
        else:
            self.bookmarks.remove_from_all_collections(user.id, post_id)
            self.db.delete(existing)
            saved = False
        self.db.commit()
        return saved

    # ------------------------------------------------- saved posts & collections
    def saved_posts(
        self, user: User, collection_id: Optional[int], limit: int, offset: int
    ) -> list[dict]:
        if (
            collection_id is not None
            and self.collections.get_owned(collection_id, user.id) is None
        ):
            raise NotFoundError("Collection not found")
        rows = self.bookmarks.list_saved(user.id, collection_id, limit, offset)
        post_ids = [post_id for post_id, _ in rows]
        by_id = self.posts.get_many(post_ids)
        decorated = self._decorate_posts([by_id[pid] for pid in post_ids], user.id)
        memberships = self.bookmarks.collection_ids_for(user.id, post_ids)
        return [
            {**item, "saved_at": saved_at, "collection_ids": memberships[post_id]}
            for item, (post_id, saved_at) in zip(decorated, rows)
        ]

    def list_collections(self, user: User) -> list[dict]:
        return [
            {
                "id": collection.id,
                "name": collection.name,
                "created_at": collection.created_at,
                "post_count": count,
            }
            for collection, count in self.collections.list_with_counts(user.id)
        ]

    def create_collection(
        self, user: User, data: CollectionCreateRequest
    ) -> dict:
        name = data.name.strip()
        if not name:
            raise UnprocessableError("Collection name cannot be empty")
        if self.collections.name_exists(user.id, name):
            raise ConflictError("You already have a collection with this name")
        collection = BookmarkCollection(user_id=user.id, name=name)
        self.collections.add(collection)
        self.db.commit()
        self.db.refresh(collection)
        return {
            "id": collection.id,
            "name": collection.name,
            "created_at": collection.created_at,
            "post_count": 0,
        }

    def delete_collection(self, user: User, collection_id: int) -> None:
        collection = self.collections.get_owned(collection_id, user.id)
        if collection is None:
            raise NotFoundError("Collection not found")
        self.collections.delete_items(collection.id)
        self.collections.delete(collection)
        self.db.commit()

    def add_to_collection(
        self, user: User, collection_id: int, post_id: int
    ) -> None:
        collection = self.collections.get_owned(collection_id, user.id)
        if collection is None:
            raise NotFoundError("Collection not found")
        if self.db.get(PostBookmark, (post_id, user.id)) is None:
            raise UnprocessableError(
                "Save the post before adding it to a collection"
            )
        if self.collections.get_item(collection.id, post_id) is None:
            self.db.add(
                BookmarkCollectionPost(
                    collection_id=collection.id, post_id=post_id, user_id=user.id
                )
            )
        self.db.commit()

    def remove_from_collection(
        self, user: User, collection_id: int, post_id: int
    ) -> None:
        collection = self.collections.get_owned(collection_id, user.id)
        if collection is None:
            raise NotFoundError("Collection not found")
        item = self.collections.get_item(collection.id, post_id)
        if item is not None:
            self.db.delete(item)
        self.db.commit()

    def repost(self, user: User, post_id: int, data: RepostRequest) -> bool:
        """Toggle a repost; returns True when the post is now reposted."""
        post = self.posts.get_viewable(post_id, user.id)
        if post is None:
            raise NotFoundError("Post not found")
        existing = self.db.get(PostRepost, (post_id, user.id))
        if existing is not None:
            self.db.delete(existing)
            reposted = False
        else:
            if post.visibility != "public":
                raise ForbiddenError("Only public posts can be reposted")
            self.db.add(
                PostRepost(
                    post_id=post_id, user_id=user.id,
                    repost_type=data.repost_type, quote_post_id=data.quote_post_id,
                )
            )
            reposted = True
            if post.author_user_id and post.author_user_id != user.id:
                self.notify(post.author_user_id,
                            f"@{user.user_handle} reposted your post",
                            template_key="repost", post_id=post.id)
        self.db.commit()
        return reposted

    def comment(
        self, user: User, post_id: int, data: CommentCreateRequest
    ) -> dict[str, object]:
        post = self.posts.get_or_404(post_id)
        parent = None
        if data.parent_comment_id is not None:
            parent = self.comments.get(data.parent_comment_id)
            if parent is None or parent.post_id != post.id or parent.deleted_at is not None:
                raise NotFoundError("Comment to reply to not found")
        comment = PostComment(
            post_id=post.id, user_id=user.id,
            parent_comment_id=data.parent_comment_id, body=data.body,
        )
        self.comments.add(comment)
        self.db.flush()
        if parent is not None and parent.user_id != user.id:
            self.notify(parent.user_id, f"@{user.user_handle} replied to your comment",
                        template_key="comment_reply", post_id=post.id)
        if (
            post.author_user_id
            and post.author_user_id != user.id
            and (parent is None or post.author_user_id != parent.user_id)
        ):
            self.notify(post.author_user_id, "New comment on your post",
                        template_key="comment", post_id=post.id)
        self.db.commit()
        self.db.refresh(comment)
        return self._comment_view(
            {
                **comment.__dict__,
                "user_handle": user.user_handle,
                "full_name": user.full_name,
                "like_count": 0,
                "is_liked": False,
            },
            user.id,
        )

    def edit_comment(
        self, user: User, comment_id: int, data: CommentUpdateRequest
    ) -> dict[str, object]:
        comment = self.comments.get_or_404(comment_id)
        if comment.deleted_at is not None:
            raise NotFoundError("Comment not found")
        if comment.user_id != user.id:
            raise ForbiddenError("You can only edit your own comments")
        if utcnow() - comment.created_at > COMMENT_EDIT_WINDOW:
            raise ForbiddenError("Comments can only be edited within 30 minutes of posting")
        body = data.body.strip()
        if not body:
            raise UnprocessableError("Comment cannot be empty")
        if body != comment.body:
            old = {"body": comment.body}
            comment.body = body
            comment.updated_at = utcnow()
            self.audit("edited", "post_comment", comment.id, actor_user_id=user.id,
                       old=old, new={"body": body})
        self.db.commit()
        self.db.refresh(comment)
        likes = self.comments.like_state([comment.id], user.id)[comment.id]
        return self._comment_view(
            {
                **comment.__dict__,
                "user_handle": user.user_handle,
                "full_name": user.full_name,
                **likes,
            },
            user.id,
        )

    def delete_comment(self, user: User, comment_id: int) -> None:
        comment = self.comments.get_or_404(comment_id)
        if comment.deleted_at is not None:
            raise NotFoundError("Comment not found")
        post = self.posts.get_or_404(comment.post_id)
        if post.deleted_at is not None:
            raise NotFoundError("Post not found")
        if comment.user_id != user.id and post.author_user_id != user.id:
            raise ForbiddenError(
                "Only the commenter or the post author can delete this comment"
            )
        comment.deleted_at = utcnow()
        self.audit("deleted", "post_comment", comment.id, actor_user_id=user.id)
        self.db.commit()

    def toggle_comment_like(self, user: User, comment_id: int) -> bool:
        comment = self.comments.get_or_404(comment_id)
        if comment.deleted_at is not None:
            raise NotFoundError("Comment not found")
        existing = self.db.get(CommentLike, (comment_id, user.id))
        if existing is None:
            self.db.add(CommentLike(comment_id=comment_id, user_id=user.id))
            liked = True
        else:
            self.db.delete(existing)
            liked = False
        self.db.commit()
        return liked

    # ---------------------------------------------------------------- follows
    def _relationship_target(self, handle: str) -> User:
        target = self.users.get_by_handle(handle)
        if target is None or not target.is_active:
            raise NotFoundError("User not found")
        return target

    def _relationship_summary(self, viewer: Optional[User], target: User) -> UserRelationshipResponse:
        is_self = viewer is not None and viewer.id == target.id
        return UserRelationshipResponse(
            user_handle=target.user_handle,
            followers_count=self.follows.count_people(target.id, "followers"),
            following_count=self.follows.count_people(target.id, "following"),
            is_following=bool(viewer and not is_self and self.follows.get_pair(viewer.id, target.id)),
            follows_you=bool(viewer and not is_self and self.follows.get_pair(target.id, viewer.id)),
            is_self=is_self,
        )

    def relationship(self, viewer: Optional[User], handle: str) -> UserRelationshipResponse:
        return self._relationship_summary(viewer, self._relationship_target(handle))

    def relationship_people(self, viewer: Optional[User], handle: str, direction: str, limit: int, offset: int):
        if direction not in ("followers", "following"):
            raise UnprocessableError("Unknown relationship list")
        target = self._relationship_target(handle)
        people = self.follows.people(target.id, direction, limit, offset)
        pairs = self.follows.viewer_pairs(viewer.id, [person.id for person in people]) if viewer else set()
        items = [RelationshipPersonResponse.model_validate(person).model_copy(update={
            "is_self": bool(viewer and viewer.id == person.id),
            "is_following": bool(viewer and (viewer.id, person.id) in pairs),
            "follows_you": bool(viewer and (person.id, viewer.id) in pairs),
        }) for person in people]
        return {"items": items, "total": self.follows.count_people(target.id, direction), "limit": limit, "offset": offset}

    def set_follow(self, viewer: User, handle: str, following: bool) -> UserRelationshipResponse:
        """Idempotent handle adapter over user_follows; legacy toggle stays intact."""
        target = self._relationship_target(handle)
        if target.id == viewer.id:
            raise ForbiddenError("You cannot follow yourself")
        if following:
            if self.follows.get_pair(viewer.id, target.id) is None:
                self.db.add(UserFollow(follower_user_id=viewer.id, followed_user_id=target.id))
            try:
                self.db.commit()
            except IntegrityError:
                self.db.rollback()
                # The composite PK safely arbitrates concurrent identical PUTs.
                # Other integrity failures must not be reported as success.
                if self.follows.get_pair(viewer.id, target.id) is None:
                    raise ConflictError("Follow change conflicted; please retry") from None
        else:
            self.follows.remove_pair(viewer.id, target.id)
            self.db.commit()
        return self._relationship_summary(viewer, target)

    def toggle_follow(self, user: User, target_user_id: int) -> bool:
        target = self.users.get_or_404(target_user_id)
        if target.id == user.id:
            raise ForbiddenError("You cannot follow yourself")
        existing = self.follows.get_pair(user.id, target.id)
        if existing is None:
            self.db.add(UserFollow(follower_user_id=user.id, followed_user_id=target.id))
            following = True
        else:
            self.db.delete(existing)
            following = False
        self.db.commit()
        return following

    # ------------------------------------------------------------- moderation
    def moderate_post(self, actor: User, post_id: int, data: ModerationRequest) -> Post:
        require_platform_role(self.db, actor.id, "moderation_admin")
        post = self.posts.get_or_404(post_id)
        old = {"moderation_status": post.moderation_status}
        post.moderation_status = data.moderation_status
        post.updated_at = utcnow()
        self.audit("moderated", "post", post.id, actor_user_id=actor.id,
                   old=old, new={"moderation_status": data.moderation_status,
                                 "reason": data.reason})
        self.db.commit()
        self.db.refresh(post)
        return post
