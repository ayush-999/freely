"""Module 6: SLA policies, grievance SLA clocks and escalations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.grievance import PRIORITIES

CLOCK_STATUSES = ("running", "paused", "met", "breached", "stopped")
ESCALATION_LEVELS = ("level_1", "level_2", "level_3")
ESCALATION_STATUSES = ("pending", "acknowledged", "resolved", "dismissed")


class SlaPolicy(Base):
    __tablename__ = "sla_policies"
    __table_args__ = (
        CheckConstraint(
            f"priority IN ({','.join(repr(v) for v in PRIORITIES)})",
            name="CK_sla_policies_priority",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_categories.id")
    )
    department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    priority: Mapped[str] = mapped_column(String(20), nullable=False)
    acknowledgement_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    response_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    working_hours_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    escalation_after_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    effective_from: Mapped[datetime] = mapped_column(DATETIME2, nullable=False)
    effective_until: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class GrievanceSla(Base):
    """One active SLA clock per grievance."""

    __tablename__ = "grievance_sla"
    __table_args__ = (
        CheckConstraint(
            f"clock_status IN ({','.join(repr(v) for v in CLOCK_STATUSES)})",
            name="CK_grievance_sla_clock_status",
        ),
        Index("IX_grievance_sla_grievance", "grievance_id"),
        Index("IX_grievance_sla_resolution_due", "resolution_due_at"),
        Index("IX_grievance_sla_scanner", "clock_status", "resolution_due_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    sla_policy_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("sla_policies.id"), nullable=False
    )
    acknowledgement_due_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    first_response_due_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    resolution_due_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    first_responded_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    actual_resolved_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    clock_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'running'")
    )
    paused_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    total_paused_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    breached_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    breach_reason: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class GrievanceEscalation(Base):
    __tablename__ = "grievance_escalations"
    __table_args__ = (
        CheckConstraint(
            f"level IN ({','.join(repr(v) for v in ESCALATION_LEVELS)})",
            name="CK_grievance_escalations_level",
        ),
        CheckConstraint(
            f"status IN ({','.join(repr(v) for v in ESCALATION_STATUSES)})",
            name="CK_grievance_escalations_status",
        ),
        Index("IX_grievance_escalations_grievance", "grievance_id"),
        Index("IX_grievance_escalations_status", "status"),
        Index("IX_grievance_escalations_triggered", "triggered_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    sla_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_sla.id")
    )
    from_department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    to_department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    assigned_to_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    level: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    resolution_note: Mapped[Optional[str]] = mapped_column(String)
