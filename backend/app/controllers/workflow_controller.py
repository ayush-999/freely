"""Workflow controller: assignments, transfers, responses, history (LLD §5.2)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.workflow import (
    AssignmentCreateRequest,
    AssignmentResponse,
    AssignmentTransferRequest,
    GrievanceResponseDto,
    ResponseCreateRequest,
    StatusHistoryResponse,
)
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.post(
    "/grievances/{grievance_id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Assign grievance to a department / officer",
)
def assign(
    grievance_id: int,
    data: AssignmentCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).assign(current, grievance_id, data)


@router.get(
    "/grievances/{grievance_id}/assignments",
    response_model=list[AssignmentResponse],
    summary="Assignment chain for a grievance",
)
def list_assignments(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).get_assignments(grievance_id)


@router.post(
    "/assignments/{assignment_id}/accept",
    response_model=AssignmentResponse,
    summary="Officer accepts an assignment",
)
def accept(
    assignment_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).accept(current, assignment_id)


@router.post(
    "/assignments/{assignment_id}/transfer",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Transfer (inserts a new assignment row chained to the old one)",
)
def transfer(
    assignment_id: int,
    data: AssignmentTransferRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).transfer(current, assignment_id, data)


@router.post(
    "/grievances/{grievance_id}/responses",
    response_model=GrievanceResponseDto,
    status_code=status.HTTP_201_CREATED,
    summary="Add an official response",
)
def add_response(
    grievance_id: int,
    data: ResponseCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).add_response(current, grievance_id, data)


@router.get(
    "/grievances/{grievance_id}/responses",
    response_model=list[GrievanceResponseDto],
    summary="Responses (public-filtered for citizens)",
)
def list_responses(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).get_responses(current, grievance_id)


@router.get(
    "/grievances/{grievance_id}/history",
    response_model=list[StatusHistoryResponse],
    summary="Status timeline (public-filtered for citizens)",
)
def get_history(
    grievance_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return WorkflowService(db).get_history(current, grievance_id)
