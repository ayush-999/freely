"""Module 8: jobs, recruitment, government vacancies and receipt auditing."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

JOB_TYPES = ("government", "private", "individual", "ngo", "other")
EMPLOYMENT_TYPES = ("full_time", "part_time", "contract", "internship", "temporary")
WORKPLACE_TYPES = ("onsite", "hybrid", "remote")
SALARY_PERIODS = ("hourly", "monthly", "yearly")
APPLICATION_METHODS = ("platform", "external_url", "email", "offline")
JOB_STATUSES = (
    "draft", "pending_review", "published", "paused", "closed", "rejected", "archived",
)
RECEIPT_METHODS = ("manual", "email", "api", "import", "other")
VERIFICATION_STATUSES = ("pending", "verified", "rejected")
PROFILE_VISIBILITIES = ("private", "employers", "public")
SUBMISSION_STATUSES = ("recorded", "submitted", "acknowledged", "failed", "unverified")
STATUS_SOURCES = ("platform", "employer", "government_portal", "manual", "imported")
APPLICATION_STATUSES = (
    "submitted", "under_review", "shortlisted", "interview", "offered",
    "hired", "rejected", "withdrawn",
)
DECISION_TYPES = (
    "selected", "not_selected", "waitlisted", "conditional_offer", "offer",
    "hired", "cancelled", "pending",
)
DECISION_SOURCES = ("employer", "government_portal", "manual", "imported")
RECRUITMENT_STAGES = (
    "application_screening", "written_exam", "prelims", "mains", "interview",
    "skill_test", "document_verification", "merit_list", "waiting_list",
    "final_selection",
)
RESULT_STATUSES = (
    "pending", "qualified", "not_qualified", "selected", "not_selected",
    "waitlisted", "absent", "disqualified",
)


class JobPosting(Base):
    __tablename__ = "job_postings"
    __table_args__ = (
        CheckConstraint(
            f"job_type IN ({','.join(repr(v) for v in JOB_TYPES)})",
            name="CK_job_postings_type",
        ),
        CheckConstraint(
            f"employment_type IS NULL OR employment_type IN "
            f"({','.join(repr(v) for v in EMPLOYMENT_TYPES)})",
            name="CK_job_postings_employment",
        ),
        CheckConstraint(
            f"workplace_type IS NULL OR workplace_type IN "
            f"({','.join(repr(v) for v in WORKPLACE_TYPES)})",
            name="CK_job_postings_workplace",
        ),
        CheckConstraint(
            f"salary_period IS NULL OR salary_period IN "
            f"({','.join(repr(v) for v in SALARY_PERIODS)})",
            name="CK_job_postings_salary_period",
        ),
        CheckConstraint(
            f"application_method IN ({','.join(repr(v) for v in APPLICATION_METHODS)})",
            name="CK_job_postings_method",
        ),
        CheckConstraint(
            f"status IN ({','.join(repr(v) for v in JOB_STATUSES)})",
            name="CK_job_postings_status",
        ),
        # Employer XOR: exactly one of organization_id / employer_user_id.
        CheckConstraint(
            "(organization_id IS NOT NULL AND employer_user_id IS NULL) "
            "OR (organization_id IS NULL AND employer_user_id IS NOT NULL)",
            name="CK_job_postings_employer_xor",
        ),
        Index("IX_job_postings_discovery", "job_type", "status", "published_at"),
        Index("IX_job_postings_organization", "organization_id"),
        Index("IX_job_postings_posted_by", "posted_by_user_id"),
        Index("IX_job_postings_deadline", "application_deadline"),
        Index("IX_job_postings_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    public_job_id: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    job_type: Mapped[str] = mapped_column(String(30), nullable=False)
    organization_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("organizations.id")
    )
    employer_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    posted_by_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    employment_type: Mapped[Optional[str]] = mapped_column(String(30))
    experience_level: Mapped[Optional[str]] = mapped_column(String(30))
    workplace_type: Mapped[Optional[str]] = mapped_column(String(20))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[Optional[str]] = mapped_column(String(100))
    salary_min: Mapped[Optional[float]] = mapped_column(Numeric(18, 2))
    salary_max: Mapped[Optional[float]] = mapped_column(Numeric(18, 2))
    salary_currency: Mapped[Optional[str]] = mapped_column(String(3))
    salary_period: Mapped[Optional[str]] = mapped_column(String(20))
    application_method: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'platform'")
    )
    application_url: Mapped[Optional[str]] = mapped_column(String(1000))
    application_email: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'draft'")
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    application_deadline: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class GovernmentJobDetails(Base):
    """1:1 extension of job_postings for government vacancy fields."""

    __tablename__ = "government_job_details"

    job_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_postings.id"), primary_key=True
    )
    recruitment_name: Mapped[Optional[str]] = mapped_column(String(250))
    advertisement_number: Mapped[Optional[str]] = mapped_column(String(100))
    department_name: Mapped[Optional[str]] = mapped_column(String(200))
    post_name: Mapped[Optional[str]] = mapped_column(String(200))
    number_of_vacancies: Mapped[Optional[int]] = mapped_column(Integer)
    eligibility_criteria: Mapped[Optional[str]] = mapped_column(String)
    minimum_age: Mapped[Optional[int]] = mapped_column(Integer)
    maximum_age: Mapped[Optional[int]] = mapped_column(Integer)
    educational_qualification: Mapped[Optional[str]] = mapped_column(String)
    application_start_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    application_end_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    examination_date: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    official_notification_url: Mapped[Optional[str]] = mapped_column(String(1000))
    official_application_url: Mapped[Optional[str]] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class JobReceipt(Base):
    """Immutable receipt events; updates create new rows."""

    __tablename__ = "job_receipts"
    __table_args__ = (
        CheckConstraint(
            f"receipt_method IS NULL OR receipt_method IN "
            f"({','.join(repr(v) for v in RECEIPT_METHODS)})",
            name="CK_job_receipts_method",
        ),
        CheckConstraint(
            f"verification_status IN ({','.join(repr(v) for v in VERIFICATION_STATUSES)})",
            name="CK_job_receipts_verification",
        ),
        Index("IX_job_receipts_job", "job_posting_id"),
        Index("IX_job_receipts_source_org", "source_organization_id"),
        Index("IX_job_receipts_received", "received_at"),
        Index("IX_job_receipts_source_received", "source_organization_id", "received_at"),
        Index("IX_job_receipts_verification_received", "verification_status", "received_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_posting_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_postings.id"), nullable=False
    )
    source_organization_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("organizations.id"), nullable=False
    )
    received_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    received_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    source_reference: Mapped[Optional[str]] = mapped_column(String(200))
    source_url: Mapped[Optional[str]] = mapped_column(String(1000))
    receipt_batch_id: Mapped[Optional[str]] = mapped_column(String(100))
    receipt_method: Mapped[Optional[str]] = mapped_column(String(30))
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    verification_notes: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"
    __table_args__ = (
        CheckConstraint(
            f"profile_visibility IN ({','.join(repr(v) for v in PROFILE_VISIBILITIES)})",
            name="CK_candidate_profiles_visibility",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    headline: Mapped[Optional[str]] = mapped_column(String(250))
    professional_summary: Mapped[Optional[str]] = mapped_column(String)
    current_job_title: Mapped[Optional[str]] = mapped_column(String(150))
    total_experience_months: Mapped[Optional[int]] = mapped_column(Integer)
    current_city: Mapped[Optional[str]] = mapped_column(String(100))
    current_state: Mapped[Optional[str]] = mapped_column(String(100))
    resume_storage_key: Mapped[Optional[str]] = mapped_column(String(500))
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(1000))
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(1000))
    profile_visibility: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'private'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        CheckConstraint(
            f"application_method IN ({','.join(repr(v) for v in APPLICATION_METHODS)})",
            name="CK_job_applications_method",
        ),
        CheckConstraint(
            f"submission_status IN ({','.join(repr(v) for v in SUBMISSION_STATUSES)})",
            name="CK_job_applications_submission",
        ),
        CheckConstraint(
            f"status_source IN ({','.join(repr(v) for v in STATUS_SOURCES)})",
            name="CK_job_applications_source",
        ),
        CheckConstraint(
            f"status IN ({','.join(repr(v) for v in APPLICATION_STATUSES)})",
            name="CK_job_applications_status",
        ),
        Index(
            "UQ_job_applications_job_applicant",
            "job_posting_id", "applicant_user_id", unique=True,
        ),
        Index("IX_job_applications_applicant", "applicant_user_id"),
        Index("IX_job_applications_job_status", "job_posting_id", "status"),
        Index("IX_job_applications_applied", "applied_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_posting_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_postings.id"), nullable=False
    )
    applicant_user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), nullable=False
    )
    resume_storage_key: Mapped[Optional[str]] = mapped_column(String(500))
    cover_letter: Mapped[Optional[str]] = mapped_column(String)
    application_method: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'platform'")
    )
    external_application_reference: Mapped[Optional[str]] = mapped_column(String(200))
    submission_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'recorded'")
    )
    submission_reference: Mapped[Optional[str]] = mapped_column(String(200))
    submission_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    status_source: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'platform'")
    )
    last_status_verified_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'submitted'")
    )
    applied_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
    withdrawn_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)


class JobApplicationStatusHistory(Base):
    """Append-only application transitions with candidate/internal split."""

    __tablename__ = "job_application_status_history"
    __table_args__ = (
        CheckConstraint(
            f"status_source IN ({','.join(repr(v) for v in STATUS_SOURCES)})",
            name="CK_job_app_history_source",
        ),
        Index("IX_job_app_history_application", "application_id"),
        Index("IX_job_app_history_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_applications.id"), nullable=False
    )
    previous_status: Mapped[Optional[str]] = mapped_column(String(30))
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    change_reason: Mapped[Optional[str]] = mapped_column(String)
    reason_code: Mapped[Optional[str]] = mapped_column(String(50))
    candidate_visible_reason: Mapped[Optional[str]] = mapped_column(String)
    internal_notes: Mapped[Optional[str]] = mapped_column(String)
    status_source: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'platform'")
    )
    is_candidate_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("1")
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class JobApplicationDecision(Base):
    __tablename__ = "job_application_decisions"
    __table_args__ = (
        CheckConstraint(
            f"decision_type IN ({','.join(repr(v) for v in DECISION_TYPES)})",
            name="CK_job_app_decisions_type",
        ),
        CheckConstraint(
            f"decision_source IN ({','.join(repr(v) for v in DECISION_SOURCES)})",
            name="CK_job_app_decisions_source",
        ),
        Index("IX_job_app_decisions_application", "application_id"),
        Index("IX_job_app_decisions_app_decided", "application_id", "decision_at"),
        Index("IX_job_app_decisions_type_final", "decision_type", "is_final"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_applications.id"), nullable=False
    )
    decision_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reason_code: Mapped[Optional[str]] = mapped_column(String(50))
    candidate_message: Mapped[Optional[str]] = mapped_column(String)
    internal_notes: Mapped[Optional[str]] = mapped_column(String)
    decided_by_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("users.id")
    )
    decision_source: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default=text("'manual'")
    )
    is_official: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    is_final: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    decision_reference: Mapped[Optional[str]] = mapped_column(String(200))
    decision_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    published_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class GovernmentApplicationResult(Base):
    __tablename__ = "government_application_results"
    __table_args__ = (
        CheckConstraint(
            f"recruitment_stage IN ({','.join(repr(v) for v in RECRUITMENT_STAGES)})",
            name="CK_gov_results_stage",
        ),
        CheckConstraint(
            f"result_status IN ({','.join(repr(v) for v in RESULT_STATUSES)})",
            name="CK_gov_results_status",
        ),
        Index("IX_gov_results_application", "application_id"),
        Index("IX_gov_results_app_stage", "application_id", "recruitment_stage"),
        Index("IX_gov_results_status", "result_status"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_applications.id"), nullable=False
    )
    recruitment_stage: Mapped[str] = mapped_column(String(50), nullable=False)
    result_status: Mapped[str] = mapped_column(String(30), nullable=False)
    marks_obtained: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    maximum_marks: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    rank_number: Mapped[Optional[int]] = mapped_column(Integer)
    roll_number: Mapped[Optional[str]] = mapped_column(String(100))
    result_reference: Mapped[Optional[str]] = mapped_column(String(200))
    official_result_url: Mapped[Optional[str]] = mapped_column(String(1000))
    result_document_storage_key: Mapped[Optional[str]] = mapped_column(String(500))
    candidate_message: Mapped[Optional[str]] = mapped_column(String)
    is_official: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("0")
    )
    result_date: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    published_at: Mapped[Optional[datetime]] = mapped_column(DATETIME2)
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class JobDecisionAcknowledgement(Base):
    __tablename__ = "job_decision_acknowledgements"

    decision_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_application_decisions.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    acknowledged_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )


class SavedJob(Base):
    __tablename__ = "saved_jobs"
    __table_args__ = (
        Index("IX_saved_jobs_job", "job_posting_id"),
        Index("IX_saved_jobs_created", "created_at"),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id"), primary_key=True
    )
    job_posting_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("job_postings.id"), primary_key=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DATETIME2, nullable=False, server_default=text("SYSUTCDATETIME()")
    )
