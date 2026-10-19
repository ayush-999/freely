"""Notification / feedback / audit service (LLD §7)."""

from typing import Optional

from app.core.exceptions import ForbiddenError, NotFoundError, UnprocessableError
from app.models.identity import User
from app.models.notification import AuditLog, GrievanceFeedback, Notification
from app.repositories.grievance_repository import GrievanceRepository
from app.repositories.notification_repository import (
    AuditLogRepository,
    GrievanceFeedbackRepository,
    NotificationRepository,
)
from app.schemas.grievance import StatusTransitionRequest
from app.schemas.notification import FeedbackCreateRequest
from app.services.base import BaseService
from app.services.permissions import user_has_dept_flag, user_has_platform_role
from app.utils import utcnow


class NotificationService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.notifications = NotificationRepository(db)
        self.feedback = GrievanceFeedbackRepository(db)
        self.audit_logs = AuditLogRepository(db)
        self.grievances = GrievanceRepository(db)

    def list_mine(
        self, user: User, channel: Optional[str], limit: int, offset: int
    ) -> list[Notification]:
        return self.notifications.list_for_user(user.id, channel, limit, offset)

    def mark_read(self, user: User, notification_id: int) -> Notification:
        notification = self.notifications.get_or_404(notification_id)
        if notification.recipient_user_id != user.id:
            raise ForbiddenError("Not your notification")
        notification.read_at = utcnow()
        self.db.commit()
        self.db.refresh(notification)
        return notification

    # --------------------------------------------------------------- feedback
    def submit_feedback(
        self, user: User, grievance_id: int, data: FeedbackCreateRequest
    ) -> GrievanceFeedback:
        grievance = self.grievances.get_or_404(grievance_id)
        if grievance.user_id != user.id:
            raise ForbiddenError("Only the grievance owner can submit feedback")

        entry = GrievanceFeedback(
            grievance_id=grievance.id,
            user_id=user.id,
            response_id=data.response_id,
            feedback_type=data.feedback_type,
            rating=data.rating,
            comments=data.comments,
        )
        self.feedback.add(entry)
        self.db.flush()
        self.audit("feedback_submitted", "grievance_feedback", entry.id,
                   actor_user_id=user.id, grievance_id=grievance.id,
                   new={"feedback_type": data.feedback_type, "rating": data.rating})

        # complaint_reopened / appeal trigger the `reopened` transition (LLD §7.1).
        if data.feedback_type in ("complaint_reopened", "appeal"):
            if grievance.status in ("resolved", "closed"):
                from app.services.grievance_service import GrievanceService

                GrievanceService(self.db).transition_status(
                    user,
                    grievance.id,
                    StatusTransitionRequest(
                        new_status="reopened",
                        change_reason=f"Citizen feedback: {data.feedback_type}",
                    ),
                )
            else:
                raise UnprocessableError(
                    f"Grievance is {grievance.status}; only resolved/closed "
                    "grievances can be reopened"
                )

        self.db.commit()
        self.db.refresh(entry)
        return entry

    # ------------------------------------------------------------------ audit
    def search_audit(
        self,
        actor: User,
        entity_type: Optional[str],
        entity_id: Optional[int],
        grievance_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[AuditLog]:
        """Readable with dept `can_audit` or the platform `auditor` role."""
        allowed = user_has_platform_role(self.db, actor.id, "auditor") or (
            user_has_platform_role(self.db, actor.id, "platform_admin")
        ) or user_has_dept_flag(self.db, actor.id, "can_audit")
        if not allowed:
            raise ForbiddenError("Audit access requires can_audit or auditor role")
        return self.audit_logs.search(entity_type, entity_id, grievance_id, limit, offset)
