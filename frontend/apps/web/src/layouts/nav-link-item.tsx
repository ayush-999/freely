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
}: {
  item: NavItem
  onClick?: () => void
}) {
  const isActive = useIsActive()(item.to)

  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={navLinkClass(isActive)}
    >
      <item.Icon
        className={cn(
          "size-4 transition-colors",
          isActive ? item.activeIconClassName : item.iconClassName
        )}
      />
      {item.label}
    </Link>
  )
}
