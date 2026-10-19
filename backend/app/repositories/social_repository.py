"""Social graph repositories."""

from typing import Optional

from sqlalchemy import and_, or_, select

from app.models.social import (
    Hashtag,
    Post,
    PostComment,
    UserFollow,
)
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
    ) -> list[PostComment]:
        stmt = (
            select(PostComment)
            .where(
                PostComment.post_id == post_id,
                PostComment.deleted_at.is_(None),
                PostComment.moderation_status == "visible",
            )
            .order_by(PostComment.created_at)
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))
