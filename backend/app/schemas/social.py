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


class MediaResponse(ORMModel):
    id: int
    post_id: int
    uploaded_by_user_id: Optional[int] = None
    file_name: str
    storage_key: str
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = None
    alt_text: Optional[str] = None
    media_type: str
    sort_order: int = 0
    created_at: datetime


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
    edited_at: Optional[datetime] = None
    like_count: int = 0
    comment_count: int = 0
    repost_count: int = 0
    is_liked: bool = False
    is_reposted: bool = False
    is_bookmarked: bool = False
    author_handle: Optional[str] = None
    author_full_name: Optional[str] = None
    author_avatar_storage_key: Optional[str] = None
    media: list[MediaResponse] = Field(default_factory=list)


class PostUpdateRequest(BaseModel):
    body: str = Field(min_length=1)


class ProfilePostResponse(PostResponse):
    """A post on a profile; ``reposted_by_handle`` is set when it is a repost."""

    activity_at: datetime
    reposted_by_handle: Optional[str] = None
    reposted_by_full_name: Optional[str] = None


class SavedPostResponse(PostResponse):
    saved_at: datetime
    collection_ids: list[int] = Field(default_factory=list)


class CollectionCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class CollectionResponse(ORMModel):
    id: int
    name: str
    created_at: datetime
    post_count: int = 0


class PostPublicView(BaseModel):
    """Public-safe projection for anonymous lookup (internal IDs stripped)."""

    public_post_id: str
    body: str
    post_type: str
    is_sensitive: bool
    created_at: datetime
    media: list[MediaResponse] = Field(default_factory=list)


class TrendingHashtag(BaseModel):
    tag: str
    post_count: int


class CommentCreateRequest(BaseModel):
    body: str = Field(min_length=1)
    parent_comment_id: Optional[int] = None


class CommentUpdateRequest(BaseModel):
    body: str = Field(min_length=1)


class CommentResponse(ORMModel):
    id: int
    post_id: int
    user_id: int
    user_handle: str
    full_name: str
    parent_comment_id: Optional[int] = None
    body: str
    moderation_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    like_count: int = 0
    is_liked: bool = False
    can_edit: bool = False
    can_delete: bool = False


class RepostRequest(BaseModel):
    repost_type: RepostType = "repost"
    quote_post_id: Optional[int] = None


class ModerationRequest(BaseModel):
    moderation_status: ModerationStatus
    reason: Optional[str] = None
