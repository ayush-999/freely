"""Jobs & recruitment DTOs."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORMModel

JobType = Literal["government", "private", "individual", "ngo", "other"]
EmploymentType = Literal["full_time", "part_time", "contract", "internship", "temporary"]
WorkplaceType = Literal["onsite", "hybrid", "remote"]
SalaryPeriod = Literal["hourly", "monthly", "yearly"]
ApplicationMethod = Literal["platform", "external_url", "email", "offline"]
JobStatus = Literal[
    "draft", "pending_review", "published", "paused", "closed", "rejected", "archived",
]
ApplicationStatus = Literal[
    "submitted", "under_review", "shortlisted", "interview", "offered",
    "hired", "rejected", "withdrawn",
]
DecisionType = Literal[
    "selected", "not_selected", "waitlisted", "conditional_offer", "offer",
    "hired", "cancelled", "pending",
]
RecruitmentStage = Literal[
    "application_screening", "written_exam", "prelims", "mains", "interview",
    "skill_test", "document_verification", "merit_list", "waiting_list",
    "final_selection",
]
ResultStatus = Literal[
    "pending", "qualified", "not_qualified", "selected", "not_selected",
    "waitlisted", "absent", "disqualified",
]
ProfileVisibility = Literal["private", "employers", "public"]
ReceiptMethod = Literal["manual", "email", "api", "import", "other"]


class GovernmentDetailsIn(BaseModel):
    recruitment_name: Optional[str] = Field(default=None, max_length=250)
    advertisement_number: Optional[str] = Field(default=None, max_length=100)
    department_name: Optional[str] = Field(default=None, max_length=200)
    post_name: Optional[str] = Field(default=None, max_length=200)
    number_of_vacancies: Optional[int] = Field(default=None, ge=0)
    eligibility_criteria: Optional[str] = None
    minimum_age: Optional[int] = Field(default=None, ge=0)
    maximum_age: Optional[int] = Field(default=None, ge=0)
    educational_qualification: Optional[str] = None
    application_start_at: Optional[datetime] = None
    application_end_at: Optional[datetime] = None
    examination_date: Optional[datetime] = None
    official_notification_url: Optional[str] = Field(default=None, max_length=1000)
    official_application_url: Optional[str] = Field(default=None, max_length=1000)


class JobCreateRequest(BaseModel):
    """Employer XOR: exactly one of organization_id / employer_user_id."""

    job_type: JobType
    organization_id: Optional[int] = None
    employer_user_id: Optional[int] = None
    title: str = Field(min_length=1, max_length=250)
    description: str = Field(min_length=1)
    employment_type: Optional[EmploymentType] = None
    experience_level: Optional[str] = Field(default=None, max_length=30)
    workplace_type: Optional[WorkplaceType] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    salary_min: Optional[float] = Field(default=None, ge=0)
    salary_max: Optional[float] = Field(default=None, ge=0)
    salary_currency: Optional[str] = Field(default=None, max_length=3)
    salary_period: Optional[SalaryPeriod] = None
    application_method: ApplicationMethod = "platform"
    application_url: Optional[str] = Field(default=None, max_length=1000)
    application_email: Optional[str] = Field(default=None, max_length=255)
    application_deadline: Optional[datetime] = None
    government_details: Optional[GovernmentDetailsIn] = None

    @model_validator(mode="after")
    def check_employer_xor(self) -> "JobCreateRequest":
        if (self.organization_id is None) == (self.employer_user_id is None):
            raise ValueError(
                "Exactly one employer owner is required: organization_id or employer_user_id"
            )
        if self.job_type == "government" and self.government_details is None:
            raise ValueError("government_details is required for government jobs")
        return self


class JobResponse(ORMModel):
    id: int
    public_job_id: str
    job_type: str
    organization_id: Optional[int] = None
    employer_user_id: Optional[int] = None
    posted_by_user_id: int
    title: str
    description: str
    employment_type: Optional[str] = None
    workplace_type: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_currency: Optional[str] = None
    salary_period: Optional[str] = None
    application_method: str
    application_url: Optional[str] = None
    application_email: Optional[str] = None
    status: str
    published_at: Optional[datetime] = None
    application_deadline: Optional[datetime] = None
    created_at: datetime


class ReceiptCreateRequest(BaseModel):
    source_organization_id: int
    source_reference: Optional[str] = Field(default=None, max_length=200)
    source_url: Optional[str] = Field(default=None, max_length=1000)
    receipt_batch_id: Optional[str] = Field(default=None, max_length=100)
    receipt_method: Optional[ReceiptMethod] = None


class ReceiptResponse(ORMModel):
    id: int
    job_posting_id: int
    source_organization_id: int
    received_by_user_id: Optional[int] = None
    received_at: datetime
    source_reference: Optional[str] = None
    source_url: Optional[str] = None
    receipt_batch_id: Optional[str] = None
    receipt_method: Optional[str] = None
    verification_status: str


class ReceiptVerifyRequest(BaseModel):
    verified: bool
    verification_notes: Optional[str] = None


class CandidateProfileUpdateRequest(BaseModel):
    headline: Optional[str] = Field(default=None, max_length=250)
    professional_summary: Optional[str] = None
    current_job_title: Optional[str] = Field(default=None, max_length=150)
    total_experience_months: Optional[int] = Field(default=None, ge=0)
    current_city: Optional[str] = Field(default=None, max_length=100)
    current_state: Optional[str] = Field(default=None, max_length=100)
    resume_storage_key: Optional[str] = Field(default=None, max_length=500)
    portfolio_url: Optional[str] = Field(default=None, max_length=1000)
    linkedin_url: Optional[str] = Field(default=None, max_length=1000)
    profile_visibility: Optional[ProfileVisibility] = None


class CandidateProfileResponse(ORMModel):
    user_id: int
    headline: Optional[str] = None
    professional_summary: Optional[str] = None
    current_job_title: Optional[str] = None
    total_experience_months: Optional[int] = None
    current_city: Optional[str] = None
    current_state: Optional[str] = None
    resume_storage_key: Optional[str] = None
    portfolio_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    profile_visibility: str


class ApplicationCreateRequest(BaseModel):
    resume_storage_key: Optional[str] = Field(default=None, max_length=500)
    cover_letter: Optional[str] = None
    external_application_reference: Optional[str] = Field(default=None, max_length=200)


class ApplicationResponse(ORMModel):
    id: int
    job_posting_id: int
    applicant_user_id: int
    submission_status: str
    status: str
    status_source: str
    applied_at: datetime
    withdrawn_at: Optional[datetime] = None


class ApplicationStatusChangeRequest(BaseModel):
    new_status: ApplicationStatus
    change_reason: Optional[str] = None
    reason_code: Optional[str] = Field(default=None, max_length=50)
    candidate_visible_reason: Optional[str] = None
    internal_notes: Optional[str] = None
    is_candidate_visible: bool = True


class DecisionCreateRequest(BaseModel):
    decision_type: DecisionType
    reason_code: Optional[str] = Field(default=None, max_length=50)
    candidate_message: Optional[str] = None
    internal_notes: Optional[str] = None
    is_official: bool = False
    is_final: bool = False
    decision_reference: Optional[str] = Field(default=None, max_length=200)


class DecisionResponse(ORMModel):
    id: int
    application_id: int
    decision_type: str
    reason_code: Optional[str] = None
    candidate_message: Optional[str] = None
    decision_source: str
    is_official: bool
    is_final: bool
    decision_reference: Optional[str] = None
    decision_at: Optional[datetime] = None
    published_at: Optional[datetime] = None


class ResultImportRequest(BaseModel):
    recruitment_stage: RecruitmentStage
    result_status: ResultStatus
    marks_obtained: Optional[float] = None
    maximum_marks: Optional[float] = None
    rank_number: Optional[int] = None
    roll_number: Optional[str] = Field(default=None, max_length=100)
    result_reference: Optional[str] = Field(default=None, max_length=200)
    official_result_url: Optional[str] = Field(default=None, max_length=1000)
    result_document_storage_key: Optional[str] = Field(default=None, max_length=500)
    candidate_message: Optional[str] = None
    is_official: bool = False
    result_date: Optional[datetime] = None


class ResultResponse(ORMModel):
    id: int
    application_id: int
    recruitment_stage: str
    result_status: str
    marks_obtained: Optional[float] = None
    maximum_marks: Optional[float] = None
    rank_number: Optional[int] = None
    roll_number: Optional[str] = None
    result_reference: Optional[str] = None
    official_result_url: Optional[str] = None
    candidate_message: Optional[str] = None
    is_official: bool
    result_date: Optional[datetime] = None
    published_at: Optional[datetime] = None
