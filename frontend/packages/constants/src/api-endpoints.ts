/**
 * FastAPI route paths, mirroring backend/app/controllers/*.py one-to-one.
 * Everything is served under the API prefix (`/api/v1`), which belongs to the
 * configured base URL of the consuming app (see apps/web/src/config).
 */
export const API_ENDPOINTS = {
  health: {
    liveness: "/health",
    database: "/health/db",
  },
  identity: {
    register: "/users",
    login: "/auth/login",
    me: "/users/me",
    handleAvailability: (handle: string) =>
      `/users/handle-availability?handle=${encodeURIComponent(handle)}`,
    publicProfile: (handle: string) => `/users/${encodeURIComponent(handle)}`,
    grantPlatformRole: (userId: number) =>
      `/admin/users/${userId}/platform-roles`,
  },
  organizations: {
    create: "/organizations",
    bySlug: (slug: string) => `/organizations/${encodeURIComponent(slug)}`,
    update: (organizationId: number) => `/organizations/${organizationId}`,
    departments: (organizationId: number) =>
      `/organizations/${organizationId}/departments`,
    members: (organizationId: number) =>
      `/organizations/${organizationId}/members`,
    departmentMembership: (membershipId: number) =>
      `/department-memberships/${membershipId}`,
  },
  social: {
    posts: "/posts",
    lookupPost: (publicPostId: string) =>
      `/posts/lookup/${encodeURIComponent(publicPostId)}`,
    feed: "/feed",
    post: (postId: number) => `/posts/${postId}`,
    likes: (postId: number) => `/posts/${postId}/likes`,
    bookmarks: (postId: number) => `/posts/${postId}/bookmarks`,
    reposts: (postId: number) => `/posts/${postId}/reposts`,
    comments: (postId: number) => `/posts/${postId}/comments`,
    follow: (userId: number) => `/users/${userId}/follow`,
    moderatePost: (postId: number) => `/moderation/posts/${postId}`,
  },
  grievances: {
    submit: "/grievances",
    track: (trackingNumber: string) =>
      `/grievances/track/${encodeURIComponent(trackingNumber)}`,
    mine: "/grievances/mine",
    departmentQueue: (departmentId: number) =>
      `/departments/${departmentId}/grievances`,
    transitionStatus: (grievanceId: number) =>
      `/grievances/${grievanceId}/status`,
    attachments: (grievanceId: number) =>
      `/grievances/${grievanceId}/attachments`,
    links: (grievanceId: number) => `/grievances/${grievanceId}/links`,
    unlink: (grievanceId: number, postId: number) =>
      `/grievances/${grievanceId}/links/${postId}`,
  },
  workflow: {
    assignments: (grievanceId: number) =>
      `/grievances/${grievanceId}/assignments`,
    accept: (assignmentId: number) => `/assignments/${assignmentId}/accept`,
    transfer: (assignmentId: number) => `/assignments/${assignmentId}/transfer`,
    responses: (grievanceId: number) => `/grievances/${grievanceId}/responses`,
    history: (grievanceId: number) => `/grievances/${grievanceId}/history`,
  },
  ai: {
    trigger: (grievanceId: number) =>
      `/internal/grievances/${grievanceId}/assess`,
    forGrievance: (grievanceId: number) =>
      `/grievances/${grievanceId}/assessments`,
    review: (assessmentId: number) => `/ai-assessments/${assessmentId}/review`,
  },
  sla: {
    policies: "/sla-policies",
    clock: (grievanceId: number) => `/grievances/${grievanceId}/sla`,
    pause: (grievanceId: number) => `/grievances/${grievanceId}/sla/pause`,
    resume: (grievanceId: number) => `/grievances/${grievanceId}/sla/resume`,
    escalations: "/escalations",
    acknowledge: (escalationId: number) =>
      `/escalations/${escalationId}/acknowledge`,
    resolve: (escalationId: number) => `/escalations/${escalationId}/resolve`,
    dismiss: (escalationId: number) => `/escalations/${escalationId}/dismiss`,
    scan: "/internal/sla/scan",
  },
  notifications: {
    list: "/notifications",
    markRead: (notificationId: number) =>
      `/notifications/${notificationId}/read`,
    feedback: (grievanceId: number) => `/grievances/${grievanceId}/feedback`,
    auditLogs: "/audit-logs",
  },
  jobs: {
    create: "/jobs",
    search: "/jobs",
    byPublicId: (publicJobId: string) =>
      `/jobs/${encodeURIComponent(publicJobId)}`,
    publish: (jobId: number) => `/jobs/${jobId}/publish`,
    pause: (jobId: number) => `/jobs/${jobId}/pause`,
    close: (jobId: number) => `/jobs/${jobId}/close`,
    receipts: (jobId: number) => `/jobs/${jobId}/receipts`,
    verifyReceipt: (receiptId: number) => `/job-receipts/${receiptId}/verify`,
    myCandidateProfile: "/candidate-profiles/me",
    apply: (jobId: number) => `/jobs/${jobId}/applications`,
    applicationStatus: (applicationId: number) =>
      `/applications/${applicationId}/status`,
    decisions: (applicationId: number) =>
      `/applications/${applicationId}/decisions`,
    publishDecision: (decisionId: number) => `/decisions/${decisionId}/publish`,
    acknowledgeDecision: (decisionId: number) =>
      `/decisions/${decisionId}/acknowledge`,
    importResult: (applicationId: number) =>
      `/applications/${applicationId}/results`,
    save: (jobId: number) => `/jobs/${jobId}/save`,
  },
} as const
