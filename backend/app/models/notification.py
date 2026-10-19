"""Module 7: notifications, grievance feedback and the audit trail."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
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

NOTIFICATION_CHANNELS = ("email", "sms", "in_app", "push")
NOTIFICATION_STATUSES = ("queued", "sent", "delivered", "failed")
FEEDBACK_TYPES = ("satisfaction", "complaint_reopened", "appeal")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            f"channel IN ({','.join(repr(v) for v in NOTIFICATION_CHANNELS)})",
            name="CK_notifications_channel",
        ),
        CheckConstraint(
            f"status IN ({','.join(repr(v) for v in NOTIFICATION_STATUSES)})",
            name="CK_notifications_status",
        ),
        Index("IX_notifications_recipient", "recipient_user_id"),
        Index("IX_notifications_grievance", "grievance_id"),
        Index("IX_notifications_post", "post_id"),
        Index("IX_notifications_status", "status"),
        Index("IX_notifications_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    recipient_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    grievance_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievances.id")
    )
    post_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("posts.id"))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'queued'")
    )
    template_key: Mapped[Optional[str]] = mapped_column(String(100))
    subject: Mapped[Optional[str]] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(String, nullable=False)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(255))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    read_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class GrievanceFeedback(Base):
    __tablename__ = "grievance_feedback"
    __table_args__ = (
        CheckConstraint(
            f"feedback_type IN ({','.join(repr(v) for v in FEEDBACK_TYPES)})",
            name="CK_grievance_feedback_type",
        ),
        CheckConstraint(
            "rating IS NULL OR rating BETWEEN 1 AND 5",
            name="CK_grievance_feedback_rating",
        ),
        Index("IX_grievance_feedback_grievance", "grievance_id"),
        Index("IX_grievance_feedback_user", "user_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("grievances.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    response_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievance_responses.id")
    )
    feedback_type: Mapped[str] = mapped_column(String(40), nullable=False)
    rating: Mapped[Optional[int]] = mapped_column(Integer)
    comments: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class AuditLog(Base):
    """Append-only audit trail; JSON payloads validated with ISJSON()."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        CheckConstraint(
            "old_values IS NULL OR ISJSON(old_values) = 1",
            name="CK_audit_logs_old_values",
        ),
        CheckConstraint(
            "new_values IS NULL OR ISJSON(new_values) = 1",
            name="CK_audit_logs_new_values",
        ),
        Index("IX_audit_logs_grievance", "grievance_id"),
        Index("IX_audit_logs_entity", "entity_type", "entity_id"),
        Index("IX_audit_logs_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    grievance_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("grievances.id")
    )
    actor_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(BigInteger)
    old_values: Mapped[Optional[str]] = mapped_column(String)
    new_values: Mapped[Optional[str]] = mapped_column(String)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
