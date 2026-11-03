"""Identity service: registration, authentication, profiles, platform roles."""

from pathlib import Path
from typing import Optional

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError, UnprocessableError
from app.core.security import hash_password, verify_password
from app.models.identity import User
from app.repositories.identity_repository import PlatformRoleRepository, UserRepository
from app.schemas.identity import UserRegisterRequest, UserUpdateRequest
from app.services.base import BaseService
from app.services.permissions import require_platform_role
from app.services.storage_service import StorageService
from app.utils import utcnow


class IdentityService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.users = UserRepository(db)
        self.platform_roles = PlatformRoleRepository(db)
        self.storage = StorageService()

    # ------------------------------------------------------------- register
    def register(self, data: UserRegisterRequest) -> User:
        if self.users.handle_exists(data.user_handle):
            raise ConflictError("user_handle is already taken")
        if data.email and self.users.email_exists(data.email):
            raise ConflictError("email is already registered")
        user = User(
            user_handle=data.user_handle,
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            password_hash=hash_password(data.password),
        )
        self.users.add(user)
        self.db.flush()
        self.audit(
            "created", "user", user.id,
            new={"user_handle": user.user_handle},
        )
        self.db.commit()
        self.db.refresh(user)
        return user

    def check_handle_availability(self, handle: str) -> bool:
        """True when ``handle`` is not taken (exact match, same as register)."""
        return not self.users.handle_exists(handle)

    # ------------------------------------------------------------------ auth
    def authenticate(self, identifier: str, password: str) -> User:
        """``identifier`` may be the user_handle or the email address."""
        user = self.users.get_by_handle_or_email(identifier)
        if user is None:
            raise NotFoundError(f'No account found for "{identifier}"')
        if not user.password_hash or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Invalid credentials")
        if not user.is_active:
            raise UnauthorizedError("Account is deactivated")
        return user

    # -------------------------------------------------------------- profiles
    def get_public_profile(self, handle: str) -> User:
        user = self.users.get_by_handle(handle)
        if user is None or not user.is_active:
            raise NotFoundError("User not found")
        return user

    def search_users(self, query: str, limit: int) -> list[User]:
        return self.users.search_active(query.strip().lstrip("@"), limit)

    def update_me(self, user: User, data: UserUpdateRequest) -> User:
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            return user
        old = {field: getattr(user, field) for field in changes}

        # If avatar was changed or cleared, remove old avatar file from storage
        if "avatar_storage_key" in changes and old.get("avatar_storage_key") and old.get("avatar_storage_key") != changes["avatar_storage_key"]:
            self.storage.delete(old.get("avatar_storage_key"))

        # If cover was changed or cleared, remove old cover file from storage
        if "cover_storage_key" in changes and old.get("cover_storage_key") and old.get("cover_storage_key") != changes["cover_storage_key"]:
            self.storage.delete(old.get("cover_storage_key"))

        for field, value in changes.items():
            setattr(user, field, value)
        user.updated_at = utcnow()
        self.audit("updated", "user", user.id, actor_user_id=user.id, old=old, new=changes)
        self.db.commit()
        self.db.refresh(user)
        return user

    def upload_avatar(self, user: User, file_name: str, content: bytes) -> User:
        ext = Path(file_name).suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}:
            raise UnprocessableError("Invalid image format. Allowed: JPG, PNG, WEBP, GIF, SVG")

        # Delete previous avatar from storage if exists
        if user.avatar_storage_key:
            self.storage.delete(user.avatar_storage_key)

        key = self.storage.save(
            directory=f"uploads/profile/{user.id}",
            extension=ext,
            content=content,
            filename_prefix="avatar_",
        )
        user.avatar_storage_key = key
        user.updated_at = utcnow()
        self.audit("updated", "user", user.id, actor_user_id=user.id, new={"avatar_storage_key": key})
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_avatar(self, user: User) -> User:
        if user.avatar_storage_key:
            self.storage.delete(user.avatar_storage_key)
            user.avatar_storage_key = None
            user.updated_at = utcnow()
            self.audit("updated", "user", user.id, actor_user_id=user.id, new={"avatar_storage_key": None})
            self.db.commit()
            self.db.refresh(user)
        return user

    def upload_cover(self, user: User, file_name: str, content: bytes) -> User:
        ext = Path(file_name).suffix.lower()
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}:
            raise UnprocessableError("Invalid image format. Allowed: JPG, PNG, WEBP, GIF, SVG")

        # Delete previous cover from storage if exists
        if user.cover_storage_key:
            self.storage.delete(user.cover_storage_key)

        key = self.storage.save(
            directory=f"uploads/profile/{user.id}",
            extension=ext,
            content=content,
            filename_prefix="cover_",
        )
        user.cover_storage_key = key
        user.updated_at = utcnow()
        self.audit("updated", "user", user.id, actor_user_id=user.id, new={"cover_storage_key": key})
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_cover(self, user: User) -> User:
        if user.cover_storage_key:
            self.storage.delete(user.cover_storage_key)
            user.cover_storage_key = None
            user.updated_at = utcnow()
            self.audit("updated", "user", user.id, actor_user_id=user.id, new={"cover_storage_key": None})
            self.db.commit()
            self.db.refresh(user)
        return user

    # -------------------------------------------------------- platform roles
    def grant_platform_role(self, actor: User, target_user_id: int, role_name: str) -> None:
        require_platform_role(self.db, actor.id, "platform_admin")
        target = self.users.get_or_404(target_user_id)
        self.platform_roles.grant(target.id, role_name, actor.id)
        self.audit(
            "platform_role_granted", "user", target.id,
            actor_user_id=actor.id, new={"role": role_name},
        )
        self.db.commit()
