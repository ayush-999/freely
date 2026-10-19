"""SLA & escalation DTOs."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.grievance import Priority

EscalationLevel = Literal["level_1", "level_2", "level_3"]


class SlaPolicyCreateRequest(BaseModel):
    category_id: Optional[int] = None
    department_id: Optional[int] = None
    priority: Priority
    acknowledgement_minutes: int = Field(gt=0)
    response_minutes: int = Field(gt=0)
    resolution_minutes: int = Field(gt=0)
    working_hours_only: bool = False
    escalation_after_minutes: Optional[int] = Field(default=None, gt=0)
    effective_from: datetime
    effective_until: Optional[datetime] = None


class SlaPolicyResponse(ORMModel):
    id: int
    category_id: Optional[int] = None
    department_id: Optional[int] = None
    priority: str
    acknowledgement_minutes: int
    response_minutes: int
    resolution_minutes: int
    working_hours_only: bool
    escalation_after_minutes: Optional[int] = None
    effective_from: datetime
    effective_until: Optional[datetime] = None
    is_active: bool


class SlaClockResponse(ORMModel):
    id: int
    grievance_id: int
    sla_policy_id: int
    acknowledgement_due_at: Optional[datetime] = None
    first_response_due_at: Optional[datetime] = None
    resolution_due_at: Optional[datetime] = None
    first_responded_at: Optional[datetime] = None
    actual_resolved_at: Optional[datetime] = None
    clock_status: str
    paused_at: Optional[datetime] = None
    total_paused_minutes: int
    breached_at: Optional[datetime] = None
    breach_reason: Optional[str] = None


class EscalationResponse(ORMModel):
    id: int
    grievance_id: int
    sla_id: Optional[int] = None
    from_department_id: Optional[int] = None
    to_department_id: Optional[int] = None
    assigned_to_user_id: Optional[int] = None
    level: str
    reason: str
    status: str
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None


class EscalationResolveRequest(BaseModel):
    resolution_note: Optional[str] = Field(default=None, max_length=2000)
