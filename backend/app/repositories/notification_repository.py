"""Notification / feedback / audit repositories."""

from typing import Optional

from sqlalchemy import select

from app.models.notification import AuditLog, GrievanceFeedback, Notification
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    model = Notification

    def list_for_user(
        self,
        user_id: int,
        channel: Optional[str],
        limit: int,
        offset: int,
    ) -> list[Notification]:
        stmt = select(Notification).where(Notification.recipient_user_id == user_id)
        if channel:
            stmt = stmt.where(Notification.channel == channel)
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(stmt))


class GrievanceFeedbackRepository(BaseRepository[GrievanceFeedback]):
    model = GrievanceFeedback

    def list_for_grievance(self, grievance_id: int) -> list[GrievanceFeedback]:
        return list(
            self.db.scalars(
                select(GrievanceFeedback)
                .where(GrievanceFeedback.grievance_id == grievance_id)
                .order_by(GrievanceFeedback.created_at)
            )
        )


class AuditLogRepository(BaseRepository[AuditLog]):
    model = AuditLog

    def search(
        self,
        entity_type: Optional[str],
        entity_id: Optional[int],
        grievance_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[AuditLog]:
        stmt = select(AuditLog)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if entity_id is not None:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
        if grievance_id is not None:
            stmt = stmt.where(AuditLog.grievance_id == grievance_id)
        stmt = stmt.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(stmt))
