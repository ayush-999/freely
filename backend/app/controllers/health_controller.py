"""Health check endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Liveness probe")
def health() -> dict:
    return {"status": "ok"}


@router.get("/health/db", summary="Database connectivity probe")
def health_db() -> dict:
    from sqlalchemy import text

    from app.core.database import engine

    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
