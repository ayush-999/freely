"""Organization controller (LLD §1.3)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.organization import (
    DepartmentCreateRequest,
    DepartmentMembershipResponse,
    DepartmentMembershipUpdateRequest,
    DepartmentResponse,
    MemberAddRequest,
    MembershipResponse,
    OrganizationCreateRequest,
    OrganizationResponse,
    OrganizationUpdateRequest,
)
from app.services.organization_service import OrganizationService

router = APIRouter()


@router.post(
    "/organizations",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create organization (seeds roles + owner membership in one TX)",
)
def create_organization(
    data: OrganizationCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return OrganizationService(db).create_organization(current, data)


@router.get(
    "/organizations/{slug}",
    response_model=OrganizationResponse,
    summary="Organization profile by slug",
)
def get_organization(slug: str, db: Session = Depends(get_db)):
    return OrganizationService(db).get_by_slug(slug)


@router.patch(
    "/organizations/{organization_id}",
    response_model=OrganizationResponse,
    summary="Update organization (can_manage_organization)",
)
def update_organization(
    organization_id: int,
    data: OrganizationUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return OrganizationService(db).update_organization(current, organization_id, data)


@router.post(
    "/organizations/{organization_id}/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create department (can_manage_departments)",
)
def add_department(
    organization_id: int,
    data: DepartmentCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return OrganizationService(db).add_department(current, organization_id, data)


@router.post(
    "/organizations/{organization_id}/members",
    response_model=MembershipResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite/add a member (can_manage_members)",
)
def add_member(
    organization_id: int,
    data: MemberAddRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return OrganizationService(db).add_member(current, organization_id, data)


@router.patch(
    "/department-memberships/{membership_id}",
    response_model=DepartmentMembershipResponse,
    summary="Change department membership role/status/manager",
)
def update_department_membership(
    membership_id: int,
    data: DepartmentMembershipUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return OrganizationService(db).update_department_membership(
        current, membership_id, data
    )
