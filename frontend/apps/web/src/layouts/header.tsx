import { useState } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import {
  Bell,
  BriefcaseBusiness,
  Cpu,
  FileClock,
  LogIn,
  LogOut,
  Menu,
  Newspaper,
  Search,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { FreelyLogo } from "@workspace/ui/components/freely-logo"
import { cn } from "@workspace/ui/lib/utils"

import { AiVoiceTicker } from "@/components/ai/ai-voice-ticker"
import { ModeToggle } from "@/components/mode-toggle"
import { useAuth } from "@/hooks/use-auth"

const NAV_ITEMS = [
  {
    to: APP_ROUTES.feed,
    label: "Feed",
    Icon: Newspaper,
    iconClassName: "text-muted-foreground group-hover:text-emerald-400",
    activeIconClassName: "text-emerald-400",
  },
  {
    to: APP_ROUTES.track,
    label: "Track",
    Icon: Search,
    iconClassName: "text-muted-foreground group-hover:text-sky-400",
    activeIconClassName: "text-sky-400",
  },
  {
    to: APP_ROUTES.jobs.list,
    label: "Jobs",
    Icon: BriefcaseBusiness,
    iconClassName: "text-muted-foreground group-hover:text-amber-400",
    activeIconClassName: "text-amber-400",
  },
] as const

const AUTH_NAV_ITEMS = [
  {
    to: APP_ROUTES.grievances.mine,
    label: "Grievances",
    Icon: FileClock,
    iconClassName: "text-muted-foreground group-hover:text-orange-400",
    activeIconClassName: "text-orange-400",
  },
  {
    to: APP_ROUTES.notifications,
    label: "Notifications",
    Icon: Bell,
    iconClassName: "text-muted-foreground group-hover:text-rose-400",
    activeIconClassName: "text-rose-400",
  },
  {
    to: APP_ROUTES.profile,
    label: "Profile",
    Icon: UserRound,
    iconClassName: "text-muted-foreground group-hover:text-cyan-400",
    activeIconClassName: "text-cyan-400",
  },
] as const

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "group relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-all hover:bg-muted/50 hover:text-foreground",
    isActive
      ? "bg-primary/10 font-semibold text-foreground text-primary"
      : "text-muted-foreground"
  )
}

interface HeaderProps {
  onOpenTelemetry: () => void
}

export function Header({ onOpenTelemetry }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate(APP_ROUTES.home)
  }

  return (
    <>
      <AiVoiceTicker onOpenTelemetry={onOpenTelemetry} />

      <header className="sticky top-0 z-30 border-b bg-white/90 dark:bg-background/90 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Link to={APP_ROUTES.home} className="flex items-center">
              <FreelyLogo />
            </Link>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {({ isActive }) => (
                  <>
                    <item.Icon
                      className={cn(
                        "size-4 transition-colors",
                        isActive ? item.activeIconClassName : item.iconClassName
                      )}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
            {isAuthenticated &&
              AUTH_NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass}>
                  {({ isActive }) => (
                    <>
                      <item.Icon
                        className={cn(
                          "size-4 transition-colors",
                          isActive
                            ? item.activeIconClassName
                            : item.iconClassName
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs font-medium text-muted-foreground lg:inline">
                  @{user?.user_handle}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="h-8 text-xs"
                >
                  <LogOut className="size-3.5" />
                  Log out
                </Button>
              </div>
            ) : (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 text-xs"
                >
                  <Link to={APP_ROUTES.login}>
                    {/* <LogIn className="size-3.5" /> */}
                    Log in
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 text-xs"
                >
                  <Link to={APP_ROUTES.register}>
                    {/* <UserPlus className="size-3.5" /> */}
                    Sign up
                  </Link>
                </Button>
              </div>
            )}

            <ModeToggle />

            <Button
              variant="ghost"
              size="icon"
              className="size-8 md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="animate-in space-y-3 border-t bg-background px-4 py-3 duration-150 slide-in-from-top-2 md:hidden">
            <nav className="flex flex-col space-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={navLinkClass}
                >
                  {({ isActive }) => (
                    <>
                      <item.Icon
                        className={cn(
                          "size-4 transition-colors",
                          isActive
                            ? item.activeIconClassName
                            : item.iconClassName
                        )}
                      />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
              {isAuthenticated &&
                AUTH_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={navLinkClass}
                  >
                    {({ isActive }) => (
                      <>
                        <item.Icon
                          className={cn(
                            "size-4 transition-colors",
                            isActive
                              ? item.activeIconClassName
                              : item.iconClassName
                          )}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
            </nav>

            <div className="flex flex-col gap-2 border-t pt-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  onOpenTelemetry()
                }}
                className="flex items-center justify-between rounded-lg bg-muted/50 p-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                <span className="flex items-center gap-2">
                  <Cpu className="size-3.5 text-primary" />
                  AI Voice Sentinel Status
                </span>
                <Badge
                  variant="outline"
                  className="border-emerald-500/40 text-[10px] text-emerald-600"
                >
                  Online
                </Badge>
              </button>

              {!isAuthenticated && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1 text-xs"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link to={APP_ROUTES.login}>
                      <LogIn className="size-3.5" />
                      Log in
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    asChild
                    className="flex-1 text-xs"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link to={APP_ROUTES.register}>
                      <UserPlus className="size-3.5" />
                      Sign up
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  )
}
