"""AI assessment DTOs."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.grievance import Priority


class AssessmentResponse(ORMModel):
    id: int
    grievance_id: int
    model_name: str
    model_version: Optional[str] = None
    predicted_category_id: Optional[int] = None
    predicted_priority: Optional[str] = None
    sentiment_label: Optional[str] = None
    urgency_score: Optional[float] = None
    confidence_score: Optional[float] = None
    duplicate_of_grievance_id: Optional[int] = None
    summary: Optional[str] = None
    recommended_department_id: Optional[int] = None
    recommendation_reason: Optional[str] = None
    human_review_required: bool
    reviewed_by_user_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime


class AssessmentReviewRequest(BaseModel):
    """Human review of an AI assessment; overrides apply to the grievance."""

    approved: bool
    override_category_id: Optional[int] = None
    override_priority: Optional[Priority] = None
    override_department_id: Optional[int] = None
    review_note: Optional[str] = Field(default=None, max_length=500)
