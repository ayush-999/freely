"""Jobs & recruitment repositories."""

from typing import Optional

from sqlalchemy import select

from app.models.job import (
    CandidateProfile,
    JobApplication,
    JobApplicationDecision,
    JobPosting,
    SavedJob,
)
from app.repositories.base import BaseRepository


class JobPostingRepository(BaseRepository[JobPosting]):
    model = JobPosting

    def get_by_public_id(self, public_job_id: str) -> Optional[JobPosting]:
        return self.db.scalar(
            select(JobPosting).where(
                JobPosting.public_job_id == public_job_id,
                JobPosting.deleted_at.is_(None),
            )
        )

    def search(
        self,
        job_type: Optional[str],
        status: Optional[str],
        query: Optional[str],
        limit: int,
        offset: int,
    ) -> list[JobPosting]:
        stmt = select(JobPosting).where(JobPosting.deleted_at.is_(None))
        if job_type:
            stmt = stmt.where(JobPosting.job_type == job_type)
        if status:
            stmt = stmt.where(JobPosting.status == status)
        if query:
            stmt = stmt.where(JobPosting.title.contains(query))
        stmt = stmt.order_by(JobPosting.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(stmt))


class JobApplicationRepository(BaseRepository[JobApplication]):
    model = JobApplication

    def get_by_job_and_applicant(
        self, job_posting_id: int, applicant_user_id: int
    ) -> Optional[JobApplication]:
        return self.db.scalar(
            select(JobApplication).where(
                JobApplication.job_posting_id == job_posting_id,
                JobApplication.applicant_user_id == applicant_user_id,
            )
        )

    def list_for_candidate(self, user_id: int) -> list[JobApplication]:
        stmt = (
            select(JobApplication)
            .where(JobApplication.applicant_user_id == user_id)
            .order_by(JobApplication.applied_at.desc())
        )
        return list(self.db.scalars(stmt))


class JobDecisionRepository(BaseRepository[JobApplicationDecision]):
    model = JobApplicationDecision


class CandidateProfileRepository(BaseRepository[CandidateProfile]):
    model = CandidateProfile


class SavedJobRepository(BaseRepository[SavedJob]):
    model = SavedJob

    def get_pair(self, user_id: int, job_posting_id: int) -> Optional[SavedJob]:
        return self.db.get(SavedJob, (user_id, job_posting_id))
