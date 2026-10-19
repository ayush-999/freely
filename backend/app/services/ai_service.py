"""AI assessment service (LLD §4).

The real model calls go to the external AI service (AI_SERVICE_URL in .env).
A deterministic heuristic fallback keeps the grievance workflow unblocked when
the AI service is unavailable (HLD risk R-3). All AI output is advisory and
gated behind human review (``human_review_required = True`` by default).
"""

from app.core.exceptions import UnprocessableError
from app.models.ai import AIAssessment
from app.models.identity import User
from app.repositories.grievance_repository import (
    GrievanceCategoryRepository,
    GrievanceRepository,
)
from app.schemas.ai import AssessmentReviewRequest
from app.services.base import BaseService
from app.services.permissions import require_dept_flag
from app.utils import utcnow


class AIService(BaseService):
    def __init__(self, db) -> None:
        super().__init__(db)
        self.grievances = GrievanceRepository(db)
        self.categories = GrievanceCategoryRepository(db)

    def trigger_assessment(self, grievance_id: int) -> AIAssessment:
        """Create an assessment row. TODO: call the external AI service at
        settings.ai_service_url; on failure this heuristic result is used so
        the grievance still routes via category defaults."""
        grievance = self.grievances.get_or_404(grievance_id)
        category = self.categories.get(grievance.category_id)

        assessment = AIAssessment(
            grievance_id=grievance.id,
            model_name="freely-stub-heuristic",
            model_version="0.1.0",
            predicted_category_id=grievance.category_id,
            predicted_priority=grievance.priority,
            sentiment_label="neutral",
            summary=grievance.description[:300],
            recommended_department_id=(
                category.default_department_id if category else None
            ),
            recommendation_reason="Fallback routing via category default department",
            human_review_required=True,
        )
        self.db.add(assessment)
        self.db.flush()
        self.audit("ai_assessment_created", "ai_assessment", assessment.id,
                   grievance_id=grievance.id,
                   new={"model_name": assessment.model_name})
        self.db.commit()
        self.db.refresh(assessment)
        return assessment

    def list_for_grievance(self, actor: User, grievance_id: int) -> list[AIAssessment]:
        require_dept_flag(self.db, actor.id, "can_review_ai")
        from sqlalchemy import select

        stmt = (
            select(AIAssessment)
            .where(AIAssessment.grievance_id == grievance_id)
            .order_by(AIAssessment.created_at.desc())
        )
        return list(self.db.scalars(stmt))

    def review(
        self, actor: User, assessment_id: int, data: AssessmentReviewRequest
    ) -> AIAssessment:
        """Human review gate (HLD AD-7): confirm or override AI output.
        Overrides apply to the grievance; the AI row itself stays immutable
        except for the review stamp."""
        require_dept_flag(self.db, actor.id, "can_review_ai")
        assessment = self.db.get(AIAssessment, assessment_id)
        if assessment is None:
            from app.core.exceptions import NotFoundError

            raise NotFoundError("Assessment not found")
        if assessment.reviewed_by_user_id is not None:
            raise UnprocessableError("Assessment has already been reviewed")

        assessment.reviewed_by_user_id = actor.id
        assessment.reviewed_at = utcnow()
        assessment.human_review_required = False

        if not data.approved:
            grievance = self.grievances.get_or_404(assessment.grievance_id)
            changes: dict = {}
            if data.override_category_id is not None:
                changes["category_id"] = data.override_category_id
                grievance.category_id = data.override_category_id
            if data.override_priority is not None:
                changes["priority"] = data.override_priority
                grievance.priority = data.override_priority
            if changes:
                self.audit("ai_assessment_overridden", "grievance", grievance.id,
                           actor_user_id=actor.id, grievance_id=grievance.id,
                           new={**changes, "assessment_id": assessment.id,
                                "note": data.review_note})
        else:
            self.audit("ai_assessment_confirmed", "ai_assessment", assessment.id,
                       actor_user_id=actor.id, grievance_id=assessment.grievance_id)

        self.db.commit()
        self.db.refresh(assessment)
        return assessment
