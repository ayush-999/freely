"""Social graph repositories."""

from datetime import datetime
from typing import Optional

from sqlalchemy import and_, delete, func, literal_column, or_, select, union_all

from app.models.social import (
    BookmarkCollection,
    BookmarkCollectionPost,
    CommentLike,
    Hashtag,
    Post,
    PostBookmark,
    PostHashtag,
    PostLike,
    PostComment,
    PostMedia,
    PostRepost,
    UserFollow,
)
from app.models.identity import User
from app.repositories.base import BaseRepository


class PostRepository(BaseRepository[Post]):
    model = Post

    def get_by_public_id(self, public_post_id: str) -> Optional[Post]:
        return self.db.scalar(
            select(Post).where(
                Post.public_post_id == public_post_id,
                Post.deleted_at.is_(None),
            )
        )

    @staticmethod
    def _visibility_conditions(viewer_id: Optional[int]) -> list:
        """Guests see public posts; users also see their own and followed-only posts."""
        conditions = [
            Post.deleted_at.is_(None),
            Post.moderation_status == "visible",
        ]
        if viewer_id is None:
            conditions.append(Post.visibility == "public")
        else:
            followed_ids = select(UserFollow.followed_user_id).where(
                UserFollow.follower_user_id == viewer_id
            )
            conditions.append(
                or_(
                    Post.visibility == "public",
                    Post.author_user_id == viewer_id,
                    and_(
                        Post.visibility == "followers",
                        Post.author_user_id.in_(followed_ids),
                    ),
                )
            )
        return conditions

    def get_viewable(
        self, post_id: int, viewer_id: Optional[int]
    ) -> Optional[Post]:
        return self.db.scalar(
            select(Post).where(
                Post.id == post_id, *self._visibility_conditions(viewer_id)
            )
        )

    def list_feed(
        self,
        viewer_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[Post]:
        """Visibility-filtered timeline (LLD §2.2)."""
        stmt = (
            select(Post)
            .where(*self._visibility_conditions(viewer_id))
            .order_by(Post.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def list_profile_activity(
        self,
        profile_user_id: int,
        viewer_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[tuple[int, datetime, bool]]:
        """A user's own named posts plus the posts they reposted, newest first."""
        visible = self._visibility_conditions(viewer_id)
        authored = select(
            Post.id.label("post_id"),
            Post.created_at.label("activity_at"),
            literal_column("0").label("is_repost"),
        ).where(
            Post.author_user_id == profile_user_id,
            Post.is_anonymous == False,  # noqa: E712 - SQL Server rejects IS 0
            *visible,
        )
        reposted = (
            select(
                Post.id.label("post_id"),
                PostRepost.created_at.label("activity_at"),
                literal_column("1").label("is_repost"),
            )
            .join(PostRepost, PostRepost.post_id == Post.id)
            .where(PostRepost.user_id == profile_user_id, *visible)
        )
        activity = union_all(authored, reposted).subquery()
        stmt = (
            select(activity.c.post_id, activity.c.activity_at, activity.c.is_repost)
            .order_by(activity.c.activity_at.desc(), activity.c.post_id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [
            (post_id, activity_at, bool(is_repost))
            for post_id, activity_at, is_repost in self.db.execute(stmt)
        ]

    def get_many(self, post_ids: list[int]) -> dict[int, Post]:
        if not post_ids:
            return {}
        rows = self.db.scalars(select(Post).where(Post.id.in_(post_ids)))
        return {post.id: post for post in rows}

    def authors_for_posts(self, post_ids: list[int]) -> dict[int, User]:
        """Author accounts of non-anonymous posts, keyed by post id."""
        if not post_ids:
            return {}
        rows = self.db.execute(
            select(Post.id, User)
            .join(User, User.id == Post.author_user_id)
            .where(
                Post.id.in_(post_ids),
                Post.is_anonymous == False,  # noqa: E712
            )
        )
        return {post_id: user for post_id, user in rows}

    def engagement_for_posts(
        self, post_ids: list[int], viewer_id: Optional[int]
    ) -> dict[int, dict[str, int | bool]]:
        engagement = {
            post_id: {
                "like_count": 0,
                "comment_count": 0,
                "repost_count": 0,
                "is_liked": False,
                "is_reposted": False,
                "is_bookmarked": False,
            }
            for post_id in post_ids
        }
        if not post_ids:
            return engagement

        if viewer_id is not None:
            saved_posts = self.db.scalars(
                select(PostBookmark.post_id).where(
                    PostBookmark.post_id.in_(post_ids),
                    PostBookmark.user_id == viewer_id,
                )
            )
            for post_id in saved_posts:
                engagement[post_id]["is_bookmarked"] = True

        repost_counts = self.db.execute(
            select(PostRepost.post_id, func.count())
            .where(PostRepost.post_id.in_(post_ids))
            .group_by(PostRepost.post_id)
        )
        for post_id, count in repost_counts:
            engagement[post_id]["repost_count"] = count
        if viewer_id is not None:
            reposted_posts = self.db.scalars(
                select(PostRepost.post_id).where(
                    PostRepost.post_id.in_(post_ids),
                    PostRepost.user_id == viewer_id,
                )
            )
            for post_id in reposted_posts:
                engagement[post_id]["is_reposted"] = True

        like_counts = self.db.execute(
            select(PostLike.post_id, func.count())
            .where(PostLike.post_id.in_(post_ids))
            .group_by(PostLike.post_id)
        )
        for post_id, count in like_counts:
            engagement[post_id]["like_count"] = count

        comment_counts = self.db.execute(
            select(PostComment.post_id, func.count())
            .where(
                PostComment.post_id.in_(post_ids),
                PostComment.deleted_at.is_(None),
                PostComment.moderation_status == "visible",
            )
            .group_by(PostComment.post_id)
        )
        for post_id, count in comment_counts:
            engagement[post_id]["comment_count"] = count

        if viewer_id is not None:
            liked_posts = self.db.scalars(
                select(PostLike.post_id).where(
                    PostLike.post_id.in_(post_ids), PostLike.user_id == viewer_id
                )
            )
            for post_id in liked_posts:
                engagement[post_id]["is_liked"] = True
        return engagement

    def media_for_posts(self, post_ids: list[int]) -> dict[int, list[PostMedia]]:
        media_map: dict[int, list[PostMedia]] = {pid: [] for pid in post_ids}
        if not post_ids:
            return media_map
        rows = list(
            self.db.scalars(
                select(PostMedia)
                .where(PostMedia.post_id.in_(post_ids))
                .order_by(PostMedia.sort_order, PostMedia.id)
            )
        )
        for m in rows:
            media_map[m.post_id].append(m)
        return media_map


class BookmarkRepository(BaseRepository[PostBookmark]):
    model = PostBookmark

    def list_saved(
        self, user_id: int, collection_id: Optional[int], limit: int, offset: int
    ) -> list[tuple[int, datetime]]:
        """Saved, still-visible posts of a user (optionally one collection), newest save first."""
        stmt = (
            select(Post.id, PostBookmark.created_at)
            .join(PostBookmark, PostBookmark.post_id == Post.id)
            .where(
                PostBookmark.user_id == user_id,
                *PostRepository._visibility_conditions(user_id),
            )
        )
        if collection_id is not None:
            stmt = stmt.join(
                BookmarkCollectionPost,
                and_(
                    BookmarkCollectionPost.post_id == PostBookmark.post_id,
                    BookmarkCollectionPost.user_id == PostBookmark.user_id,
                ),
            ).where(BookmarkCollectionPost.collection_id == collection_id)
        stmt = (
            stmt.order_by(PostBookmark.created_at.desc(), Post.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return [(post_id, saved_at) for post_id, saved_at in self.db.execute(stmt)]

    def collection_ids_for(
        self, user_id: int, post_ids: list[int]
    ) -> dict[int, list[int]]:
        result: dict[int, list[int]] = {post_id: [] for post_id in post_ids}
        if not post_ids:
            return result
        rows = self.db.execute(
            select(BookmarkCollectionPost.post_id, BookmarkCollectionPost.collection_id)
            .where(
                BookmarkCollectionPost.user_id == user_id,
                BookmarkCollectionPost.post_id.in_(post_ids),
            )
            .order_by(BookmarkCollectionPost.collection_id)
        )
        for post_id, collection_id in rows:
            result[post_id].append(collection_id)
        return result

    def remove_from_all_collections(self, user_id: int, post_id: int) -> None:
        self.db.execute(
            delete(BookmarkCollectionPost).where(
                BookmarkCollectionPost.user_id == user_id,
                BookmarkCollectionPost.post_id == post_id,
            )
        )


class BookmarkCollectionRepository(BaseRepository[BookmarkCollection]):
    model = BookmarkCollection

    def get_owned(
        self, collection_id: int, user_id: int
    ) -> Optional[BookmarkCollection]:
        return self.db.scalar(
            select(BookmarkCollection).where(
                BookmarkCollection.id == collection_id,
                BookmarkCollection.user_id == user_id,
            )
        )

    def name_exists(self, user_id: int, name: str) -> bool:
        return (
            self.db.scalar(
                select(BookmarkCollection.id).where(
                    BookmarkCollection.user_id == user_id,
                    BookmarkCollection.name == name,
                )
            )
            is not None
        )

    def list_with_counts(self, user_id: int) -> list[tuple[BookmarkCollection, int]]:
        post_count = func.count(Post.id)
        stmt = (
            select(BookmarkCollection, post_count)
            .outerjoin(
                BookmarkCollectionPost,
                BookmarkCollectionPost.collection_id == BookmarkCollection.id,
            )
            .outerjoin(
                Post,
                and_(
                    Post.id == BookmarkCollectionPost.post_id,
                    Post.deleted_at.is_(None),
                ),
            )
            .where(BookmarkCollection.user_id == user_id)
            .group_by(
                BookmarkCollection.id,
                BookmarkCollection.user_id,
                BookmarkCollection.name,
                BookmarkCollection.created_at,
            )
            .order_by(BookmarkCollection.created_at)
        )
        return [(collection, count) for collection, count in self.db.execute(stmt)]

    def get_item(
        self, collection_id: int, post_id: int
    ) -> Optional[BookmarkCollectionPost]:
        return self.db.get(BookmarkCollectionPost, (collection_id, post_id))

    def delete_items(self, collection_id: int) -> None:
        self.db.execute(
            delete(BookmarkCollectionPost).where(
                BookmarkCollectionPost.collection_id == collection_id
            )
        )


class UserFollowRepository(BaseRepository[UserFollow]):
    model = UserFollow

    def get_pair(self, follower_id: int, followed_id: int) -> Optional[UserFollow]:
        return self.db.get(UserFollow, (follower_id, followed_id))


class HashtagRepository(BaseRepository[Hashtag]):
    model = Hashtag

    def get_or_create(self, tag: str) -> Hashtag:
        tag = tag.lower()
        hashtag = self.db.scalar(select(Hashtag).where(Hashtag.tag == tag))
        if hashtag is None:
            hashtag = Hashtag(tag=tag)
            self.db.add(hashtag)
            self.db.flush()
        return hashtag

    def trending(self, since: datetime, limit: int) -> list[tuple[str, int]]:
        """Hashtags ranked by recent public, visible, non-deleted posts."""
        post_count = func.count(PostHashtag.post_id)
        stmt = (
            select(Hashtag.tag, post_count)
            .join(PostHashtag, PostHashtag.hashtag_id == Hashtag.id)
            .join(Post, Post.id == PostHashtag.post_id)
            .where(
                Post.deleted_at.is_(None),
                Post.moderation_status == "visible",
                Post.visibility == "public",
                Post.created_at >= since,
            )
            .group_by(Hashtag.tag)
            .order_by(post_count.desc(), Hashtag.tag)
            .limit(limit)
        )
        return [(tag, count) for tag, count in self.db.execute(stmt)]


class PostCommentRepository(BaseRepository[PostComment]):
    model = PostComment

    def list_for_post(
        self,
        post_id: int,
        limit: int,
        offset: int,
        viewer_id: Optional[int] = None,
    ) -> list[dict[str, object]]:
        stmt = (
            select(PostComment, User.user_handle, User.full_name)
            .join(User, User.id == PostComment.user_id)
            .where(
                PostComment.post_id == post_id,
                PostComment.deleted_at.is_(None),
                PostComment.moderation_status == "visible",
            )
            .order_by(PostComment.created_at)
            .limit(limit)
            .offset(offset)
        )
        rows = list(self.db.execute(stmt))
        likes = self.like_state([comment.id for comment, _, _ in rows], viewer_id)
        return [
            {
                **comment.__dict__,
                "user_handle": user_handle,
                "full_name": full_name,
                **likes[comment.id],
            }
            for comment, user_handle, full_name in rows
        ]

    def like_state(
        self, comment_ids: list[int], viewer_id: Optional[int]
    ) -> dict[int, dict[str, int | bool]]:
        state = {cid: {"like_count": 0, "is_liked": False} for cid in comment_ids}
        if not comment_ids:
            return state
        counts = self.db.execute(
            select(CommentLike.comment_id, func.count())
            .where(CommentLike.comment_id.in_(comment_ids))
            .group_by(CommentLike.comment_id)
        )
        for comment_id, count in counts:
            state[comment_id]["like_count"] = count
        if viewer_id is not None:
            liked = self.db.scalars(
                select(CommentLike.comment_id).where(
                    CommentLike.comment_id.in_(comment_ids),
                    CommentLike.user_id == viewer_id,
                )
            )
            for comment_id in liked:
                state[comment_id]["is_liked"] = True
        return state
