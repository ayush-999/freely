"""Shared scope/permission helpers (HLD AD-10, LLD §0 scope checks).

DB foreign keys cannot express org/department scope rules, so services call
these helpers before allowing privileged operations.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenError
from app.models.identity import PlatformRole, UserPlatformRole
from app.models.organization import (
    DepartmentMembership,
    DepartmentRole,
    OrganizationMembership,
    OrganizationRole,
)


def user_has_platform_role(db: Session, user_id: int, role_name: str) -> bool:
    stmt = (
        select(UserPlatformRole)
        .join(PlatformRole, PlatformRole.id == UserPlatformRole.platform_role_id)
        .where(UserPlatformRole.user_id == user_id, PlatformRole.name == role_name)
    )
    return db.scalar(stmt) is not None


def require_platform_role(db: Session, user_id: int, role_name: str) -> None:
    if not user_has_platform_role(db, user_id, role_name):
        raise ForbiddenError(f"Platform role '{role_name}' is required")


def require_org_flag(
    db: Session, user_id: int, organization_id: int, flag: str
) -> OrganizationMembership:
    """Require an active org membership whose role grants ``flag``."""
    stmt = (
        select(OrganizationMembership)
        .where(
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.membership_status == "active",
        )
    )
    membership = db.scalar(stmt)
    if membership is None:
        raise ForbiddenError("You are not an active member of this organization")
    role = db.get(OrganizationRole, membership.organization_role_id)
    if role is None or not getattr(role, flag, False):
        raise ForbiddenError(f"Organization permission '{flag}' is required")
    return membership


def user_has_dept_flag(
    db: Session, user_id: int, flag: str, department_id: int | None = None
) -> bool:
    """True when the user holds any active dept membership granting ``flag``."""
    stmt = (
        select(DepartmentRole)
        .join(
            DepartmentMembership,
            DepartmentMembership.department_role_id == DepartmentRole.id,
        )
        .where(
            DepartmentMembership.user_id == user_id,
            DepartmentMembership.membership_status == "active",
        )
    )
    if department_id is not None:
        stmt = stmt.where(DepartmentMembership.department_id == department_id)
    return any(getattr(role, flag, False) for role in db.scalars(stmt))


def require_dept_flag(
    db: Session, user_id: int, flag: str, department_id: int | None = None
) -> None:
    if not user_has_dept_flag(db, user_id, flag, department_id):
        raise ForbiddenError(f"Department permission '{flag}' is required")


def require_any_scope(db: Session, user_id: int, *, dept_flag: str | None = None,
                      platform_role: str | None = None) -> None:
    """Allow when either the dept flag or the platform role is present."""
    if platform_role and user_has_platform_role(db, user_id, platform_role):
        return
    if dept_flag and user_has_dept_flag(db, user_id, dept_flag):
        return
    raise ForbiddenError("Insufficient permissions")
