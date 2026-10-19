"""Base service with shared audit-trail and notification helpers."""

import json
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.notification import AuditLog, Notification


class BaseService:
    """All services receive a request-scoped SQLAlchemy session.

    Multi-entity writes happen inside a single transaction: services add rows,
    then call ``self.db.commit()`` once at the end of the use case.
    """

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------ audit
    def audit(
        self,
        action: str,
        entity_type: str,
        entity_id: Optional[int] = None,
        *,
        actor_user_id: Optional[int] = None,
        grievance_id: Optional[int] = None,
        old: Optional[dict[str, Any]] = None,
        new: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Append an immutable audit_logs row (LLD §0 audit convention)."""
        self.db.add(
            AuditLog(
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                actor_user_id=actor_user_id,
                grievance_id=grievance_id,
                old_values=json.dumps(old, default=str) if old is not None else None,
                new_values=json.dumps(new, default=str) if new is not None else None,
                ip_address=ip_address,
            )
        )

    # ---------------------------------------------------------- notifications
    def notify(
        self,
        recipient_user_id: int,
        message: str,
        *,
        channel: str = "in_app",
        subject: Optional[str] = None,
        template_key: Optional[str] = None,
        grievance_id: Optional[int] = None,
        post_id: Optional[int] = None,
    ) -> None:
        """Queue a notification row; the dispatcher worker delivers it."""
        self.db.add(
            Notification(
                recipient_user_id=recipient_user_id,
                channel=channel,
                subject=subject,
                message=message,
                template_key=template_key,
                grievance_id=grievance_id,
                post_id=post_id,
            )
        )
