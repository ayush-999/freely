"""Notification, feedback and audit DTOs."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

FeedbackType = Literal["satisfaction", "complaint_reopened", "appeal"]


class NotificationResponse(ORMModel):
    id: int
    grievance_id: Optional[int] = None
    post_id: Optional[int] = None
    channel: str
    status: str
    template_key: Optional[str] = None
    subject: Optional[str] = None
    message: str
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    created_at: datetime


class FeedbackCreateRequest(BaseModel):
    feedback_type: FeedbackType
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comments: Optional[str] = None
    response_id: Optional[int] = None


class FeedbackResponse(ORMModel):
    id: int
    grievance_id: int
    user_id: int
    response_id: Optional[int] = None
    feedback_type: str
    rating: Optional[int] = None
    comments: Optional[str] = None
    created_at: datetime


class AuditLogResponse(ORMModel):
    id: int
    grievance_id: Optional[int] = None
    actor_user_id: Optional[int] = None
    action: str
    entity_type: str
    entity_id: Optional[int] = None
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
