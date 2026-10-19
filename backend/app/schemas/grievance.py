"""Grievance DTOs."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

GrievanceStatus = Literal[
    "submitted", "acknowledged", "under_review", "assigned", "in_progress",
    "awaiting_citizen", "resolved", "closed", "rejected", "reopened",
]
Priority = Literal["low", "medium", "high", "critical"]
LinkType = Literal["discussion", "official_update", "evidence_context"]


class AttachmentIn(BaseModel):
    file_name: str = Field(max_length=255)
    storage_key: str = Field(max_length=500)
    mime_type: Optional[str] = Field(default=None, max_length=120)
    file_size_bytes: Optional[int] = None
    checksum: Optional[str] = Field(default=None, max_length=128)
    is_evidence: bool = False


class GrievanceCreateRequest(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=250)
    description: str = Field(min_length=1)
    priority: Priority = "medium"
    is_anonymous: bool = False
    location_text: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=15)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    attachments: list[AttachmentIn] = Field(default_factory=list)


class GrievanceResponse(ORMModel):
    id: int
    tracking_number: str
    user_id: int
    category_id: int
    title: str
    description: str
    status: str
    priority: str
    is_anonymous: bool
    district: Optional[str] = None
    state: Optional[str] = None
    submitted_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class GrievanceTrackingView(BaseModel):
    """Public tracking projection — safe fields only."""

    tracking_number: str
    title: str
    status: str
    priority: str
    district: Optional[str] = None
    state: Optional[str] = None
    submitted_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class StatusTransitionRequest(BaseModel):
    new_status: GrievanceStatus
    change_reason: Optional[str] = None
    is_public: bool = True


class GrievanceLinkRequest(BaseModel):
    post_id: int
    link_type: LinkType = "discussion"


class CategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=40)
    description: Optional[str] = None
    parent_category_id: Optional[int] = None
    default_department_id: Optional[int] = None


class CategoryResponse(ORMModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    parent_category_id: Optional[int] = None
    default_department_id: Optional[int] = None
    is_active: bool
