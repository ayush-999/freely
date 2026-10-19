"""Identity & platform-role DTOs."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel

PlatformRoleName = Literal["platform_admin", "moderation_admin", "auditor"]


class UserRegisterRequest(BaseModel):
    user_handle: str = Field(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    full_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=8, max_length=128)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=20)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class HandleAvailabilityResponse(BaseModel):
    user_handle: str
    available: bool


class UserPublicResponse(ORMModel):
    user_handle: str
    full_name: str
    bio: Optional[str] = None
    avatar_storage_key: Optional[str] = None
    cover_storage_key: Optional[str] = None
    website_url: Optional[str] = None
    is_verified: bool
    created_at: datetime


class UserMeResponse(UserPublicResponse):
    id: int
    email: Optional[str] = None
    phone: Optional[str] = None
    preferred_language: Optional[str] = None


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    bio: Optional[str] = Field(default=None, max_length=500)
    avatar_storage_key: Optional[str] = Field(default=None, max_length=500)
    cover_storage_key: Optional[str] = Field(default=None, max_length=500)
    website_url: Optional[str] = Field(default=None, max_length=500)
    preferred_language: Optional[str] = Field(default=None, max_length=20)


class PlatformRoleGrantRequest(BaseModel):
    role_name: PlatformRoleName
