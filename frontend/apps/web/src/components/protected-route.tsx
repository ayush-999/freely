import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"

import { LoadingFallback } from "@/components/loading-fallback"
import { useAuth } from "@/hooks/use-auth"

/** Gate for routes that require an authenticated session. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === "idle" || status === "loading") {
    return <LoadingFallback />
  }
  if (status !== "authenticated") {
    return (
      <Navigate
        to={APP_ROUTES.login}
        replace
        state={{ from: location.pathname }}
      />
    )
  }
  return <>{children}</>
}
