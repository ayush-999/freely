import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"

import { LoadingFallback } from "@/components/loading-fallback"
import { ProtectedRoute } from "@/components/protected-route"
import { AuthLayout } from "@/layouts/auth-layout"
import { RootLayout } from "@/layouts/root-layout"

// ---------------------------------------------------------------------------
// Route-level code splitting: every page ships in its own chunk and is
// fetched only when the route is first visited.
// ---------------------------------------------------------------------------
const LandingPage = lazy(() =>
  import("@/pages/landing/landing-page").then((module) => ({
    default: module.LandingPage,
  }))
)
const FeedPage = lazy(() =>
  import("@/pages/feed/feed-page").then((module) => ({
    default: module.FeedPage,
  }))
)
const LoginPage = lazy(() =>
  import("@/pages/auth/login-page").then((module) => ({
    default: module.LoginPage,
  }))
)
const RegisterPage = lazy(() =>
  import("@/pages/auth/register-page").then((module) => ({
    default: module.RegisterPage,
  }))
)
const TrackGrievancePage = lazy(() =>
  import("@/pages/grievances/track-grievance-page").then((module) => ({
    default: module.TrackGrievancePage,
  }))
)
const MyGrievancesPage = lazy(() =>
  import("@/pages/grievances/my-grievances-page").then((module) => ({
    default: module.MyGrievancesPage,
  }))
)
const SubmitGrievancePage = lazy(() =>
  import("@/pages/grievances/submit-grievance-page").then((module) => ({
    default: module.SubmitGrievancePage,
  }))
)
const GrievanceDetailPage = lazy(() =>
  import("@/pages/grievances/grievance-detail-page").then((module) => ({
    default: module.GrievanceDetailPage,
  }))
)
const JobsPage = lazy(() =>
  import("@/pages/jobs/jobs-page").then((module) => ({
    default: module.JobsPage,
  }))
)
const JobDetailPage = lazy(() =>
  import("@/pages/jobs/job-detail-page").then((module) => ({
    default: module.JobDetailPage,
  }))
)
const NotificationsPage = lazy(() =>
  import("@/pages/notifications/notifications-page").then((module) => ({
    default: module.NotificationsPage,
  }))
)
const ProfilePage = lazy(() =>
  import("@/pages/profile/profile-page").then((module) => ({
    default: module.ProfilePage,
  }))
)
const OrganizationProfilePage = lazy(() =>
  import("@/pages/organizations/organization-profile-page").then((module) => ({
    default: module.OrganizationProfilePage,
  }))
)
const UserProfilePage = lazy(() =>
  import("@/pages/users/user-profile-page").then((module) => ({
    default: module.UserProfilePage,
  }))
)
const PostLookupPage = lazy(() =>
  import("@/pages/posts/post-lookup-page").then((module) => ({
    default: module.PostLookupPage,
  }))
)
const NotFoundPage = lazy(() =>
  import("@/pages/not-found-page").then((module) => ({
    default: module.NotFoundPage,
  }))
)

/** Wrap a lazily loaded page with a shared suspense fallback. */
function withSuspense(element: ReactNode) {
  return <Suspense fallback={<LoadingFallback />}>{element}</Suspense>
}

/** Wrap a page that requires an authenticated session. */
function protectedPage(element: ReactNode) {
  return withSuspense(<ProtectedRoute>{element}</ProtectedRoute>)
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Public routes
      { path: APP_ROUTES.home, element: withSuspense(<LandingPage />) },
      { path: APP_ROUTES.feed, element: withSuspense(<FeedPage />) },
      { path: APP_ROUTES.track, element: withSuspense(<TrackGrievancePage />) },
      { path: APP_ROUTES.jobs.list, element: withSuspense(<JobsPage />) },
      {
        path: `${APP_ROUTES.jobs.list}/:publicJobId`,
        element: withSuspense(<JobDetailPage />),
      },
      {
        path: "/organizations/:slug",
        element: withSuspense(<OrganizationProfilePage />),
      },
      { path: "/u/:handle", element: withSuspense(<UserProfilePage />) },
      {
        path: "/posts/:publicPostId",
        element: withSuspense(<PostLookupPage />),
      },
      // Protected routes
      {
        path: APP_ROUTES.grievances.mine,
        element: protectedPage(<MyGrievancesPage />),
      },
      {
        path: APP_ROUTES.grievances.new,
        element: protectedPage(<SubmitGrievancePage />),
      },
      {
        path: `${APP_ROUTES.grievances.mine}/:grievanceId`,
        element: protectedPage(<GrievanceDetailPage />),
      },
      {
        path: APP_ROUTES.notifications,
        element: protectedPage(<NotificationsPage />),
      },
      {
        path: APP_ROUTES.profile,
        element: protectedPage(<ProfilePage />),
      },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: APP_ROUTES.login, element: withSuspense(<LoginPage />) },
      { path: APP_ROUTES.register, element: withSuspense(<RegisterPage />) },
    ],
  },
])
