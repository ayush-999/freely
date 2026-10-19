"""Module 1 (part): organizations, departments, roles and memberships."""

from __future__ import annotations

from datetime import date, datetime
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

ORGANIZATION_TYPES = (
    "school", "university", "private_organization", "government_organization",
    "ngo", "other",
)
VERIFICATION_STATUSES = ("unverified", "pending", "verified", "rejected")
MEMBERSHIP_STATUSES = ("active", "invited", "suspended", "ended")


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint(
            f"organization_type IN ({','.join(repr(v) for v in ORGANIZATION_TYPES)})",
            name="CK_organizations_type",
        ),
        CheckConstraint(
            f"verification_status IN ({','.join(repr(v) for v in VERIFICATION_STATUSES)})",
            name="CK_organizations_verification",
        ),
        Index("IX_organizations_type", "organization_type"),
        Index("IX_organizations_created_by", "created_by_user_id"),
        Index("IX_organizations_verification", "verification_status"),
        Index("IX_organizations_is_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False, unique=True)
    organization_type: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String)
    website_url: Mapped[Optional[str]] = mapped_column(String(500))
    logo_storage_key: Mapped[Optional[str]] = mapped_column(String(500))
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    address: Mapped[Optional[str]] = mapped_column(String)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[Optional[str]] = mapped_column(String(100))
    created_by_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'unverified'")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class OrganizationRole(Base):
    __tablename__ = "organization_roles"
    __table_args__ = (
        Index("UQ_organization_roles_org_code", "organization_id", "code", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String)
    can_manage_organization: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_manage_departments: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_manage_members: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_manage_organization_posts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (
        CheckConstraint(
            f"membership_status IN ({','.join(repr(v) for v in MEMBERSHIP_STATUSES)})",
            name="CK_org_memberships_status",
        ),
        Index("UQ_org_memberships_org_user", "organization_id", "user_id", unique=True),
        Index("IX_org_memberships_user", "user_id"),
        Index("IX_org_memberships_role", "organization_role_id"),
        Index("IX_org_memberships_status", "membership_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    organization_role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organization_roles.id"), nullable=False
    )
    membership_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'active'")
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    start_date: Mapped[Optional[date]] = mapped_column()
    end_date: Mapped[Optional[date]] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        Index("UQ_departments_org_code", "organization_id", "code", unique=True),
        Index("IX_departments_org", "organization_id"),
        Index("IX_departments_parent", "parent_department_id"),
        Index("IX_departments_is_active", "is_active"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), nullable=False
    )
    parent_department_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("departments.id")
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class DepartmentRole(Base):
    __tablename__ = "department_roles"
    __table_args__ = (
        Index("UQ_department_roles_dept_code", "department_id", "code", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    department_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("departments.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String)
    permission_level: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("10")
    )
    can_manage_members: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_manage_grievances: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_review_ai: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_manage_sla: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    can_audit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class DepartmentMembership(Base):
    __tablename__ = "department_memberships"
    __table_args__ = (
        CheckConstraint(
            f"membership_status IN ({','.join(repr(v) for v in MEMBERSHIP_STATUSES)})",
            name="CK_dept_memberships_status",
        ),
        Index("UQ_dept_memberships_user_dept", "user_id", "department_id", unique=True),
        Index("IX_dept_memberships_dept", "department_id"),
        Index("IX_dept_memberships_role", "department_role_id"),
        Index("IX_dept_memberships_manager", "manager_user_id"),
        Index("IX_dept_memberships_status", "membership_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("departments.id"), nullable=False
    )
    department_role_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("department_roles.id"), nullable=False
    )
    manager_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    job_title: Mapped[Optional[str]] = mapped_column(String(150))
    employee_number: Mapped[Optional[str]] = mapped_column(String(80))
    membership_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'active'")
    )
    start_date: Mapped[Optional[date]] = mapped_column()
    end_date: Mapped[Optional[date]] = mapped_column()
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
