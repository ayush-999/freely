"""Generic repository base class (OOP data access)."""

from typing import Generic, Optional, TypeVar

from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    """Shared CRUD primitives; subclasses set ``model`` and add queries."""

    model: type[ModelT]

    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, entity_id: int) -> Optional[ModelT]:
        return self.db.get(self.model, entity_id)

    def get_or_404(self, entity_id: int) -> ModelT:
        from app.core.exceptions import NotFoundError

        entity = self.get(entity_id)
        if entity is None:
            raise NotFoundError(f"{self.model.__name__} {entity_id} not found")
        return entity

    def add(self, entity: ModelT) -> ModelT:
        self.db.add(entity)
        return entity

    def delete(self, entity: ModelT) -> None:
        self.db.delete(entity)

    def flush(self) -> None:
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()
