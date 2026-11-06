/** Client-side route paths shared by every app in the monorepo. */
export const APP_ROUTES = {
  landing: "/",
  home: "/home",
  login: "/login",
  register: "/register",
  track: "/search?tab=grievances",
  search: "/search",
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
  messaging: "/messages",
  messageUser: (handle: string) => `/messages?to=${encodeURIComponent(handle)}`,
  saved: "/saved",
  comingSoon: (feature: string) =>
    `/coming-soon?feature=${encodeURIComponent(feature)}`,
  profile: "/profile",
  organization: (slug: string) => `/organizations/${slug}`,
  user: (handle: string) => `/u/${handle}`,
  hashtag: (tag: string) => `/home?hashtag=${encodeURIComponent(tag)}`,
  post: (publicPostId: string) => `/posts/${publicPostId}`,
} as const
