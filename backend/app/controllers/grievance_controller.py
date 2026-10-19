"""Grievance controller (LLD §3.3)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.common import MessageResponse
from app.schemas.grievance import (
    AttachmentIn,
    GrievanceCreateRequest,
    GrievanceLinkRequest,
    GrievanceResponse,
    GrievanceTrackingView,
    StatusTransitionRequest,
)
from app.services.grievance_service import GrievanceService

router = APIRouter()


@router.post(
    "/grievances",
    response_model=GrievanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit grievance (TX: grievance + attachments + history + SLA clock + audit + notification)",
)
def submit_grievance(
    data: GrievanceCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return GrievanceService(db).submit(current, data)


@router.get(
    "/grievances/track/{tracking_number}",
    response_model=GrievanceTrackingView,
    summary="Public tracking by tracking number (safe fields only)",
)
def track_grievance(tracking_number: str, db: Session = Depends(get_db)):
    return GrievanceService(db).track(tracking_number)


@router.get(
    "/grievances/mine",
    response_model=list[GrievanceResponse],
    summary="My grievances",
)
def my_grievances(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return GrievanceService(db).list_mine(current, limit, offset)


@router.get(
    "/departments/{department_id}/grievances",
    response_model=list[GrievanceResponse],
    summary="Department queue (can_manage_grievances)",
)
def department_queue(
    department_id: int,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return GrievanceService(db).department_queue(
        current, department_id, status_filter, priority, limit, offset
    )


@router.post(
    "/grievances/{grievance_id}/status",
    response_model=GrievanceResponse,
    summary="Transition status (validates the state machine)",
)
def transition_status(
    grievance_id: int,
    data: StatusTransitionRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return GrievanceService(db).transition_status(current, grievance_id, data)


@router.post(
    "/grievances/{grievance_id}/attachments",
    status_code=status.HTTP_201_CREATED,
    response_model=MessageResponse,
    summary="Add evidence attachment",
)
def add_attachment(
    grievance_id: int,
    data: AttachmentIn,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    attachment = GrievanceService(db).add_attachment(current, grievance_id, data)
    return MessageResponse(message=f"Attachment {attachment.id} added")


@router.post(
    "/grievances/{grievance_id}/links",
    response_model=MessageResponse,
    summary="Link a post to a grievance",
)
def link_post(
    grievance_id: int,
    data: GrievanceLinkRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    GrievanceService(db).link_post(current, grievance_id, data)
    return MessageResponse(message="Post linked")


@router.delete(
    "/grievances/{grievance_id}/links/{post_id}",
    response_model=MessageResponse,
    summary="Unlink a post from a grievance",
)
def unlink_post(
    grievance_id: int,
    post_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    GrievanceService(db).unlink_post(current, grievance_id, post_id)
    return MessageResponse(message="Post unlinked")
