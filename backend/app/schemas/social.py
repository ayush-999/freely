"""Social graph & microblogging DTOs."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

PostVisibility = Literal["public", "followers", "department", "private"]
MediaType = Literal["image", "video", "document"]
RepostType = Literal["repost", "quote"]
ModerationStatus = Literal["visible", "hidden", "removed", "under_review"]


class MediaIn(BaseModel):
    """Media metadata for files already uploaded to object storage."""

    file_name: str = Field(max_length=255)
    storage_key: str = Field(max_length=500)
    mime_type: Optional[str] = Field(default=None, max_length=120)
    file_size_bytes: Optional[int] = None
    alt_text: Optional[str] = Field(default=None, max_length=500)
    media_type: MediaType
    sort_order: int = 0


class PostCreateRequest(BaseModel):
    body: str = Field(min_length=1)
    visibility: PostVisibility = "public"
    is_anonymous: bool = False
    is_sensitive: bool = False
    reply_to_post_id: Optional[int] = None
    quote_post_id: Optional[int] = None
    media: list[MediaIn] = Field(default_factory=list)


class PostResponse(ORMModel):
    id: int
    public_post_id: str
    author_user_id: Optional[int] = None
    is_anonymous: bool
    body: str
    post_type: str
    visibility: str
    moderation_status: str
    created_at: datetime


class PostPublicView(BaseModel):
    """Public-safe projection for anonymous lookup (internal IDs stripped)."""

    public_post_id: str
    body: str
    post_type: str
    is_sensitive: bool
    created_at: datetime


class CommentCreateRequest(BaseModel):
    body: str = Field(min_length=1)
    parent_comment_id: Optional[int] = None


class CommentResponse(ORMModel):
    id: int
    post_id: int
    user_id: int
    parent_comment_id: Optional[int] = None
    body: str
    moderation_status: str
    created_at: datetime


class RepostRequest(BaseModel):
    repost_type: RepostType = "repost"
    quote_post_id: Optional[int] = None


class ModerationRequest(BaseModel):
    moderation_status: ModerationStatus
    reason: Optional[str] = None
