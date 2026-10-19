"""SLA & escalation service (LLD §6)."""

from typing import Optional

from app.core.exceptions import NotFoundError, UnprocessableError
from app.models.identity import User
from app.models.sla import GrievanceEscalation, GrievanceSla, SlaPolicy
from app.repositories.grievance_repository import GrievanceRepository
from app.repositories.sla_repository import (
    GrievanceEscalationRepository,
    GrievanceSlaRepository,
    SlaPolicyRepository,
)
from app.repositories.workflow_repository import AssignmentRepository
from app.schemas.sla import EscalationResolveRequest, SlaPolicyCreateRequest
from app.services.base import BaseService
from app.services.permissions import require_any_scope, require_dept_flag
from app.utils import utcnow


class SlaService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.policies = SlaPolicyRepository(db)
        self.clocks = GrievanceSlaRepository(db)
        self.escalations = GrievanceEscalationRepository(db)
        self.grievances = GrievanceRepository(db)
        self.assignments = AssignmentRepository(db)

    # --------------------------------------------------------------- policies
    def create_policy(self, actor: User, data: SlaPolicyCreateRequest) -> SlaPolicy:
        require_any_scope(
            self.db, actor.id, dept_flag="can_manage_sla", platform_role="platform_admin"
        )
        policy = SlaPolicy(**data.model_dump())
        self.policies.add(policy)
        self.db.flush()
        self.audit("created", "sla_policy", policy.id, actor_user_id=actor.id,
                   new=data.model_dump(mode="json"))
        self.db.commit()
        self.db.refresh(policy)
        return policy

    def list_policies(
        self, department_id: Optional[int], category_id: Optional[int]
    ) -> list[SlaPolicy]:
        return self.policies.list_filtered(department_id, category_id)

    # ----------------------------------------------------------------- clocks
    def get_clock(self, actor: User, grievance_id: int) -> GrievanceSla:
        grievance = self.grievances.get_or_404(grievance_id)
        clock = self.clocks.get_by_grievance(grievance.id)
        if clock is None:
            raise NotFoundError("No SLA clock for this grievance")
        return clock

    def pause_clock(self, actor: User, grievance_id: int) -> GrievanceSla:
        require_dept_flag(self.db, actor.id, "can_manage_sla")
        clock = self.get_clock(actor, grievance_id)
        if clock.clock_status != "running":
            raise UnprocessableError(f"Clock is {clock.clock_status}; cannot pause")
        clock.clock_status = "paused"
        clock.paused_at = utcnow()
        clock.updated_at = utcnow()
        self.audit("sla_paused", "grievance_sla", clock.id,
                   actor_user_id=actor.id, grievance_id=grievance_id)
        self.db.commit()
        self.db.refresh(clock)
        return clock

    def resume_clock(self, actor: User, grievance_id: int) -> GrievanceSla:
        require_dept_flag(self.db, actor.id, "can_manage_sla")
        clock = self.get_clock(actor, grievance_id)
        if clock.clock_status != "paused":
            raise UnprocessableError(f"Clock is {clock.clock_status}; cannot resume")
        now = utcnow()
        if clock.paused_at is not None:
            paused = int((now - clock.paused_at).total_seconds() // 60)
            clock.total_paused_minutes += max(paused, 0)
        clock.paused_at = None
        clock.clock_status = "running"
        clock.updated_at = now
        self.audit("sla_resumed", "grievance_sla", clock.id,
                   actor_user_id=actor.id, grievance_id=grievance_id)
        self.db.commit()
        self.db.refresh(clock)
        return clock

    # --------------------------------------------------------- breach scanner
    def scan_breaches(self) -> int:
        """SLA scanner (LLD §6.3): mark running clocks past due as breached and
        raise a level_1 escalation for each — in one transaction.

        Intended to be called by a background worker / scheduler; also exposed
        via the internal endpoint for manual runs.
        """
        now = utcnow()
        due = self.clocks.list_due(now)
        for clock in due:
            clock.clock_status = "breached"
            clock.breached_at = now
            clock.breach_reason = "Resolution SLA deadline exceeded"
            clock.updated_at = now

            current = self.assignments.current_for_grievance(clock.grievance_id)
            escalation = GrievanceEscalation(
                grievance_id=clock.grievance_id,
                sla_id=clock.id,
                from_department_id=current.department_id if current else None,
                level="level_1",
                reason="Automatic escalation: resolution SLA breached",
            )
            self.escalations.add(escalation)
            self.db.flush()
            self.audit("sla_breached", "grievance_sla", clock.id,
                       grievance_id=clock.grievance_id,
                       new={"escalation_id": escalation.id})
            if current and current.assigned_to_user_id:
                self.notify(
                    current.assigned_to_user_id,
                    "SLA breached — grievance escalated to level_1",
                    subject="SLA breach",
                    template_key="sla_breach",
                    grievance_id=clock.grievance_id,
                )
        self.db.commit()
        return len(due)

    # ------------------------------------------------------------ escalations
    def list_escalations(
        self,
        actor: User,
        status: Optional[str],
        department_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[GrievanceEscalation]:
        require_dept_flag(self.db, actor.id, "can_manage_grievances")
        return self.escalations.list_inbox(status, department_id, limit, offset)

    def acknowledge_escalation(self, actor: User, escalation_id: int) -> GrievanceEscalation:
        escalation = self.escalations.get_or_404(escalation_id)
        if escalation.status != "pending":
            raise UnprocessableError(f"Escalation is {escalation.status}")
        escalation.status = "acknowledged"
        escalation.acknowledged_at = utcnow()
        self.audit("escalation_acknowledged", "grievance_escalation", escalation.id,
                   actor_user_id=actor.id, grievance_id=escalation.grievance_id)
        self.db.commit()
        self.db.refresh(escalation)
        return escalation

    def resolve_escalation(
        self, actor: User, escalation_id: int, data: EscalationResolveRequest
    ) -> GrievanceEscalation:
        escalation = self.escalations.get_or_404(escalation_id)
        if escalation.status not in ("pending", "acknowledged"):
            raise UnprocessableError(f"Escalation is {escalation.status}")
        escalation.status = "resolved"
        escalation.resolved_at = utcnow()
        escalation.resolution_note = data.resolution_note
        self.audit("escalation_resolved", "grievance_escalation", escalation.id,
                   actor_user_id=actor.id, grievance_id=escalation.grievance_id)
        self.db.commit()
        self.db.refresh(escalation)
        return escalation

    def dismiss_escalation(
        self, actor: User, escalation_id: int, data: EscalationResolveRequest
    ) -> GrievanceEscalation:
        escalation = self.escalations.get_or_404(escalation_id)
        if escalation.status not in ("pending", "acknowledged"):
            raise UnprocessableError(f"Escalation is {escalation.status}")
        escalation.status = "dismissed"
        escalation.resolved_at = utcnow()
        escalation.resolution_note = data.resolution_note
        self.audit("escalation_dismissed", "grievance_escalation", escalation.id,
                   actor_user_id=actor.id, grievance_id=escalation.grievance_id)
        self.db.commit()
        self.db.refresh(escalation)
        return escalation
