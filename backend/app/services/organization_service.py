"""Organization service: orgs, departments, memberships (LLD §1)."""

import re

from sqlalchemy import select

from app.core.exceptions import ConflictError, NotFoundError
from app.models.identity import User
from app.models.organization import (
    Department,
    DepartmentMembership,
    DepartmentRole,
    Organization,
    OrganizationMembership,
    OrganizationRole,
)
from app.repositories.organization_repository import (
    DepartmentMembershipRepository,
    DepartmentRepository,
    DepartmentRoleRepository,
    OrganizationMembershipRepository,
    OrganizationRepository,
    OrganizationRoleRepository,
)
from app.schemas.organization import (
    DepartmentCreateRequest,
    DepartmentMembershipUpdateRequest,
    MemberAddRequest,
    OrganizationCreateRequest,
    OrganizationUpdateRequest,
)
from app.services.base import BaseService
from app.services.permissions import require_org_flag
from app.utils import utcnow

# Seeded on organization creation (LLD §1.2 rule 2). Titles grant no
# privileges — the can_* flags decide.
DEFAULT_ORG_ROLES: list[tuple[str, str, bool, bool, bool, bool]] = [
    # name, code, manage_org, manage_departments, manage_members, manage_posts
    ("Owner", "owner", True, True, True, True),
    ("Organization Admin", "organization_admin", True, True, True, True),
    ("Director", "director", False, True, False, True),
    ("CEO", "ceo", True, False, False, False),
    ("MD", "md", False, False, False, False),
]

DEFAULT_DEPT_ROLES: list[tuple[str, str, int, dict[str, bool]]] = [
    ("Department Head", "department_head", 100,
     {"can_manage_members": True, "can_manage_grievances": True,
      "can_review_ai": True, "can_manage_sla": True, "can_audit": True}),
    ("Grievance Manager", "grievance_manager", 50,
     {"can_manage_grievances": True, "can_manage_sla": True}),
    ("Case Officer", "case_officer", 20, {"can_manage_grievances": True}),
    ("Reviewer", "reviewer", 10, {"can_review_ai": True}),
]


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


class OrganizationService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.orgs = OrganizationRepository(db)
        self.roles = OrganizationRoleRepository(db)
        self.members = OrganizationMembershipRepository(db)
        self.departments = DepartmentRepository(db)
        self.dept_roles = DepartmentRoleRepository(db)
        self.dept_members = DepartmentMembershipRepository(db)

    # --------------------------------------------------------- organizations
    def create_organization(self, creator: User, data: OrganizationCreateRequest) -> Organization:
        slug = data.slug or _slugify(data.name)
        if self.orgs.slug_exists(slug):
            raise ConflictError(f"Organization slug '{slug}' is already taken")
        org = Organization(
            name=data.name,
            slug=slug,
            organization_type=data.organization_type,
            description=data.description,
            website_url=data.website_url,
            contact_email=data.contact_email,
            contact_phone=data.contact_phone,
            address=data.address,
            city=data.city,
            state=data.state,
            country=data.country,
            created_by_user_id=creator.id,
        )
        self.orgs.add(org)
        self.db.flush()

        # Seed default roles and assign the creator as owner — one transaction.
        for name, code, manage_org, manage_depts, manage_members, manage_posts in DEFAULT_ORG_ROLES:
            self.db.add(
                OrganizationRole(
                    organization_id=org.id, name=name, code=code,
                    can_manage_organization=manage_org,
                    can_manage_departments=manage_depts,
                    can_manage_members=manage_members,
                    can_manage_organization_posts=manage_posts,
                )
            )
        self.db.flush()
        owner_role = self.roles.get_by_code(org.id, "owner")
        self.db.add(
            OrganizationMembership(
                organization_id=org.id, user_id=creator.id,
                organization_role_id=owner_role.id, is_primary=True,
            )
        )
        self.audit("created", "organization", org.id, actor_user_id=creator.id,
                   new={"slug": slug})
        self.db.commit()
        self.db.refresh(org)
        return org

    def get_by_slug(self, slug: str) -> Organization:
        org = self.orgs.get_by_slug(slug)
        if org is None or not org.is_active:
            raise NotFoundError("Organization not found")
        return org

    def update_organization(
        self, actor: User, organization_id: int, data: OrganizationUpdateRequest
    ) -> Organization:
        require_org_flag(self.db, actor.id, organization_id, "can_manage_organization")
        org = self.orgs.get_or_404(organization_id)
        changes = data.model_dump(exclude_unset=True)
        old = {field: getattr(org, field) for field in changes}
        for field, value in changes.items():
            setattr(org, field, value)
        org.updated_at = utcnow()
        self.audit("updated", "organization", org.id, actor_user_id=actor.id,
                   old=old, new=changes)
        self.db.commit()
        self.db.refresh(org)
        return org

    # ----------------------------------------------------------- departments
    def add_department(
        self, actor: User, organization_id: int, data: DepartmentCreateRequest
    ) -> Department:
        require_org_flag(self.db, actor.id, organization_id, "can_manage_departments")
        self.orgs.get_or_404(organization_id)
        if data.parent_department_id is not None:
            parent = self.departments.get_or_404(data.parent_department_id)
            if parent.organization_id != organization_id:
                raise ConflictError("Parent department belongs to another organization")
        duplicate = self.db.scalar(
            select(Department.id).where(
                Department.organization_id == organization_id,
                Department.code == data.code,
            )
        )
        if duplicate is not None:
            raise ConflictError(f"Department code '{data.code}' already exists")
        department = Department(
            organization_id=organization_id,
            parent_department_id=data.parent_department_id,
            name=data.name, code=data.code, description=data.description,
            contact_email=data.contact_email, contact_phone=data.contact_phone,
        )
        self.departments.add(department)
        self.db.flush()

        # Seed default department roles (Department Head, Grievance Manager, ...).
        for name, code, level, flags in DEFAULT_DEPT_ROLES:
            self.db.add(
                DepartmentRole(
                    department_id=department.id, name=name, code=code,
                    permission_level=level, **flags,
                )
            )
        self.audit("created", "department", department.id, actor_user_id=actor.id,
                   new={"organization_id": organization_id, "code": data.code})
        self.db.commit()
        self.db.refresh(department)
        return department

    # ------------------------------------------------------------ membership
    def add_member(
        self, actor: User, organization_id: int, data: MemberAddRequest
    ) -> OrganizationMembership:
        require_org_flag(self.db, actor.id, organization_id, "can_manage_members")
        if self.members.get_membership(organization_id, data.user_id) is not None:
            raise ConflictError("User is already a member of this organization")
        role = self.roles.get_by_code(organization_id, data.role_code)
        if role is None:
            raise NotFoundError(f"Organization role '{data.role_code}' not found")
        membership = OrganizationMembership(
            organization_id=organization_id, user_id=data.user_id,
            organization_role_id=role.id, is_primary=data.is_primary,
            start_date=data.start_date, membership_status="invited",
        )
        self.members.add(membership)
        self.db.flush()
        self.audit("member_added", "organization_membership", membership.id,
                   actor_user_id=actor.id,
                   new={"user_id": data.user_id, "role": data.role_code})
        self.notify(data.user_id, f"You were added to organization #{organization_id}")
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def update_department_membership(
        self, actor: User, membership_id: int, data: DepartmentMembershipUpdateRequest
    ) -> DepartmentMembership:
        membership = self.dept_members.get_or_404(membership_id)
        require_org_flag(
            self.db, actor.id,
            self.departments.get_or_404(membership.department_id).organization_id,
            "can_manage_members",
        )
        changes = data.model_dump(exclude_unset=True)
        # LLD §1.2 rule 3: department_role must belong to the membership's department.
        new_role_id = changes.get("department_role_id")
        if new_role_id is not None:
            role = self.dept_roles.get_or_404(new_role_id)
            if role.department_id != membership.department_id:
                raise ConflictError(
                    "department_role_id belongs to a different department"
                )
        old = {field: getattr(membership, field) for field in changes}
        for field, value in changes.items():
            setattr(membership, field, value)
        membership.updated_at = utcnow()
        self.audit("updated", "department_membership", membership.id,
                   actor_user_id=actor.id, old=old, new=changes)
        self.db.commit()
        self.db.refresh(membership)
        return membership
