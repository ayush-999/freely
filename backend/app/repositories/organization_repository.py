"""Organization / department repositories."""

from typing import Optional

from sqlalchemy import select

from app.models.organization import (
    Department,
    DepartmentMembership,
    DepartmentRole,
    Organization,
    OrganizationMembership,
    OrganizationRole,
)
from app.repositories.base import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    model = Organization

    def get_by_slug(self, slug: str) -> Optional[Organization]:
        return self.db.scalar(select(Organization).where(Organization.slug == slug))

    def slug_exists(self, slug: str) -> bool:
        return self.get_by_slug(slug) is not None


class OrganizationRoleRepository(BaseRepository[OrganizationRole]):
    model = OrganizationRole

    def get_by_code(self, organization_id: int, code: str) -> Optional[OrganizationRole]:
        return self.db.scalar(
            select(OrganizationRole).where(
                OrganizationRole.organization_id == organization_id,
                OrganizationRole.code == code,
            )
        )


class OrganizationMembershipRepository(BaseRepository[OrganizationMembership]):
    model = OrganizationMembership

    def get_membership(
        self, organization_id: int, user_id: int
    ) -> Optional[OrganizationMembership]:
        return self.db.scalar(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == user_id,
            )
        )


class DepartmentRepository(BaseRepository[Department]):
    model = Department

    def list_by_org(self, organization_id: int) -> list[Department]:
        return list(
            self.db.scalars(
                select(Department).where(Department.organization_id == organization_id)
            )
        )


class DepartmentRoleRepository(BaseRepository[DepartmentRole]):
    model = DepartmentRole

    def get_by_code(self, department_id: int, code: str) -> Optional[DepartmentRole]:
        return self.db.scalar(
            select(DepartmentRole).where(
                DepartmentRole.department_id == department_id,
                DepartmentRole.code == code,
            )
        )


class DepartmentMembershipRepository(BaseRepository[DepartmentMembership]):
    model = DepartmentMembership

    def get_membership(
        self, department_id: int, user_id: int
    ) -> Optional[DepartmentMembership]:
        return self.db.scalar(
            select(DepartmentMembership).where(
                DepartmentMembership.department_id == department_id,
                DepartmentMembership.user_id == user_id,
            )
        )

    def list_by_user(self, user_id: int) -> list[DepartmentMembership]:
        return list(
            self.db.scalars(
                select(DepartmentMembership).where(
                    DepartmentMembership.user_id == user_id,
                    DepartmentMembership.membership_status == "active",
                )
            )
        )
