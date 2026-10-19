"""Shared utility helpers."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC datetime matching SQL Server SYSUTCDATETIME() semantics."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
