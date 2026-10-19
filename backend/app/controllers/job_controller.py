"""Jobs & recruitment controller (LLD §8.5)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.identity import User
from app.schemas.common import MessageResponse
from app.schemas.job import (
    ApplicationCreateRequest,
    ApplicationResponse,
    ApplicationStatusChangeRequest,
    CandidateProfileResponse,
    CandidateProfileUpdateRequest,
    DecisionCreateRequest,
    DecisionResponse,
    JobCreateRequest,
    JobResponse,
    JobType,
    ReceiptCreateRequest,
    ReceiptResponse,
    ReceiptVerifyRequest,
    ResultImportRequest,
    ResultResponse,
)
from app.services.job_service import JobService

router = APIRouter()


# ------------------------------------------------------------- job postings
@router.post(
    "/jobs",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a job posting (+ government details when job_type=government)",
)
def create_job(
    data: JobCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).create_job(current, data)


@router.get("/jobs", response_model=list[JobResponse], summary="Job search")
def search_jobs(
    type: Optional[JobType] = None,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    q: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return JobService(db).search(type, status_filter, q, limit, offset)


@router.get(
    "/jobs/{public_job_id}",
    response_model=JobResponse,
    summary="Job detail by public ID",
)
def get_job(public_job_id: str, db: Session = Depends(get_db)):
    return JobService(db).get_public(public_job_id)


@router.post("/jobs/{job_id}/publish", response_model=JobResponse, summary="Publish a job")
def publish_job(
    job_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).change_job_status(current, job_id, "publish")


@router.post("/jobs/{job_id}/pause", response_model=JobResponse, summary="Pause a job")
def pause_job(
    job_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).change_job_status(current, job_id, "pause")


@router.post("/jobs/{job_id}/close", response_model=JobResponse, summary="Close a job")
def close_job(
    job_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).change_job_status(current, job_id, "close")


# ------------------------------------------------------------------ receipts
@router.post(
    "/jobs/{job_id}/receipts",
    response_model=ReceiptResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record an immutable job receipt event",
)
def record_receipt(
    job_id: int,
    data: ReceiptCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).record_receipt(current, job_id, data)


@router.post(
    "/job-receipts/{receipt_id}/verify",
    response_model=ReceiptResponse,
    summary="Verify / reject a receipt (platform_admin)",
)
def verify_receipt(
    receipt_id: int,
    data: ReceiptVerifyRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).verify_receipt(current, receipt_id, data)


# --------------------------------------------------------- candidate profiles
@router.get(
    "/candidate-profiles/me",
    response_model=CandidateProfileResponse,
    summary="My candidate profile",
)
def get_my_profile(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).get_my_profile(current)


@router.patch(
    "/candidate-profiles/me",
    response_model=CandidateProfileResponse,
    summary="Create or update my candidate profile (upsert)",
)
def upsert_my_profile(
    data: CandidateProfileUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).upsert_my_profile(current, data)


# -------------------------------------------------------------- applications
@router.post(
    "/jobs/{job_id}/applications",
    response_model=ApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Apply to a job (TX: application + history + audit + notification)",
)
def apply(
    job_id: int,
    data: ApplicationCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).apply(current, job_id, data)


@router.post(
    "/applications/{application_id}/status",
    response_model=ApplicationResponse,
    summary="Transition application status (visibility-split reasons)",
)
def change_application_status(
    application_id: int,
    data: ApplicationStatusChangeRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).change_application_status(current, application_id, data)


# ----------------------------------------------------------------- decisions
@router.post(
    "/applications/{application_id}/decisions",
    response_model=DecisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record a decision (internal notes never exposed to candidates)",
)
def create_decision(
    application_id: int,
    data: DecisionCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).create_decision(current, application_id, data)


@router.post(
    "/decisions/{decision_id}/publish",
    response_model=DecisionResponse,
    summary="Publish an official decision to the candidate",
)
def publish_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).publish_decision(current, decision_id)


@router.post(
    "/decisions/{decision_id}/acknowledge",
    response_model=MessageResponse,
    summary="Candidate acknowledges a published decision",
)
def acknowledge_decision(
    decision_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    JobService(db).acknowledge_decision(current, decision_id)
    return MessageResponse(message="Decision acknowledged")


# ------------------------------------------------------------------- results
@router.post(
    "/applications/{application_id}/results",
    response_model=ResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Import a stage-wise government result (trusted source / platform_admin)",
)
def import_result(
    application_id: int,
    data: ResultImportRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    return JobService(db).import_result(current, application_id, data)


# ---------------------------------------------------------------- saved jobs
@router.post("/jobs/{job_id}/save", response_model=MessageResponse, summary="Save / unsave a job")
def toggle_saved_job(
    job_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    saved = JobService(db).toggle_saved_job(current, job_id)
    return MessageResponse(message="saved" if saved else "removed from saved jobs")
