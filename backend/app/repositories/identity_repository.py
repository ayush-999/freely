"""Identity repositories: users and platform roles."""

from typing import Optional

from sqlalchemy import select

from app.models.identity import PlatformRole, User, UserPlatformRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_handle(self, handle: str) -> Optional[User]:
        return self.db.scalar(select(User).where(User.user_handle == handle))

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.scalar(select(User).where(User.email == email))

    def get_by_handle_or_email(self, identifier: str) -> Optional[User]:
        return self.db.scalar(
            select(User).where(
                (User.user_handle == identifier) | (User.email == identifier)
            )
        )

    def handle_exists(self, handle: str) -> bool:
        return self.get_by_handle(handle) is not None

    def email_exists(self, email: str) -> bool:
        return self.get_by_email(email) is not None


class PlatformRoleRepository(BaseRepository[PlatformRole]):
    model = PlatformRole

    def get_by_name(self, name: str) -> Optional[PlatformRole]:
        return self.db.scalar(select(PlatformRole).where(PlatformRole.name == name))

    def user_has_role(self, user_id: int, role_name: str) -> bool:
        stmt = (
            select(UserPlatformRole)
            .join(PlatformRole, PlatformRole.id == UserPlatformRole.platform_role_id)
            .where(
                UserPlatformRole.user_id == user_id,
                PlatformRole.name == role_name,
            )
        )
        return self.db.scalar(stmt) is not None

    def grant(self, user_id: int, role_name: str, assigned_by: int) -> None:
        role = self.get_by_name(role_name)
        if role is None:
            from app.core.exceptions import NotFoundError

            raise NotFoundError(f"Platform role '{role_name}' is not seeded")
        existing = self.db.get(UserPlatformRole, (user_id, role.id))
        if existing is None:
            self.db.add(
                UserPlatformRole(
                    user_id=user_id,
                    platform_role_id=role.id,
                    assigned_by_user_id=assigned_by,
                )
            )
