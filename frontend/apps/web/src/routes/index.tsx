import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"

import { LoadingFallback } from "@/components/loading-fallback"
import { ProtectedRoute } from "@/components/protected-route"
import { GuestOnlyRoute } from "@/components/guest-only-route"
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
const HomePage = lazy(() =>
  import("@/pages/home/home-page").then((module) => ({
    default: module.HomePage,
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
const SearchPage = lazy(() =>
  import("@/pages/search/search-page").then((module) => ({
    default: module.SearchPage,
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
const SavedPage = lazy(() =>
  import("@/pages/saved/saved-page").then((module) => ({
    default: module.SavedPage,
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
const ComingSoonPage = lazy(() =>
  import("@/pages/coming-soon-page").then((module) => ({
    default: module.ComingSoonPage,
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

/** Wrap a page that should only be available to unauthenticated visitors. */
function guestPage(element: ReactNode) {
  return withSuspense(<GuestOnlyRoute>{element}</GuestOnlyRoute>)
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Public routes
      { path: APP_ROUTES.landing, element: guestPage(<LandingPage />) },
      { path: APP_ROUTES.home, element: withSuspense(<HomePage />) },
      { path: APP_ROUTES.search, element: withSuspense(<SearchPage />) },
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
      { path: "/coming-soon", element: withSuspense(<ComingSoonPage />) },
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
        path: APP_ROUTES.saved,
        element: protectedPage(<SavedPage />),
      },
      {
        path: APP_ROUTES.profile,
        element: protectedPage(<ProfilePage />),
      },
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
  {
    element: (
      <GuestOnlyRoute>
        <AuthLayout />
      </GuestOnlyRoute>
    ),
    children: [
      { path: APP_ROUTES.login, element: withSuspense(<LoginPage />) },
      { path: APP_ROUTES.register, element: withSuspense(<RegisterPage />) },
    ],
  },
])
