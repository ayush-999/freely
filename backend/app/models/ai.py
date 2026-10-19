"""Module 4: AI assessments of grievances (human review gate by default)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.grievance import PRIORITIES


class AIAssessment(Base):
    __tablename__ = "ai_assessments"
    __table_args__ = (
        CheckConstraint(
            f"predicted_priority IS NULL OR predicted_priority IN "
            f"({','.join(repr(v) for v in PRIORITIES)})",
            name="CK_ai_assessments_priority",
        ),
        Index("IX_ai_assessments_grievance", "grievance_id"),
        Index("IX_ai_assessments_category", "predicted_category_id"),
        Index("IX_ai_assessments_duplicate", "duplicate_of_grievance_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model_version: Mapped[Optional[str]] = mapped_column(String(80))
    predicted_category_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_categories.id")
    )
    predicted_priority: Mapped[Optional[str]] = mapped_column(String(20))
    sentiment_label: Mapped[Optional[str]] = mapped_column(String(40))
    urgency_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4))
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4))
    duplicate_of_grievance_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievances.id")
    )
    summary: Mapped[Optional[str]] = mapped_column(String)
    recommended_department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    recommendation_reason: Mapped[Optional[str]] = mapped_column(String)
    human_review_required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    reviewed_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
