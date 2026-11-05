"""Freely API — FastAPI application entry point.

Swagger UI (interactive API testing): /docs
ReDoc: /redoc
"""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.controllers.router import api_router
from app.controllers.chat_controller import validate_chat_runtime
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers

settings = get_settings()
validate_chat_runtime()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Freely — professional social network & microblogging platform with "
        "grievance management and jobs/recruitment. "
        "Register a user, log in via **/api/v1/auth/login**, then click "
        "**Authorize** to test protected endpoints."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(api_router, prefix=settings.api_v1_prefix)

# Serve uploaded static media (profile photos, cover images, feed attachments)
uploads_dir = (Path(__file__).resolve().parents[2] / "uploads").resolve()
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")
