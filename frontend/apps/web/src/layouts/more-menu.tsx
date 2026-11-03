import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bookmark,
  ChevronDown,
  ClipboardList,
  Ellipsis,
  FileClock,
  LogOut,
  Megaphone,
  Settings,
  Star,
  type LucideIcon,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { cn } from "@workspace/ui/lib/utils"

import { ModeToggle } from "@/components/mode-toggle"
import { useAuth } from "@/hooks/use-auth"
import { DEFAULT_AVATAR, getMediaUrl } from "@/utils/media"

import { navLinkClass, useIsActive } from "./nav-link-item"

export interface MoreItem {
  to: string
  label: string
  Icon: LucideIcon
}

/** Pages not built yet point at the Coming Soon page. */
export const MORE_ITEMS: readonly MoreItem[] = [
  { to: APP_ROUTES.grievances.mine, label: "Grievances", Icon: FileClock },
  {
    to: APP_ROUTES.grievances.new,
    label: "Raise a grievance",
    Icon: Megaphone,
  },
  {
    to: APP_ROUTES.saved,
    label: "Saved",
    Icon: Bookmark,
  },
  {
    to: APP_ROUTES.comingSoon("Saved jobs"),
    label: "Saved jobs",
    Icon: Star,
  },
  {
    to: APP_ROUTES.comingSoon("My applications"),
    label: "My applications",
    Icon: ClipboardList,
  },
  {
    to: APP_ROUTES.comingSoon("Settings"),
    label: "Settings",
    Icon: Settings,
  },
]

const itemClassName =
  "flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"

export function MoreMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const isActive = useIsActive()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const sectionActive =
    isActive(APP_ROUTES.profile) || MORE_ITEMS.some((item) => isActive(item.to))

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={navLinkClass(sectionActive || open)}
      >
        <Ellipsis
          className={cn(
            "size-4 transition-colors",
            sectionActive || open
              ? "text-violet-400"
              : "text-muted-foreground group-hover:text-violet-400"
          )}
        />
        More
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-2 w-64 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <Link
            to={APP_ROUTES.profile}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-sm px-3 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
          >
            <img
              src={getMediaUrl(user?.avatar_storage_key, DEFAULT_AVATAR)}
              alt=""
              className="size-9 rounded-full object-cover ring-1 ring-border"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {user?.full_name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{user?.user_handle} · View profile
              </span>
            </span>
          </Link>

          <div className="my-1 h-px bg-border" />

          {MORE_ITEMS.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={cn(
                itemClassName,
                isActive(to) && "bg-accent text-accent-foreground"
              )}
            >
              <Icon
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
              {label}
            </Link>
          ))}

          <div className="my-1 h-px bg-border" />

          <div className="flex items-center justify-between px-3 py-0.5 text-sm">
            Theme
            <ModeToggle />
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className={itemClassName}
          >
            <LogOut
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
