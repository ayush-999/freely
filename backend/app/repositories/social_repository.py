"""Social graph repositories."""

from typing import Optional

from sqlalchemy import and_, func, or_, select

from app.models.social import (
    Hashtag,
    Post,
    PostLike,
    PostComment,
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

    def get_viewable(
        self, post_id: int, viewer_id: Optional[int]
    ) -> Optional[Post]:
        conditions = [
            Post.id == post_id,
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
        return self.db.scalar(select(Post).where(*conditions))

    def list_feed(
        self,
        viewer_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[Post]:
        """Visibility-filtered timeline (LLD §2.2).

        Guests see public posts only. Authenticated users additionally see their
        own posts and followers-only posts from authors they follow.
        """
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
        stmt = (
            select(Post)
            .where(*conditions)
            .order_by(Post.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def engagement_for_posts(
        self, post_ids: list[int], viewer_id: Optional[int]
    ) -> dict[int, dict[str, int | bool]]:
        engagement = {
            post_id: {"like_count": 0, "comment_count": 0, "is_liked": False}
            for post_id in post_ids
        }
        if not post_ids:
            return engagement

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


class PostCommentRepository(BaseRepository[PostComment]):
    model = PostComment

    def list_for_post(
        self, post_id: int, limit: int, offset: int
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
        return [
            {
                **comment.__dict__,
                "user_handle": user_handle,
                "full_name": full_name,
            }
            for comment, user_handle, full_name in self.db.execute(stmt)
        ]
