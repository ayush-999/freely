"""Identity controller: registration, login, profiles, platform roles (LLD §1.3)."""

from fastapi import APIRouter, Depends, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user
from app.models.identity import User
from app.schemas.common import MessageResponse
from app.schemas.identity import (
    HandleAvailabilityResponse,
    PlatformRoleGrantRequest,
    TokenResponse,
    UserMeResponse,
    UserPublicResponse,
    UserRegisterRequest,
    UserUpdateRequest,
)
from app.services.identity_service import IdentityService

router = APIRouter()


@router.post(
    "/users",
    response_model=UserMeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(data: UserRegisterRequest, db: Session = Depends(get_db)):
    return IdentityService(db).register(data)


@router.post(
    "/auth/login",
    response_model=TokenResponse,
    summary="Log in (OAuth2 password flow — use the Swagger Authorize button after)",
)
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    user = IdentityService(db).authenticate(form.username, form.password)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/users/me", response_model=UserMeResponse, summary="My profile")
def read_me(current: User = Depends(get_current_user)):
    return current


@router.patch("/users/me", response_model=UserMeResponse, summary="Update my profile")
def update_me(
    data: UserUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return IdentityService(db).update_me(current, data)


# NOTE: must stay above /users/{handle} so the literal path wins routing.
@router.get(
    "/users/handle-availability",
    response_model=HandleAvailabilityResponse,
    summary="Check whether a user_handle is available",
)
def handle_availability(
    handle: str = Query(min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$"),
    db: Session = Depends(get_db),
):
    available = IdentityService(db).check_handle_availability(handle)
    return HandleAvailabilityResponse(user_handle=handle, available=available)


@router.get(
    "/users/{handle}",
    response_model=UserPublicResponse,
    summary="Public profile by handle",
)
def public_profile(handle: str, db: Session = Depends(get_db)):
    return IdentityService(db).get_public_profile(handle)


@router.post(
    "/admin/users/{user_id}/platform-roles",
    response_model=MessageResponse,
    summary="Grant a platform role (platform_admin only)",
)
def grant_platform_role(
    user_id: int,
    data: PlatformRoleGrantRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    IdentityService(db).grant_platform_role(current, user_id, data.role_name)
    return MessageResponse(message=f"Role '{data.role_name}' granted to user {user_id}")
