"""Identity controller: registration, login, profiles, platform roles (LLD §1.3)."""

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
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


@router.post(
    "/users/me/avatar",
    response_model=UserMeResponse,
    summary="Upload profile photo / avatar",
)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    content = await file.read()
    return IdentityService(db).upload_avatar(current, file.filename or "avatar.jpg", content)


@router.delete(
    "/users/me/avatar",
    response_model=UserMeResponse,
    summary="Remove profile photo / avatar",
)
def delete_avatar(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return IdentityService(db).delete_avatar(current)


@router.post(
    "/users/me/cover",
    response_model=UserMeResponse,
    summary="Upload cover photo",
)
async def upload_cover(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    content = await file.read()
    return IdentityService(db).upload_cover(current, file.filename or "cover.jpg", content)


@router.delete(
    "/users/me/cover",
    response_model=UserMeResponse,
    summary="Remove cover photo",
)
def delete_cover(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return IdentityService(db).delete_cover(current)


# NOTE: must stay above /users/{handle} so the literal path wins routing.
@router.get(
    "/users/search",
    response_model=list[UserPublicResponse],
    summary="Search people by handle or name",
)
def search_users(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return IdentityService(db).search_users(q, limit)


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
