"""Workflow service: assignments, transfers, responses, history (LLD §5)."""

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.identity import User
from app.models.workflow import GrievanceAssignment, GrievanceResponse
from app.repositories.grievance_repository import GrievanceRepository
from app.repositories.organization_repository import DepartmentRepository
from app.repositories.workflow_repository import (
    AssignmentRepository,
    ResponseRepository,
    StatusHistoryRepository,
)
from app.schemas.grievance import StatusTransitionRequest
from app.schemas.workflow import (
    AssignmentCreateRequest,
    AssignmentTransferRequest,
    ResponseCreateRequest,
)
from app.services.base import BaseService
from app.services.permissions import require_dept_flag
from app.utils import utcnow


class WorkflowService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.grievances = GrievanceRepository(db)
        self.assignments = AssignmentRepository(db)
        self.history = StatusHistoryRepository(db)
        self.responses = ResponseRepository(db)
        self.departments = DepartmentRepository(db)

    # ------------------------------------------------------------ assignment
    def assign(
        self, actor: User, grievance_id: int, data: AssignmentCreateRequest
    ) -> GrievanceAssignment:
        self.departments.get_or_404(data.department_id)
        require_dept_flag(
            self.db, actor.id, "can_manage_grievances", data.department_id
        )
        grievance = self.grievances.get_or_404(grievance_id)

        assignment = GrievanceAssignment(
            grievance_id=grievance.id,
            department_id=data.department_id,
            assigned_to_user_id=data.assigned_to_user_id,
            assigned_by_user_id=actor.id,
            assignment_reason=data.assignment_reason,
        )
        self.assignments.add(assignment)
        self.db.flush()

        if grievance.status in ("submitted", "acknowledged", "under_review"):
            # Reuse the grievance state machine for the -> assigned transition.
            from app.services.grievance_service import GrievanceService

            GrievanceService(self.db).transition_status(
                actor,
                grievance.id,
                StatusTransitionRequest(
                    new_status="assigned",
                    change_reason=data.assignment_reason or "Assigned to department",
                ),
            )

        self.audit("assigned", "grievance_assignment", assignment.id,
                   actor_user_id=actor.id, grievance_id=grievance.id,
                   new={"department_id": data.department_id})
        if data.assigned_to_user_id is not None:
            self.notify(
                data.assigned_to_user_id,
                f"Grievance {grievance.tracking_number} assigned to you",
                subject="New grievance assignment",
                template_key="assignment",
                grievance_id=grievance.id,
            )
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def accept(self, actor: User, assignment_id: int) -> GrievanceAssignment:
        assignment = self.assignments.get_or_404(assignment_id)
        if assignment.assigned_to_user_id != actor.id:
            raise ForbiddenError("Only the assignee can accept this assignment")
        assignment.assignment_status = "accepted"
        assignment.accepted_at = utcnow()
        self.audit("accepted", "grievance_assignment", assignment.id,
                   actor_user_id=actor.id, grievance_id=assignment.grievance_id)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def transfer(
        self, actor: User, assignment_id: int, data: AssignmentTransferRequest
    ) -> GrievanceAssignment:
        """Transfer rule (LLD §5.1): insert a NEW row referencing the old one;
        the old row becomes 'transferred'. Never mutate in place."""
        old = self.assignments.get_or_404(assignment_id)
        self.departments.get_or_404(data.to_department_id)
        require_dept_flag(self.db, actor.id, "can_manage_grievances", old.department_id)

        old.assignment_status = "transferred"
        old.completed_at = utcnow()
        new = GrievanceAssignment(
            grievance_id=old.grievance_id,
            department_id=data.to_department_id,
            assigned_to_user_id=data.assigned_to_user_id,
            assigned_by_user_id=actor.id,
            assignment_reason=data.assignment_reason,
            transfer_from_assignment_id=old.id,
        )
        self.assignments.add(new)
        self.db.flush()
        self.audit("transferred", "grievance_assignment", new.id,
                   actor_user_id=actor.id, grievance_id=old.grievance_id,
                   old={"assignment_id": old.id, "department_id": old.department_id},
                   new={"department_id": data.to_department_id})
        self.db.commit()
        self.db.refresh(new)
        return new

    # ------------------------------------------------------------- responses
    def add_response(
        self, actor: User, grievance_id: int, data: ResponseCreateRequest
    ) -> GrievanceResponse:
        require_dept_flag(self.db, actor.id, "can_manage_grievances")
        grievance = self.grievances.get_or_404(grievance_id)

        response = GrievanceResponse(
            grievance_id=grievance.id,
            assignment_id=data.assignment_id,
            user_id=actor.id,
            response_type=data.response_type,
            message=data.message,
            is_public=data.is_public,
            is_final_response=data.is_final_response,
            related_post_id=data.related_post_id,
        )
        self.responses.add(response)
        self.db.flush()

        # Record first-response actual on the SLA clock.
        from app.repositories.sla_repository import GrievanceSlaRepository

        clock = GrievanceSlaRepository(self.db).get_by_grievance(grievance.id)
        if clock is not None and clock.first_responded_at is None:
            clock.first_responded_at = utcnow()

        if data.is_public:
            self.notify(
                grievance.user_id,
                f"New {data.response_type} on grievance {grievance.tracking_number}",
                subject="Grievance update",
                template_key="grievance_response",
                grievance_id=grievance.id,
            )
        self.audit("response_added", "grievance_response", response.id,
                   actor_user_id=actor.id, grievance_id=grievance.id,
                   new={"response_type": data.response_type})
        self.db.commit()
        self.db.refresh(response)
        return response

    # --------------------------------------------------------------- history
    def get_history(
        self, actor: User, grievance_id: int
    ) -> list:
        """Citizens see public rows only; dept staff see everything."""
        grievance = self.grievances.get_or_404(grievance_id)
        public_only = grievance.user_id != actor.id
        return self.history.list_for_grievance(grievance.id, public_only)

    def get_responses(self, actor: User, grievance_id: int) -> list:
        grievance = self.grievances.get_or_404(grievance_id)
        public_only = grievance.user_id != actor.id
        return self.responses.list_for_grievance(grievance.id, public_only)

    def get_assignments(self, grievance_id: int) -> list:
        self.grievances.get_or_404(grievance_id)
        return self.assignments.list_for_grievance(grievance_id)
