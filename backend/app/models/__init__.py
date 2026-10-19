"""ORM models (Model layer of MVC) — one module per HLD section.

Importing this package registers every table on ``Base.metadata``.
"""

from app.models.base import Base

from app.models.identity import PlatformRole, User, UserPlatformRole
from app.models.organization import (
    Department,
    DepartmentMembership,
    DepartmentRole,
    Organization,
    OrganizationMembership,
    OrganizationRole,
)
from app.models.social import (
    CommentLike,
    Hashtag,
    Post,
    PostBookmark,
    PostComment,
    PostHashtag,
    PostLike,
    PostMedia,
    PostMention,
    PostRepost,
    PostView,
    UserFollow,
)
from app.models.grievance import (
    Grievance,
    GrievanceAttachment,
    GrievanceCategory,
    PostGrievanceLink,
)
from app.models.ai import AIAssessment
from app.models.workflow import (
    GrievanceAssignment,
    GrievanceResponse,
    GrievanceStatusHistory,
)
from app.models.sla import GrievanceEscalation, GrievanceSla, SlaPolicy
from app.models.notification import AuditLog, GrievanceFeedback, Notification
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

__all__ = [
    "Base",
    # identity
    "User", "PlatformRole", "UserPlatformRole",
    # organization
    "Organization", "OrganizationRole", "OrganizationMembership",
    "Department", "DepartmentRole", "DepartmentMembership",
    # social
    "UserFollow", "Post", "PostMedia", "PostLike", "PostRepost", "PostBookmark",
    "PostComment", "CommentLike", "Hashtag", "PostHashtag", "PostMention", "PostView",
    # grievance
    "GrievanceCategory", "Grievance", "GrievanceAttachment", "PostGrievanceLink",
    # ai
    "AIAssessment",
    # workflow
    "GrievanceAssignment", "GrievanceStatusHistory", "GrievanceResponse",
    # sla
    "SlaPolicy", "GrievanceSla", "GrievanceEscalation",
    # notification
    "Notification", "GrievanceFeedback", "AuditLog",
    # jobs
    "JobPosting", "GovernmentJobDetails", "JobReceipt", "CandidateProfile",
    "JobApplication", "JobApplicationStatusHistory", "JobApplicationDecision",
    "GovernmentApplicationResult", "JobDecisionAcknowledgement", "SavedJob",
]
