"""AI assessment controller (LLD §4.3)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.ai import AssessmentResponse, AssessmentReviewRequest
from app.services.ai_service import AIService

router = APIRouter()


@router.post(
    "/internal/grievances/{grievance_id}/assess",
    response_model=AssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Trigger AI assessment (service-to-service; TODO: service token auth)",
)
def trigger_assessment(grievance_id: int, db: Session = Depends(get_db)):
    return AIService(db).trigger_assessment(grievance_id)


@router.get(
    "/grievances/{grievance_id}/assessments",
    response_model=list[AssessmentResponse],
    summary="List AI assessments for a grievance (can_review_ai)",
)
def list_assessments(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return AIService(db).list_for_grievance(current, grievance_id)


@router.post(
    "/ai-assessments/{assessment_id}/review",
    response_model=AssessmentResponse,
    summary="Human review gate: confirm or override (can_review_ai)",
)
def review_assessment(
    assessment_id: int,
    data: AssessmentReviewRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return AIService(db).review(current, assessment_id, data)
