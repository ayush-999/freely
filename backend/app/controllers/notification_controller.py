"""Notification / feedback / audit controller (LLD §7.2)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.notification import (
    AuditLogResponse,
    FeedbackCreateRequest,
    FeedbackResponse,
    NotificationResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get(
    "/notifications",
    response_model=list[NotificationResponse],
    summary="My notifications",
)
def list_notifications(
    channel: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return NotificationService(db).list_mine(current, channel, limit, offset)


@router.post(
    "/notifications/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return NotificationService(db).mark_read(current, notification_id)


@router.post(
    "/grievances/{grievance_id}/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback (complaint_reopened / appeal reopens the grievance)",
)
def submit_feedback(
    grievance_id: int,
    data: FeedbackCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return NotificationService(db).submit_feedback(current, grievance_id, data)


@router.get(
    "/audit-logs",
    response_model=list[AuditLogResponse],
    summary="Search the audit trail (can_audit / auditor)",
)
def search_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    grievance_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return NotificationService(db).search_audit(
        current, entity_type, entity_id, grievance_id, limit, offset
    )
