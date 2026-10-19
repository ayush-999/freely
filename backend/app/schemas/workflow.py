"""Workflow DTOs — assignments, status history, responses."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

ResponseType = Literal[
    "acknowledgement", "clarification_request", "progress_update",
    "resolution", "rejection",
]


class AssignmentCreateRequest(BaseModel):
    department_id: int
    assigned_to_user_id: Optional[int] = None
    assignment_reason: Optional[str] = None


class AssignmentTransferRequest(BaseModel):
    to_department_id: int
    assigned_to_user_id: Optional[int] = None
    assignment_reason: Optional[str] = None


class AssignmentResponse(ORMModel):
    id: int
    grievance_id: int
    department_id: int
    assigned_to_user_id: Optional[int] = None
    assigned_by_user_id: Optional[int] = None
    assignment_status: str
    assignment_reason: Optional[str] = None
    assigned_at: datetime
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    transfer_from_assignment_id: Optional[int] = None


class StatusHistoryResponse(ORMModel):
    id: int
    grievance_id: int
    previous_status: Optional[str] = None
    new_status: str
    changed_by_user_id: Optional[int] = None
    change_reason: Optional[str] = None
    is_public: bool
    created_at: datetime


class ResponseCreateRequest(BaseModel):
    response_type: ResponseType
    message: str = Field(min_length=1)
    assignment_id: Optional[int] = None
    is_public: bool = True
    is_final_response: bool = False
    related_post_id: Optional[int] = None


class GrievanceResponseDto(ORMModel):
    id: int
    grievance_id: int
    assignment_id: Optional[int] = None
    user_id: Optional[int] = None
    response_type: str
    message: str
    is_public: bool
    is_final_response: bool
    related_post_id: Optional[int] = None
    created_at: datetime
