import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  Bell,
  BriefcaseBusiness,
  Cpu,
  House,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
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

import { MORE_ITEMS, MoreMenu } from "./more-menu"
import { NavItemLink, type NavItem } from "./nav-link-item"

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: APP_ROUTES.home,
    label: "Home",
    Icon: House,
    iconClassName: "text-muted-foreground group-hover:text-emerald-400",
    activeIconClassName: "text-emerald-400",
  },
  {
    to: APP_ROUTES.search,
    label: "Search",
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
]

const AUTH_NAV_ITEMS: readonly NavItem[] = [
  {
    to: APP_ROUTES.notifications,
    label: "Notifications",
    Icon: Bell,
    iconClassName: "text-muted-foreground group-hover:text-rose-400",
    activeIconClassName: "text-rose-400",
  },
  {
    to: APP_ROUTES.messaging,
    label: "Messaging",
    Icon: MessageCircle,
    iconClassName: "text-muted-foreground group-hover:text-fuchsia-400",
    activeIconClassName: "text-fuchsia-400",
  },
]

/** Everything the desktop "More" dropdown holds, flattened for the mobile menu. */
const MOBILE_EXTRA_ITEMS: readonly NavItem[] = [
  {
    to: APP_ROUTES.profile,
    label: "Profile",
    Icon: UserRound,
    iconClassName: "text-muted-foreground group-hover:text-cyan-400",
    activeIconClassName: "text-cyan-400",
  },
  ...MORE_ITEMS.map((item) => ({
    ...item,
    iconClassName: "text-muted-foreground group-hover:text-violet-400",
    activeIconClassName: "text-violet-400",
  })),
]

interface HeaderProps {
  onOpenTelemetry: () => void
}

export function Header({ onOpenTelemetry }: HeaderProps) {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate(APP_ROUTES.landing)
  }

  return (
    <>
      <AiVoiceTicker onOpenTelemetry={onOpenTelemetry} />

      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-md transition-all dark:bg-background/90">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <Link to={APP_ROUTES.landing} className="flex items-center">
              <FreelyLogo />
            </Link>
          </div>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavItemLink key={item.to} item={item} />
            ))}
            {isAuthenticated && (
              <>
                {AUTH_NAV_ITEMS.map((item) => (
                  <NavItemLink key={item.to} item={item} />
                ))}
                <MoreMenu onLogout={handleLogout} />
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              // The home page's left card already offers log in / sign up on lg+.
              <div
                className={cn(
                  "hidden items-center gap-1.5 sm:flex",
                  pathname === APP_ROUTES.home && "lg:hidden"
                )}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 text-xs"
                >
                  <Link to={APP_ROUTES.login}>Log in</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 text-xs"
                >
                  <Link to={APP_ROUTES.register}>Sign up</Link>
                </Button>
              </div>
            )}

            {/* Logged-in users switch theme from the More menu on desktop. */}
            <div className={cn(isAuthenticated && "md:hidden")}>
              <ModeToggle />
            </div>

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
                <NavItemLink
                  key={item.to}
                  item={item}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
              {isAuthenticated && (
                <>
                  {AUTH_NAV_ITEMS.map((item) => (
                    <NavItemLink
                      key={item.to}
                      item={item}
                      onClick={() => setMobileMenuOpen(false)}
                    />
                  ))}
                  <div className="my-1 h-px bg-border" />
                  {MOBILE_EXTRA_ITEMS.map((item) => (
                    <NavItemLink
                      key={item.to}
                      item={item}
                      onClick={() => setMobileMenuOpen(false)}
                    />
                  ))}
                </>
              )}
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

              {isAuthenticated ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                >
                  <LogOut className="size-3.5" />
                  Log out
                </Button>
              ) : (
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
