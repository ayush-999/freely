"""Social service: posts, feed, interactions, follows, moderation (LLD §2)."""

import re
from typing import Optional

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.identity import User
from app.models.social import (
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
    HashtagRepository,
    PostCommentRepository,
    PostRepository,
    UserFollowRepository,
)
from app.schemas.social import (
    CommentCreateRequest,
    ModerationRequest,
    PostCreateRequest,
    RepostRequest,
)
from app.services.base import BaseService
from app.services.permissions import require_platform_role, user_has_platform_role
from app.utils import utcnow
from app.utils.ids import new_public_post_id

HASHTAG_RE = re.compile(r"#(\w+)")
MENTION_RE = re.compile(r"@(\w+)")


class SocialService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.posts = PostRepository(db)
        self.follows = UserFollowRepository(db)
        self.hashtags = HashtagRepository(db)
        self.comments = PostCommentRepository(db)
        self.users = UserRepository(db)

    # ----------------------------------------------------------------- posts
    def create_post(self, author: Optional[User], data: PostCreateRequest) -> Post:
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
        return post

    def lookup_public(self, public_post_id: str) -> Post:
        """Anonymous lookup by public_post_id — public posts only (LLD §2.2)."""
        post = self.posts.get_by_public_id(public_post_id)
        if (
            post is None
            or post.moderation_status != "visible"
            or post.visibility != "public"
        ):
            raise NotFoundError("Post not found")
        return post

    def feed(
        self, viewer: Optional[User], limit: int, offset: int
    ) -> list[dict]:
        viewer_id = None if viewer is None else viewer.id
        posts = self.posts.list_feed(viewer_id, limit, offset)
        engagement = self.posts.engagement_for_posts(
            [post.id for post in posts], viewer_id
        )
        return [
            {
                **post.__dict__,
                **engagement[post.id],
            }
            for post in posts
        ]

    def comments_for_post(
        self, viewer: Optional[User], post_id: int, limit: int, offset: int
    ) -> list[dict[str, object]]:
        viewer_id = None if viewer is None else viewer.id
        post = self.posts.get_viewable(post_id, viewer_id)
        if post is None:
            raise NotFoundError("Post not found")
        return self.comments.list_for_post(post.id, limit, offset)

    def delete_post(self, actor: User, post_id: int) -> None:
        post = self.posts.get_or_404(post_id)
        is_author = post.author_user_id == actor.id
        if not is_author and not user_has_platform_role(self.db, actor.id, "moderation_admin"):
            raise ForbiddenError("Only the author or a moderation admin can delete a post")
        post.deleted_at = utcnow()
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
        self.posts.get_or_404(post_id)
        existing = self.db.get(PostBookmark, (post_id, user.id))
        if existing is None:
            self.db.add(PostBookmark(post_id=post_id, user_id=user.id))
            saved = True
        else:
            self.db.delete(existing)
            saved = False
        self.db.commit()
        return saved

    def repost(self, user: User, post_id: int, data: RepostRequest) -> None:
        self.posts.get_or_404(post_id)
        existing = self.db.get(PostRepost, (post_id, user.id))
        if existing is not None:
            self.db.delete(existing)
        else:
            self.db.add(
                PostRepost(
                    post_id=post_id, user_id=user.id,
                    repost_type=data.repost_type, quote_post_id=data.quote_post_id,
                )
            )
        self.db.commit()

    def comment(
        self, user: User, post_id: int, data: CommentCreateRequest
    ) -> dict[str, object]:
        post = self.posts.get_or_404(post_id)
        comment = PostComment(
            post_id=post.id, user_id=user.id,
            parent_comment_id=data.parent_comment_id, body=data.body,
        )
        self.comments.add(comment)
        self.db.flush()
        if post.author_user_id and post.author_user_id != user.id:
            self.notify(post.author_user_id, "New comment on your post",
                        template_key="comment", post_id=post.id)
        self.db.commit()
        self.db.refresh(comment)
        return {
            **comment.__dict__,
            "user_handle": user.user_handle,
            "full_name": user.full_name,
        }

    # ---------------------------------------------------------------- follows
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
