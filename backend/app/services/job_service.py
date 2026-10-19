"""Jobs & recruitment service (LLD §8)."""

from typing import Optional

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnprocessableError,
)
from app.models.identity import User
from app.models.job import (
    CandidateProfile,
    GovernmentApplicationResult,
    GovernmentJobDetails,
    JobApplication,
    JobApplicationDecision,
    JobApplicationStatusHistory,
    JobDecisionAcknowledgement,
    JobPosting,
    JobReceipt,
    SavedJob,
)
from app.repositories.job_repository import (
    CandidateProfileRepository,
    JobApplicationRepository,
    JobDecisionRepository,
    JobPostingRepository,
    SavedJobRepository,
)
from app.schemas.job import (
    ApplicationCreateRequest,
    ApplicationStatusChangeRequest,
    CandidateProfileUpdateRequest,
    DecisionCreateRequest,
    JobCreateRequest,
    ReceiptCreateRequest,
    ReceiptVerifyRequest,
    ResultImportRequest,
)
from app.services.base import BaseService
from app.services.permissions import require_platform_role, user_has_platform_role
from app.utils import utcnow
from app.utils.ids import new_public_job_id

# LLD §8.2 job posting state machine.
JOB_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending_review"},
    "pending_review": {"published", "rejected"},
    "published": {"paused", "closed"},
    "paused": {"published"},
    "closed": {"archived"},
}

# LLD §8.3 application status machine.
APPLICATION_TRANSITIONS: dict[str, set[str]] = {
    "submitted": {"under_review", "withdrawn"},
    "under_review": {"shortlisted", "rejected", "withdrawn"},
    "shortlisted": {"interview", "rejected"},
    "interview": {"offered", "rejected"},
    "offered": {"hired", "rejected"},
}


class JobService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.jobs = JobPostingRepository(db)
        self.applications = JobApplicationRepository(db)
        self.decisions = JobDecisionRepository(db)
        self.profiles = CandidateProfileRepository(db)
        self.saved_jobs = SavedJobRepository(db)

    # -------------------------------------------------------------- postings
    def create_job(self, actor: User, data: JobCreateRequest) -> JobPosting:
        job = JobPosting(
            public_job_id=new_public_job_id(),
            job_type=data.job_type,
            organization_id=data.organization_id,
            employer_user_id=data.employer_user_id,
            posted_by_user_id=actor.id,
            title=data.title,
            description=data.description,
            employment_type=data.employment_type,
            experience_level=data.experience_level,
            workplace_type=data.workplace_type,
            city=data.city,
            state=data.state,
            country=data.country,
            salary_min=data.salary_min,
            salary_max=data.salary_max,
            salary_currency=data.salary_currency,
            salary_period=data.salary_period,
            application_method=data.application_method,
            application_url=data.application_url,
            application_email=data.application_email,
            application_deadline=data.application_deadline,
        )
        self.jobs.add(job)
        self.db.flush()

        if data.job_type == "government" and data.government_details is not None:
            self.db.add(
                GovernmentJobDetails(
                    job_id=job.id, **data.government_details.model_dump()
                )
            )
        self.audit("created", "job_posting", job.id, actor_user_id=actor.id,
                   new={"public_job_id": job.public_job_id, "job_type": job.job_type})
        self.db.commit()
        self.db.refresh(job)
        return job

    def search(
        self,
        job_type: Optional[str],
        status: Optional[str],
        query: Optional[str],
        limit: int,
        offset: int,
    ) -> list[JobPosting]:
        return self.jobs.search(job_type, status or "published", query, limit, offset)

    def get_public(self, public_job_id: str) -> JobPosting:
        job = self.jobs.get_by_public_id(public_job_id)
        if job is None:
            raise NotFoundError("Job not found")
        return job

    def _require_owner(self, actor: User, job: JobPosting) -> None:
        """Employer-side check: the poster, an org member, or a platform admin."""
        if job.posted_by_user_id == actor.id:
            return
        if job.employer_user_id == actor.id:
            return
        if user_has_platform_role(self.db, actor.id, "platform_admin"):
            return
        if job.organization_id is not None:
            from sqlalchemy import select

            from app.models.organization import OrganizationMembership

            stmt = select(OrganizationMembership).where(
                OrganizationMembership.organization_id == job.organization_id,
                OrganizationMembership.user_id == actor.id,
                OrganizationMembership.membership_status == "active",
            )
            if self.db.scalar(stmt) is not None:
                return
        raise ForbiddenError("Only the employer can perform this action")

    def change_job_status(self, actor: User, job_id: int, action: str) -> JobPosting:
        job = self.jobs.get_or_404(job_id)
        self._require_owner(actor, job)
        target = {"publish": "published", "pause": "paused", "close": "closed"}[action]
        if target not in JOB_TRANSITIONS.get(job.status, set()):
            raise UnprocessableError(
                f"Cannot {action} a job in status '{job.status}'"
            )
        old = job.status
        job.status = target
        job.updated_at = utcnow()
        if target == "published":
            job.published_at = utcnow()
        self.audit(
            {"published": "published", "paused": "paused", "closed": "closed"}[target],
            "job_posting", job.id, actor_user_id=actor.id,
            old={"status": old}, new={"status": target},
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    # --------------------------------------------------------------- receipts
    def record_receipt(
        self, actor: User, job_id: int, data: ReceiptCreateRequest
    ) -> JobReceipt:
        job = self.jobs.get_or_404(job_id)
        receipt = JobReceipt(
            job_posting_id=job.id,
            source_organization_id=data.source_organization_id,
            received_by_user_id=actor.id,
            source_reference=data.source_reference,
            source_url=data.source_url,
            receipt_batch_id=data.receipt_batch_id,
            receipt_method=data.receipt_method,
        )
        self.db.add(receipt)
        self.db.flush()
        self.audit("receipt_recorded", "job_receipt", receipt.id,
                   actor_user_id=actor.id,
                   new={"job_posting_id": job.id})
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def verify_receipt(
        self, actor: User, receipt_id: int, data: ReceiptVerifyRequest
    ) -> JobReceipt:
        require_platform_role(self.db, actor.id, "platform_admin")
        receipt = self.db.get(JobReceipt, receipt_id)
        if receipt is None:
            raise NotFoundError("Receipt not found")
        old = receipt.verification_status
        receipt.verification_status = "verified" if data.verified else "rejected"
        receipt.verification_notes = data.verification_notes
        self.audit(
            "receipt_verified" if data.verified else "receipt_rejected",
            "job_receipt", receipt.id, actor_user_id=actor.id,
            old={"verification_status": old},
            new={"verification_status": receipt.verification_status},
        )
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    # ----------------------------------------------------- candidate profiles
    def get_my_profile(self, user: User) -> CandidateProfile:
        profile = self.profiles.get(user.id)
        if profile is None:
            raise NotFoundError("Candidate profile not found — create it with PATCH")
        return profile

    def upsert_my_profile(
        self, user: User, data: CandidateProfileUpdateRequest
    ) -> CandidateProfile:
        profile = self.profiles.get(user.id)
        changes = data.model_dump(exclude_unset=True)
        if profile is None:
            profile = CandidateProfile(user_id=user.id)
            self.profiles.add(profile)
        for field, value in changes.items():
            setattr(profile, field, value)
        profile.updated_at = utcnow()
        self.audit("upserted", "candidate_profile", user.id, actor_user_id=user.id,
                   new=changes)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    # ------------------------------------------------------------ applications
    def apply(
        self, user: User, job_id: int, data: ApplicationCreateRequest
    ) -> JobApplication:
        """TX (LLD §9.2): application + status history + audit + notification."""
        job = self.jobs.get_or_404(job_id)
        if job.status != "published":
            raise UnprocessableError("This job is not accepting applications")
        if self.applications.get_by_job_and_applicant(job.id, user.id) is not None:
            raise ConflictError("You have already applied to this job")

        application = JobApplication(
            job_posting_id=job.id,
            applicant_user_id=user.id,
            resume_storage_key=data.resume_storage_key,
            cover_letter=data.cover_letter,
            application_method=job.application_method,
            external_application_reference=data.external_application_reference,
            # External/offline applications must not be assumed submitted.
            submission_status=(
                "submitted" if job.application_method == "platform" else "recorded"
            ),
            status="submitted",
        )
        self.applications.add(application)
        self.db.flush()
        self.db.add(
            JobApplicationStatusHistory(
                application_id=application.id, previous_status=None,
                new_status="submitted", changed_by_user_id=user.id,
                change_reason="Application submitted",
            )
        )
        self.audit("created", "job_application", application.id,
                   actor_user_id=user.id,
                   new={"job_posting_id": job.id, "public_job_id": job.public_job_id})
        self.notify(
            user.id,
            f"Application submitted for '{job.title}'",
            subject="Application submitted",
            template_key="application_submitted",
        )
        self.db.commit()
        self.db.refresh(application)
        return application

    def change_application_status(
        self, actor: User, application_id: int, data: ApplicationStatusChangeRequest
    ) -> JobApplication:
        application = self.applications.get_or_404(application_id)
        job = self.jobs.get_or_404(application.job_posting_id)
        self._require_owner(actor, job)
        if data.new_status not in APPLICATION_TRANSITIONS.get(application.status, set()):
            raise UnprocessableError(
                f"Invalid transition: {application.status} -> {data.new_status}"
            )
        old = application.status
        application.status = data.new_status
        application.updated_at = utcnow()
        if data.new_status == "withdrawn":
            application.withdrawn_at = utcnow()
        self.db.add(
            JobApplicationStatusHistory(
                application_id=application.id, previous_status=old,
                new_status=data.new_status, changed_by_user_id=actor.id,
                change_reason=data.change_reason, reason_code=data.reason_code,
                candidate_visible_reason=data.candidate_visible_reason,
                internal_notes=data.internal_notes,
                is_candidate_visible=data.is_candidate_visible,
            )
        )
        self.audit("application_status_changed", "job_application", application.id,
                   actor_user_id=actor.id, old={"status": old},
                   new={"status": data.new_status})
        self.notify(
            application.applicant_user_id,
            f"Application status: {old} -> {data.new_status}",
            subject="Application status update",
            template_key="application_status",
        )
        self.db.commit()
        self.db.refresh(application)
        return application

    # -------------------------------------------------------------- decisions
    def create_decision(
        self, actor: User, application_id: int, data: DecisionCreateRequest
    ) -> JobApplicationDecision:
        application = self.applications.get_or_404(application_id)
        job = self.jobs.get_or_404(application.job_posting_id)
        self._require_owner(actor, job)
        decision = JobApplicationDecision(
            application_id=application.id,
            decision_type=data.decision_type,
            reason_code=data.reason_code,
            candidate_message=data.candidate_message,
            internal_notes=data.internal_notes,
            decided_by_user_id=actor.id,
            decision_source="employer",
            is_official=data.is_official,
            is_final=data.is_final,
            decision_reference=data.decision_reference,
            decision_at=utcnow(),
        )
        self.decisions.add(decision)
        self.db.flush()
        self.audit("decision_created", "job_application_decision", decision.id,
                   actor_user_id=actor.id,
                   new={"decision_type": data.decision_type})
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def publish_decision(self, actor: User, decision_id: int) -> JobApplicationDecision:
        """Publish only verified/authorized decisions; candidate sees the
        publish-safe message only (HLD AD-9)."""
        decision = self.decisions.get_or_404(decision_id)
        application = self.applications.get_or_404(decision.application_id)
        job = self.jobs.get_or_404(application.job_posting_id)
        self._require_owner(actor, job)
        if not decision.is_official:
            raise UnprocessableError("Only official decisions can be published")
        if decision.published_at is not None:
            raise UnprocessableError("Decision is already published")
        decision.published_at = utcnow()
        self.audit("decision_published", "job_application_decision", decision.id,
                   actor_user_id=actor.id)
        self.notify(
            application.applicant_user_id,
            decision.candidate_message or "A decision was published on your application",
            subject="Application decision",
            template_key="decision_published",
        )
        self.db.commit()
        self.db.refresh(decision)
        return decision

    def acknowledge_decision(self, user: User, decision_id: int) -> None:
        decision = self.decisions.get_or_404(decision_id)
        if decision.published_at is None:
            raise UnprocessableError("Decision is not published yet")
        existing = self.db.get(JobDecisionAcknowledgement, (decision_id, user.id))
        if existing is None:
            self.db.add(
                JobDecisionAcknowledgement(decision_id=decision_id, user_id=user.id)
            )
            self.db.commit()

    # ---------------------------------------------------------------- results
    def import_result(
        self, actor: User, application_id: int, data: ResultImportRequest
    ) -> GovernmentApplicationResult:
        """Stage-wise government results from trusted sources only."""
        require_platform_role(self.db, actor.id, "platform_admin")
        application = self.applications.get_or_404(application_id)
        result = GovernmentApplicationResult(
            application_id=application.id, **data.model_dump()
        )
        self.db.add(result)
        self.db.flush()
        self.audit("result_imported", "government_application_result", result.id,
                   actor_user_id=actor.id,
                   new={"stage": data.recruitment_stage,
                        "result_status": data.result_status})
        self.db.commit()
        self.db.refresh(result)
        return result

    # -------------------------------------------------------------- saved jobs
    def toggle_saved_job(self, user: User, job_id: int) -> bool:
        job = self.jobs.get_or_404(job_id)
        existing = self.saved_jobs.get_pair(user.id, job.id)
        if existing is None:
            self.db.add(SavedJob(user_id=user.id, job_posting_id=job.id))
            saved = True
        else:
            self.db.delete(existing)
            saved = False
        self.db.commit()
        return saved
