"""Cryptographically secure public identifiers.

Per HLD AD-5 / LLD conventions: sequential database IDs are never exposed
publicly. Public lookup identifiers are generated here with `secrets`.
"""

import secrets


def new_public_id(prefix: str, nbytes: int = 18) -> str:
    """e.g. ``post_3kR9...`` — URL-safe, high entropy, fits NVARCHAR(40)."""
    return f"{prefix}_{secrets.token_urlsafe(nbytes)}"


def new_public_post_id() -> str:
    return new_public_id("post")


def new_public_job_id() -> str:
    return new_public_id("job")


def new_tracking_number() -> str:
    return new_public_id("GRV", nbytes=12)
