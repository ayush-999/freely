"""Aggregates every module router under /api/v1."""

from fastapi import APIRouter

from app.controllers import (
    ai_controller,
    grievance_controller,
    health_controller,
    identity_controller,
    job_controller,
    notification_controller,
    organization_controller,
    sla_controller,
    social_controller,
    workflow_controller,
)

api_router = APIRouter()
api_router.include_router(health_controller.router, tags=["health"])
api_router.include_router(identity_controller.router, tags=["identity"])
api_router.include_router(organization_controller.router, tags=["organizations"])
api_router.include_router(social_controller.router, tags=["social"])
api_router.include_router(grievance_controller.router, tags=["grievances"])
api_router.include_router(workflow_controller.router, tags=["workflow"])
api_router.include_router(ai_controller.router, tags=["ai"])
api_router.include_router(sla_controller.router, tags=["sla"])
api_router.include_router(notification_controller.router, tags=["notifications"])
api_router.include_router(job_controller.router, tags=["jobs"])
