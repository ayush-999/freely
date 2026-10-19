"""Shared DTO helpers."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    """Base DTO that can be built directly from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    message: str


class Page(ORMModel, Generic[T]):
    items: list[T]
    total: int
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
