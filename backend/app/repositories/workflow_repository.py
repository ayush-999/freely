"""Workflow repositories: assignments, status history, responses."""

from typing import Optional

from sqlalchemy import select

from app.models.workflow import (
    GrievanceAssignment,
    GrievanceResponse,
    GrievanceStatusHistory,
)
from app.repositories.base import BaseRepository


class AssignmentRepository(BaseRepository[GrievanceAssignment]):
    model = GrievanceAssignment

    def current_for_grievance(
        self, grievance_id: int
    ) -> Optional[GrievanceAssignment]:
        stmt = (
            select(GrievanceAssignment)
            .where(
                GrievanceAssignment.grievance_id == grievance_id,
                GrievanceAssignment.assignment_status.in_(["assigned", "accepted"]),
            )
            .order_by(GrievanceAssignment.assigned_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

    def list_for_grievance(self, grievance_id: int) -> list[GrievanceAssignment]:
        stmt = (
            select(GrievanceAssignment)
            .where(GrievanceAssignment.grievance_id == grievance_id)
            .order_by(GrievanceAssignment.assigned_at.desc())
        )
        return list(self.db.scalars(stmt))


class StatusHistoryRepository(BaseRepository[GrievanceStatusHistory]):
    model = GrievanceStatusHistory

    def list_for_grievance(
        self, grievance_id: int, public_only: bool
    ) -> list[GrievanceStatusHistory]:
        stmt = select(GrievanceStatusHistory).where(
            GrievanceStatusHistory.grievance_id == grievance_id
        )
        if public_only:
            stmt = stmt.where(GrievanceStatusHistory.is_public.is_(True))
        return list(self.db.scalars(stmt.order_by(GrievanceStatusHistory.created_at)))


class ResponseRepository(BaseRepository[GrievanceResponse]):
    model = GrievanceResponse

    def list_for_grievance(
        self, grievance_id: int, public_only: bool
    ) -> list[GrievanceResponse]:
        stmt = select(GrievanceResponse).where(
            GrievanceResponse.grievance_id == grievance_id
        )
        if public_only:
            stmt = stmt.where(GrievanceResponse.is_public.is_(True))
        return list(self.db.scalars(stmt.order_by(GrievanceResponse.created_at)))
