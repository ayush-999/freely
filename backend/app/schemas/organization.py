"""Organization / department DTOs."""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

OrganizationType = Literal[
    "school", "university", "private_organization",
    "government_organization", "ngo", "other",
]
MembershipStatus = Literal["active", "invited", "suspended", "ended"]


class OrganizationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: Optional[str] = Field(default=None, max_length=220, pattern=r"^[a-z0-9-]+$")
    organization_type: OrganizationType
    description: Optional[str] = None
    website_url: Optional[str] = Field(default=None, max_length=500)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)


class OrganizationUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    website_url: Optional[str] = Field(default=None, max_length=500)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)


class OrganizationResponse(ORMModel):
    id: int
    name: str
    slug: str
    organization_type: str
    description: Optional[str] = None
    website_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    verification_status: str
    is_active: bool
    created_at: datetime


class DepartmentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Z0-9_-]+$")
    description: Optional[str] = None
    parent_department_id: Optional[int] = None
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=20)


class DepartmentResponse(ORMModel):
    id: int
    organization_id: int
    parent_department_id: Optional[int] = None
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime


class MemberAddRequest(BaseModel):
    """Add or invite a member; role_code must exist for the organization."""

    user_id: int
    role_code: str = Field(min_length=1, max_length=40)
    is_primary: bool = False
    start_date: Optional[date] = None


class MembershipResponse(ORMModel):
    id: int
    organization_id: int
    user_id: int
    organization_role_id: int
    membership_status: str
    is_primary: bool
    created_at: datetime


class DepartmentMembershipUpdateRequest(BaseModel):
    department_role_id: Optional[int] = None
    manager_user_id: Optional[int] = None
    membership_status: Optional[MembershipStatus] = None
    job_title: Optional[str] = Field(default=None, max_length=150)


class DepartmentMembershipResponse(ORMModel):
    id: int
    user_id: int
    department_id: int
    department_role_id: int
    manager_user_id: Optional[int] = None
    job_title: Optional[str] = None
    membership_status: str
    is_primary: bool
    created_at: datetime
