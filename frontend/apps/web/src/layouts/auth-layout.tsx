import { Link, Outlet } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"

import { ModeToggle } from "@/components/mode-toggle"

/** Centered layout for the authentication pages (login / register). */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <Link to={APP_ROUTES.home} className="text-xl font-semibold">
        Freely
      </Link>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}
