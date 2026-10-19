"""Grievance repositories."""

from typing import Optional

from sqlalchemy import select

from app.models.grievance import Grievance, GrievanceCategory
from app.repositories.base import BaseRepository


class GrievanceRepository(BaseRepository[Grievance]):
    model = Grievance

    def get_by_tracking_number(self, tracking_number: str) -> Optional[Grievance]:
        return self.db.scalar(
            select(Grievance).where(Grievance.tracking_number == tracking_number)
        )

    def list_by_user(
        self, user_id: int, limit: int, offset: int
    ) -> list[Grievance]:
        stmt = (
            select(Grievance)
            .where(Grievance.user_id == user_id)
            .order_by(Grievance.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(stmt))

    def list_department_queue(
        self,
        department_id: int,
        status: Optional[str],
        priority: Optional[str],
        limit: int,
        offset: int,
    ) -> list[Grievance]:
        from app.models.workflow import GrievanceAssignment

        stmt = (
            select(Grievance)
            .join(
                GrievanceAssignment,
                GrievanceAssignment.grievance_id == Grievance.id,
            )
            .where(
                GrievanceAssignment.department_id == department_id,
                GrievanceAssignment.assignment_status.in_(["assigned", "accepted"]),
            )
        )
        if status:
            stmt = stmt.where(Grievance.status == status)
        if priority:
            stmt = stmt.where(Grievance.priority == priority)
        stmt = stmt.order_by(
            Grievance.priority.desc(), Grievance.submitted_at
        ).limit(limit).offset(offset)
        return list(self.db.scalars(stmt).unique())


class GrievanceCategoryRepository(BaseRepository[GrievanceCategory]):
    model = GrievanceCategory

    def get_by_code(self, code: str) -> Optional[GrievanceCategory]:
        return self.db.scalar(
            select(GrievanceCategory).where(GrievanceCategory.code == code)
        )

    def list_active(self) -> list[GrievanceCategory]:
        return list(
            self.db.scalars(
                select(GrievanceCategory).where(GrievanceCategory.is_active.is_(True))
            )
        )
