"""Identity service: registration, authentication, profiles, platform roles."""

from app.core.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.core.security import hash_password, verify_password
from app.models.identity import User
from app.repositories.identity_repository import PlatformRoleRepository, UserRepository
from app.schemas.identity import UserRegisterRequest, UserUpdateRequest
from app.services.base import BaseService
from app.services.permissions import require_platform_role
from app.utils import utcnow


class IdentityService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.users = UserRepository(db)
        self.platform_roles = PlatformRoleRepository(db)

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

    def update_me(self, user: User, data: UserUpdateRequest) -> User:
        changes = data.model_dump(exclude_unset=True)
        if not changes:
            return user
        old = {field: getattr(user, field) for field in changes}
        for field, value in changes.items():
            setattr(user, field, value)
        user.updated_at = utcnow()
        self.audit("updated", "user", user.id, actor_user_id=user.id, old=old, new=changes)
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
