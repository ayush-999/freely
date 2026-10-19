"""Module 3: grievance categories, grievances and attachments."""

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

GRIEVANCE_STATUSES = (
    "submitted", "acknowledged", "under_review", "assigned", "in_progress",
    "awaiting_citizen", "resolved", "closed", "rejected", "reopened",
)
PRIORITIES = ("low", "medium", "high", "critical")
LINK_TYPES = ("discussion", "official_update", "evidence_context")


class GrievanceCategory(Base):
    __tablename__ = "grievance_categories"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    parent_category_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_categories.id")
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String)
    default_department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )


class Grievance(Base):
    __tablename__ = "grievances"
    __table_args__ = (
        CheckConstraint(
            f"status IN ({','.join(repr(v) for v in GRIEVANCE_STATUSES)})",
            name="CK_grievances_status",
        ),
        CheckConstraint(
            f"priority IN ({','.join(repr(v) for v in PRIORITIES)})",
            name="CK_grievances_priority",
        ),
        Index("IX_grievances_user", "user_id"),
        Index("IX_grievances_category", "category_id"),
        Index("IX_grievances_status", "status"),
        Index("IX_grievances_priority", "priority"),
        Index("IX_grievances_submitted", "submitted_at"),
        Index("IX_grievances_status_priority", "status", "priority"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tracking_number: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievance_categories.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    location_text: Mapped[Optional[str]] = mapped_column(String)
    address: Mapped[Optional[str]] = mapped_column(String)
    district: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    postal_code: Mapped[Optional[str]] = mapped_column(String(15))
    latitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    status: Mapped[str] = mapped_column(
        String(40), nullable=False, server_default=text("'submitted'")
    )
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'medium'")
    )
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    reopened_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class GrievanceAttachment(Base):
    __tablename__ = "grievance_attachments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    uploaded_by_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[Optional[str]] = mapped_column(String(120))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(BigInteger)
    checksum: Mapped[Optional[str]] = mapped_column(String(128))
    is_evidence: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class PostGrievanceLink(Base):
    __tablename__ = "post_grievance_links"
    __table_args__ = (
        CheckConstraint(
            f"link_type IN ({','.join(repr(v) for v in LINK_TYPES)})",
            name="CK_post_grievance_links_type",
        ),
        Index("IX_post_grievance_links_grievance", "grievance_id"),
        Index("IX_post_grievance_links_created", "created_at"),
    )

    post_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("posts.id"), primary_key=True
    )
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), primary_key=True
    )
    linked_by_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    link_type: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'discussion'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
