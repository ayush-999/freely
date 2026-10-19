"""SLA & escalation repositories."""

from datetime import datetime
from typing import Optional

from sqlalchemy import select

from app.models.sla import GrievanceEscalation, GrievanceSla, SlaPolicy
from app.repositories.base import BaseRepository


class SlaPolicyRepository(BaseRepository[SlaPolicy]):
    model = SlaPolicy

    def resolve_policy(
        self,
        category_id: int,
        department_id: Optional[int],
        priority: str,
        at: datetime,
    ) -> Optional[SlaPolicy]:
        """Most specific active policy wins (LLD §6.1 resolution rule)."""
        stmt = (
            select(SlaPolicy)
            .where(
                SlaPolicy.is_active.is_(True),
                SlaPolicy.priority == priority,
                SlaPolicy.effective_from <= at,
                (SlaPolicy.effective_until.is_(None))
                | (SlaPolicy.effective_until > at),
                (SlaPolicy.category_id.is_(None))
                | (SlaPolicy.category_id == category_id),
                (SlaPolicy.department_id.is_(None))
                | (SlaPolicy.department_id == department_id),
            )
            .order_by(
                SlaPolicy.department_id.isnot(None).desc(),
                SlaPolicy.category_id.isnot(None).desc(),
            )
            .limit(1)
        )
        return self.db.scalar(stmt)

    def list_filtered(
        self,
        department_id: Optional[int],
        category_id: Optional[int],
    ) -> list[SlaPolicy]:
        stmt = select(SlaPolicy)
        if department_id is not None:
            stmt = stmt.where(SlaPolicy.department_id == department_id)
        if category_id is not None:
            stmt = stmt.where(SlaPolicy.category_id == category_id)
        return list(self.db.scalars(stmt.order_by(SlaPolicy.created_at.desc())))


class GrievanceSlaRepository(BaseRepository[GrievanceSla]):
    model = GrievanceSla

    def get_by_grievance(self, grievance_id: int) -> Optional[GrievanceSla]:
        return self.db.scalar(
            select(GrievanceSla).where(GrievanceSla.grievance_id == grievance_id)
        )

    def list_due(self, now: datetime) -> list[GrievanceSla]:
        """Running clocks past their resolution deadline (the SLA scanner query)."""
        stmt = select(GrievanceSla).where(
            GrievanceSla.clock_status == "running",
            GrievanceSla.resolution_due_at.isnot(None),
            GrievanceSla.resolution_due_at < now,
        )
        return list(self.db.scalars(stmt))


class GrievanceEscalationRepository(BaseRepository[GrievanceEscalation]):
    model = GrievanceEscalation

    def list_inbox(
        self,
        status: Optional[str],
        department_id: Optional[int],
        limit: int,
        offset: int,
    ) -> list[GrievanceEscalation]:
        stmt = select(GrievanceEscalation)
        if status:
            stmt = stmt.where(GrievanceEscalation.status == status)
        if department_id is not None:
            stmt = stmt.where(GrievanceEscalation.to_department_id == department_id)
        stmt = stmt.order_by(GrievanceEscalation.triggered_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(stmt))
