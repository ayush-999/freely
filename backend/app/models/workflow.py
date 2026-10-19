"""Module 5: workflow — assignments, status history and responses."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    String,
    text,
)
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

ASSIGNMENT_STATUSES = ("assigned", "accepted", "transferred", "completed", "cancelled")
RESPONSE_TYPES = (
    "acknowledgement", "clarification_request", "progress_update",
    "resolution", "rejection",
)


class GrievanceAssignment(Base):
    __tablename__ = "grievance_assignments"
    __table_args__ = (
        CheckConstraint(
            f"assignment_status IN ({','.join(repr(v) for v in ASSIGNMENT_STATUSES)})",
            name="CK_grievance_assignments_status",
        ),
        Index("IX_grievance_assignments_grievance", "grievance_id"),
        Index("IX_grievance_assignments_department", "department_id"),
        Index("IX_grievance_assignments_assignee", "assigned_to_user_id"),
        Index("IX_grievance_assignments_status", "assignment_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("departments.id"), nullable=False
    )
    assigned_to_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    assigned_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    assignment_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'assigned'")
    )
    assignment_reason: Mapped[Optional[str]] = mapped_column(String)
    assigned_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    transfer_from_assignment_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_assignments.id")
    )


class GrievanceStatusHistory(Base):
    """Append-only status transitions for a grievance."""

    __tablename__ = "grievance_status_history"
    __table_args__ = (
        Index("IX_grievance_status_history_grievance", "grievance_id"),
        Index("IX_grievance_status_history_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    previous_status: Mapped[Optional[str]] = mapped_column(String(40))
    new_status: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    change_reason: Mapped[Optional[str]] = mapped_column(String)
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class GrievanceResponse(Base):
    __tablename__ = "grievance_responses"
    __table_args__ = (
        CheckConstraint(
            f"response_type IN ({','.join(repr(v) for v in RESPONSE_TYPES)})",
            name="CK_grievance_responses_type",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    assignment_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_assignments.id")
    )
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id"))
    response_type: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    is_public: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    is_final_response: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    related_post_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("posts.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
