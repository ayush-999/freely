import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"

import { LoadingFallback } from "@/components/loading-fallback"
import { useAuth } from "@/hooks/use-auth"

/** Keep authenticated users out of the landing and authentication pages. */
export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === "idle" || status === "loading") {
    return <LoadingFallback />
  }
  if (status === "authenticated") {
    return <Navigate to={APP_ROUTES.home} replace />
  }
  return <>{children}</>
}
