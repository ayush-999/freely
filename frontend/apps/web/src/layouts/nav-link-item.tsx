import { Link, useLocation } from "react-router-dom"
import type { LucideIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export interface NavItem {
  to: string
  label: string
  Icon: LucideIcon
  iconClassName: string
  activeIconClassName: string
}

export function navLinkClass(isActive: boolean) {
  return cn(
    "group relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-all hover:bg-muted/50 hover:text-foreground",
    isActive
      ? "bg-primary/10 font-semibold text-foreground text-primary"
      : "text-muted-foreground"
  )
}

/** Returns a matcher; links carrying a query string (e.g. coming-soon) match on it too. */
export function useIsActive() {
  const { pathname, search } = useLocation()

  return (to: string) => {
    const [path, query] = to.split("?")
    if (query !== undefined) return pathname === path && search === `?${query}`
    return pathname === path || pathname.startsWith(`${path}/`)
  }
}

export function NavItemLink({
  item,
  onClick,
  unreadCount = 0,
  iconOnly = false,
}: {
  item: NavItem
  onClick?: () => void
  unreadCount?: number
  iconOnly?: boolean
}) {
  const isActive = useIsActive()(item.to)

  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={
        unreadCount > 0
          ? `${item.label}, ${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}`
          : undefined
      }
      className={cn(navLinkClass(isActive), iconOnly && "p-2")}
    >
      <span className="relative inline-flex shrink-0">
        <item.Icon
          className={cn(
            "size-4 transition-colors",
            isActive ? item.activeIconClassName : item.iconClassName
          )}
        />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-2.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-fuchsia-500 px-0.5 text-[9px] leading-none font-bold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </span>
      <span className={cn(iconOnly && "sr-only")}>{item.label}</span>
    </Link>
  )
}
