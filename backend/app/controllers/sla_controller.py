"""SLA & escalation controller (LLD §6.4)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.common import MessageResponse
from app.schemas.sla import (
    EscalationResolveRequest,
    EscalationResponse,
    SlaClockResponse,
    SlaPolicyCreateRequest,
    SlaPolicyResponse,
)
from app.services.sla_service import SlaService

router = APIRouter()


@router.get(
    "/sla-policies",
    response_model=list[SlaPolicyResponse],
    summary="List SLA policies",
)
def list_policies(
    department_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).list_policies(department_id, category_id)


@router.post(
    "/sla-policies",
    response_model=SlaPolicyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create SLA policy (can_manage_sla or platform_admin)",
)
def create_policy(
    data: SlaPolicyCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).create_policy(current, data)


@router.get(
    "/grievances/{grievance_id}/sla",
    response_model=SlaClockResponse,
    summary="SLA clock status",
)
def get_clock(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).get_clock(current, grievance_id)


@router.post(
    "/grievances/{grievance_id}/sla/pause",
    response_model=SlaClockResponse,
    summary="Pause the SLA clock (can_manage_sla)",
)
def pause_clock(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).pause_clock(current, grievance_id)


@router.post(
    "/grievances/{grievance_id}/sla/resume",
    response_model=SlaClockResponse,
    summary="Resume the SLA clock (can_manage_sla)",
)
def resume_clock(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).resume_clock(current, grievance_id)


@router.get(
    "/escalations",
    response_model=list[EscalationResponse],
    summary="Escalation inbox",
)
def list_escalations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    department_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).list_escalations(current, status_filter, department_id, limit, offset)


@router.post(
    "/escalations/{escalation_id}/acknowledge",
    response_model=EscalationResponse,
    summary="Acknowledge an escalation",
)
def acknowledge_escalation(
    escalation_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).acknowledge_escalation(current, escalation_id)


@router.post(
    "/escalations/{escalation_id}/resolve",
    response_model=EscalationResponse,
    summary="Resolve an escalation",
)
def resolve_escalation(
    escalation_id: int,
    data: EscalationResolveRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).resolve_escalation(current, escalation_id, data)


@router.post(
    "/escalations/{escalation_id}/dismiss",
    response_model=EscalationResponse,
    summary="Dismiss an escalation",
)
def dismiss_escalation(
    escalation_id: int,
    data: EscalationResolveRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return SlaService(db).dismiss_escalation(current, escalation_id, data)


@router.post(
    "/internal/sla/scan",
    response_model=MessageResponse,
    summary="Run the SLA breach scanner (worker/manual trigger; TODO: service auth)",
)
def scan_breaches(db: Session = Depends(get_db)):
    breached = SlaService(db).scan_breaches()
    return MessageResponse(message=f"{breached} clock(s) breached and escalated")
