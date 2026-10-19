"""Grievance service: intake (TX bundle), tracking, state machine (LLD §3)."""

from datetime import timedelta
from typing import Optional

from app.core.exceptions import ForbiddenError, UnprocessableError
from app.models.grievance import (
    Grievance,
    GrievanceAttachment,
    PostGrievanceLink,
)
from app.models.identity import User
from app.models.sla import GrievanceSla
from app.models.workflow import GrievanceStatusHistory
from app.repositories.grievance_repository import (
    GrievanceCategoryRepository,
    GrievanceRepository,
)
from app.repositories.sla_repository import GrievanceSlaRepository, SlaPolicyRepository
from app.repositories.workflow_repository import StatusHistoryRepository
from app.schemas.grievance import (
    AttachmentIn,
    GrievanceCreateRequest,
    GrievanceLinkRequest,
    StatusTransitionRequest,
)
from app.services.base import BaseService
from app.services.permissions import require_dept_flag
from app.utils import utcnow
from app.utils.ids import new_tracking_number

# LLD §3.2 grievance state machine.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "submitted": {"acknowledged", "rejected"},
    "acknowledged": {"under_review"},
    "under_review": {"assigned", "rejected"},
    "assigned": {"in_progress"},
    "in_progress": {"awaiting_citizen", "resolved"},
    "awaiting_citizen": {"in_progress"},
    "resolved": {"closed", "reopened"},
    "reopened": {"in_progress"},
}


class GrievanceService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.grievances = GrievanceRepository(db)
        self.categories = GrievanceCategoryRepository(db)
        self.sla_policies = SlaPolicyRepository(db)
        self.sla_clocks = GrievanceSlaRepository(db)
        self.history = StatusHistoryRepository(db)

    # --------------------------------------------------------------- intake
    def submit(self, user: User, data: GrievanceCreateRequest) -> Grievance:
        """LLD §3.2 'Submit' TX bundle: grievance + attachments + status
        history + SLA clock + audit + notification in a single transaction."""
        category = self.categories.get_or_404(data.category_id)
        now = utcnow()
        grievance = Grievance(
            tracking_number=new_tracking_number(),
            user_id=user.id,
            category_id=category.id,
            title=data.title,
            description=data.description,
            priority=data.priority,
            is_anonymous=data.is_anonymous,
            location_text=data.location_text,
            address=data.address,
            district=data.district,
            state=data.state,
            postal_code=data.postal_code,
            latitude=data.latitude,
            longitude=data.longitude,
        )
        self.grievances.add(grievance)
        self.db.flush()

        for attachment in data.attachments:
            self.db.add(
                GrievanceAttachment(
                    grievance_id=grievance.id, uploaded_by_user_id=user.id,
                    **attachment.model_dump(),
                )
            )

        self.db.add(
            GrievanceStatusHistory(
                grievance_id=grievance.id, previous_status=None,
                new_status="submitted", changed_by_user_id=user.id,
                change_reason="Grievance submitted", is_public=True,
            )
        )

        policy = self.sla_policies.resolve_policy(
            category.id, category.default_department_id, grievance.priority, now
        )
        if policy is not None:
            self.db.add(
                GrievanceSla(
                    grievance_id=grievance.id,
                    sla_policy_id=policy.id,
                    acknowledgement_due_at=now + timedelta(
                        minutes=policy.acknowledgement_minutes
                    ),
                    first_response_due_at=now + timedelta(
                        minutes=policy.response_minutes
                    ),
                    resolution_due_at=now + timedelta(
                        minutes=policy.resolution_minutes
                    ),
                )
            )

        self.audit("created", "grievance", grievance.id, actor_user_id=user.id,
                   grievance_id=grievance.id,
                   new={"tracking_number": grievance.tracking_number})
        self.notify(
            user.id,
            f"Grievance {grievance.tracking_number} submitted",
            subject="Grievance submitted",
            template_key="grievance_submitted",
            grievance_id=grievance.id,
        )
        self.db.commit()
        self.db.refresh(grievance)
        return grievance

    # ------------------------------------------------------------- tracking
    def track(self, tracking_number: str) -> Grievance:
        from app.core.exceptions import NotFoundError

        grievance = self.grievances.get_by_tracking_number(tracking_number)
        if grievance is None:
            raise NotFoundError("Grievance not found")
        return grievance

    def list_mine(self, user: User, limit: int, offset: int) -> list[Grievance]:
        return self.grievances.list_by_user(user.id, limit, offset)

    def department_queue(
        self,
        actor: User,
        department_id: int,
        status: Optional[str],
        priority: Optional[str],
        limit: int,
        offset: int,
    ) -> list[Grievance]:
        require_dept_flag(self.db, actor.id, "can_manage_grievances", department_id)
        return self.grievances.list_department_queue(
            department_id, status, priority, limit, offset
        )

    # --------------------------------------------------------- state machine
    def transition_status(
        self, actor: User, grievance_id: int, data: StatusTransitionRequest
    ) -> Grievance:
        grievance = self.grievances.get_or_404(grievance_id)
        allowed = ALLOWED_TRANSITIONS.get(grievance.status, set())
        if data.new_status not in allowed:
            raise UnprocessableError(
                f"Invalid transition: {grievance.status} -> {data.new_status}"
            )

        now = utcnow()
        old_status = grievance.status
        new_status = data.new_status
        clock = self.sla_clocks.get_by_grievance(grievance.id)

        if new_status == "acknowledged":
            grievance.acknowledged_at = now
        elif new_status == "awaiting_citizen" and clock is not None:
            # Pause the SLA clock while waiting for the citizen.
            clock.clock_status = "paused"
            clock.paused_at = now
        elif new_status == "in_progress" and clock is not None and clock.clock_status == "paused":
            # Resume the clock and accumulate paused minutes.
            if clock.paused_at is not None:
                paused = int((now - clock.paused_at).total_seconds() // 60)
                clock.total_paused_minutes += max(paused, 0)
            clock.paused_at = None
            clock.clock_status = "running"
        elif new_status == "resolved":
            grievance.resolved_at = now
            if clock is not None:
                clock.actual_resolved_at = now
                on_time = (
                    clock.resolution_due_at is not None
                    and now <= clock.resolution_due_at
                )
                clock.clock_status = "met" if on_time else "stopped"
        elif new_status in ("closed", "rejected"):
            if new_status == "closed":
                grievance.closed_at = now
            if clock is not None:
                clock.clock_status = "stopped"
        elif new_status == "reopened":
            grievance.reopened_at = now
            if clock is not None:
                clock.clock_status = "running"
                clock.breached_at = None
                clock.breach_reason = None

        grievance.status = new_status
        grievance.updated_at = now

        self.db.add(
            GrievanceStatusHistory(
                grievance_id=grievance.id, previous_status=old_status,
                new_status=new_status, changed_by_user_id=actor.id,
                change_reason=data.change_reason, is_public=data.is_public,
            )
        )
        self.audit("status_changed", "grievance", grievance.id,
                   actor_user_id=actor.id, grievance_id=grievance.id,
                   old={"status": old_status}, new={"status": new_status})
        self.notify(
            grievance.user_id,
            f"Grievance {grievance.tracking_number}: {old_status} -> {new_status}",
            subject="Grievance status update",
            template_key="grievance_status",
            grievance_id=grievance.id,
        )
        self.db.commit()
        self.db.refresh(grievance)
        return grievance

    # -------------------------------------------------------- evidence/links
    def add_attachment(
        self, actor: User, grievance_id: int, data: AttachmentIn
    ) -> GrievanceAttachment:
        grievance = self.grievances.get_or_404(grievance_id)
        attachment = GrievanceAttachment(
            grievance_id=grievance.id, uploaded_by_user_id=actor.id,
            **data.model_dump(),
        )
        self.db.add(attachment)
        self.db.flush()
        self.audit("attachment_added", "grievance_attachment", attachment.id,
                   actor_user_id=actor.id, grievance_id=grievance.id)
        self.db.commit()
        self.db.refresh(attachment)
        return attachment

    def link_post(
        self, actor: User, grievance_id: int, data: GrievanceLinkRequest
    ) -> None:
        grievance = self.grievances.get_or_404(grievance_id)
        existing = self.db.get(PostGrievanceLink, (data.post_id, grievance.id))
        if existing is not None:
            raise UnprocessableError("Post is already linked to this grievance")
        self.db.add(
            PostGrievanceLink(
                post_id=data.post_id, grievance_id=grievance.id,
                linked_by_user_id=actor.id, link_type=data.link_type,
            )
        )
        self.audit("post_linked", "post_grievance_link", grievance.id,
                   actor_user_id=actor.id, grievance_id=grievance.id,
                   new={"post_id": data.post_id, "link_type": data.link_type})
        self.db.commit()

    def unlink_post(self, actor: User, grievance_id: int, post_id: int) -> None:
        link = self.db.get(PostGrievanceLink, (post_id, grievance_id))
        if link is None:
            from app.core.exceptions import NotFoundError

            raise NotFoundError("Link not found")
        self.db.delete(link)
        self.audit("post_unlinked", "post_grievance_link", grievance_id,
                   actor_user_id=actor.id, grievance_id=grievance_id,
                   old={"post_id": post_id})
        self.db.commit()
