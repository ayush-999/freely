import { useEffect, useState } from "react"
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import { ModeToggle } from "@/components/mode-toggle"
import { useAuth } from "@/hooks/use-auth"
import { healthService } from "@/services/health.service"

const NAV_ITEMS = [
  { to: APP_ROUTES.feed, label: "Feed" },
  { to: APP_ROUTES.track, label: "Track" },
  { to: APP_ROUTES.jobs.list, label: "Jobs" },
] as const

const AUTH_NAV_ITEMS = [
  { to: APP_ROUTES.grievances.mine, label: "Grievances" },
  { to: APP_ROUTES.notifications, label: "Notifications" },
  { to: APP_ROUTES.profile, label: "Profile" },
] as const

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "text-sm font-medium transition-colors hover:text-foreground",
    isActive ? "text-foreground" : "text-muted-foreground"
  )
}

export function RootLayout() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [apiOk, setApiOk] = useState<boolean | null>(null)

  useEffect(() => {
    healthService
      .liveness()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false))
  }, [])

  function handleLogout() {
    logout()
    navigate(APP_ROUTES.home)
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-4">
          <Link to={APP_ROUTES.home} className="text-base font-semibold">
            Freely
          </Link>
          <nav className="flex flex-1 items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
            {isAuthenticated &&
              AUTH_NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  @{user?.user_handle}
                </span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={APP_ROUTES.login}>Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to={APP_ROUTES.register}>Sign up</Link>
                </Button>
              </>
            )}
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t py-3">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 text-xs text-muted-foreground">
          <span
            className={cn(
              "size-2 rounded-full",
              apiOk === null && "bg-muted-foreground/40",
              apiOk === true && "bg-emerald-500",
              apiOk === false && "bg-destructive"
            )}
          />
          {apiOk === null && "Checking API…"}
          {apiOk === true && "API connected"}
          {apiOk === false && "API unreachable — is the backend running?"}
        </div>
      </footer>
    </div>
  )
}
