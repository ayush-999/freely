import { Link } from "react-router-dom"
import { BadgeCheck } from "lucide-react"
import { APP_ROUTES } from "@workspace/constants"
import type { UserPublic } from "@/types/identity"
import { DEFAULT_AVATAR, getMediaUrl } from "@/utils/media"
import { UserActions } from "./user-actions"

export function PersonRow({
  person,
  onNavigate,
}: {
  person: UserPublic
  onNavigate?: () => void
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center">
      <Link
        to={APP_ROUTES.user(person.user_handle)}
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <img
          src={getMediaUrl(person.avatar_storage_key, DEFAULT_AVATAR)}
          alt=""
          className="size-11 shrink-0 rounded-full border border-border object-cover"
        />
        <div className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold">
              {person.full_name}
            </span>
            {person.is_verified && (
              <BadgeCheck
                className="size-3.5 shrink-0 text-sky-600"
                aria-label="Verified"
              />
            )}
          </span>
          <p className="truncate text-xs text-muted-foreground">
            @{person.user_handle}
          </p>
          {person.bio && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {person.bio}
            </p>
          )}
        </div>
      </Link>
      <UserActions handle={person.user_handle} />
    </div>
  )
}
