/** Client-side route paths shared by every app in the monorepo. */
export const APP_ROUTES = {
  home: "/",
  feed: "/feed",
  login: "/login",
  register: "/register",
  track: "/track",
  grievances: {
    mine: "/grievances",
    new: "/grievances/new",
    detail: (grievanceId: number | string) => `/grievances/${grievanceId}`,
  },
  jobs: {
    list: "/jobs",
    detail: (publicJobId: string) => `/jobs/${publicJobId}`,
  },
  notifications: "/notifications",
  profile: "/profile",
  organization: (slug: string) => `/organizations/${slug}`,
  user: (handle: string) => `/u/${handle}`,
  post: (publicPostId: string) => `/posts/${publicPostId}`,
} as const
