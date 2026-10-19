"""Module 2: social graph and microblogging posts."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

POST_TYPES = ("post", "reply", "quote")
VISIBILITIES = ("public", "followers", "department", "private")
MODERATION_STATUSES = ("visible", "hidden", "removed", "under_review")
MEDIA_TYPES = ("image", "video", "document")
REPOST_TYPES = ("repost", "quote")


class UserFollow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (
        CheckConstraint(
            "follower_user_id <> followed_user_id", name="CK_user_follows_not_self"
        ),
        Index("IX_user_follows_followed", "followed_user_id"),
        Index("IX_user_follows_created", "created_at"),
    )

    follower_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    followed_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class Post(Base):
    __tablename__ = "posts"
    __table_args__ = (
        CheckConstraint(
            f"post_type IN ({','.join(repr(v) for v in POST_TYPES)})",
            name="CK_posts_post_type",
        ),
        CheckConstraint(
            f"visibility IN ({','.join(repr(v) for v in VISIBILITIES)})",
            name="CK_posts_visibility",
        ),
        CheckConstraint(
            f"moderation_status IN ({','.join(repr(v) for v in MODERATION_STATUSES)})",
            name="CK_posts_moderation",
        ),
        Index("IX_posts_author", "author_user_id"),
        Index("IX_posts_created", "created_at"),
        Index("IX_posts_visibility_created", "visibility", "created_at"),
        Index("IX_posts_reply_to", "reply_to_post_id"),
        Index("IX_posts_quote", "quote_post_id"),
        Index("IX_posts_moderation", "moderation_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    author_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    public_post_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    body: Mapped[str] = mapped_column(String, nullable=False)
    post_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'post'")
    )
    visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'public'")
    )
    reply_to_post_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("posts.id")
    )
    quote_post_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("posts.id")
    )
    is_sensitive: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    is_pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    moderation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'visible'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class PostMedia(Base):
    __tablename__ = "post_media"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), nullable=False
    )
    uploaded_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    alt_text: Mapped[Optional[str]] = mapped_column(String(500))
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (
        Index("IX_post_likes_user", "user_id"),
        Index("IX_post_likes_created", "created_at"),
    )

    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostRepost(Base):
    __tablename__ = "post_reposts"
    __table_args__ = (
        CheckConstraint(
            f"repost_type IN ({','.join(repr(v) for v in REPOST_TYPES)})",
            name="CK_post_reposts_type",
        ),
        Index("IX_post_reposts_user", "user_id"),
        Index("IX_post_reposts_created", "created_at"),
    )

    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    repost_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'repost'")
    )
    quote_post_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("posts.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostBookmark(Base):
    __tablename__ = "post_bookmarks"
    __table_args__ = (Index("IX_post_bookmarks_user", "user_id"),)

    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostComment(Base):
    __tablename__ = "post_comments"
    __table_args__ = (
        CheckConstraint(
            f"moderation_status IN ({','.join(repr(v) for v in MODERATION_STATUSES)})",
            name="CK_post_comments_moderation",
        ),
        Index("IX_post_comments_post", "post_id"),
        Index("IX_post_comments_user", "user_id"),
        Index("IX_post_comments_parent", "parent_comment_id"),
        Index("IX_post_comments_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    parent_comment_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("post_comments.id")
    )
    body: Mapped[str] = mapped_column(String, nullable=False)
    moderation_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'visible'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class CommentLike(Base):
    __tablename__ = "comment_likes"
    __table_args__ = (Index("IX_comment_likes_user", "user_id"),)

    comment_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("post_comments.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class Hashtag(Base):
    __tablename__ = "hashtags"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tag: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostHashtag(Base):
    __tablename__ = "post_hashtags"
    __table_args__ = (Index("IX_post_hashtags_tag", "hashtag_id"),)

    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), primary_key=True
    )
    hashtag_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("hashtags.id"), primary_key=True
    )


class PostMention(Base):
    __tablename__ = "post_mentions"
    __table_args__ = (
        Index(
            "UQ_post_mentions_post_user", "post_id", "mentioned_user_id", unique=True
        ),
        Index("IX_post_mentions_user", "mentioned_user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), nullable=False
    )
    mentioned_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostView(Base):
    __tablename__ = "post_views"
    __table_args__ = (
        Index("IX_post_views_post", "post_id"),
        Index("IX_post_views_viewer", "viewer_user_id"),
        Index("IX_post_views_viewed", "viewed_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), nullable=False
    )
    viewer_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    anonymous_view_key: Mapped[Optional[str]] = mapped_column(String(100))
    viewed_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
