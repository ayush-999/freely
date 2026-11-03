import { Link } from "react-router-dom"
import { BadgeCheck } from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Card } from "@workspace/ui/components/card"

import { useAuth } from "@/hooks/use-auth"
import { DEFAULT_AVATAR, DEFAULT_COVER, getMediaUrl } from "@/utils/media"

export function ProfileSummaryCard() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <Card className="overflow-hidden border-border/70 p-0 hover:shadow-sm">
      <img
        src={getMediaUrl(user.cover_storage_key, DEFAULT_COVER)}
        alt=""
        className="h-16 w-full bg-muted object-cover"
      />
      <div className="-mt-8 px-4 pb-4">
        <Link to={APP_ROUTES.profile} aria-label="Open your profile">
          <img
            src={getMediaUrl(user.avatar_storage_key, DEFAULT_AVATAR)}
            alt=""
            className="size-16 rounded-full border-2 border-card bg-card object-cover"
          />
        </Link>
        <div className="mt-2 flex items-center gap-1">
          <Link
            to={APP_ROUTES.profile}
            className="truncate text-base font-semibold hover:underline"
          >
            {user.full_name}
          </Link>
          {user.is_verified && (
            <BadgeCheck
              aria-label="Verified"
              className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">@{user.user_handle}</p>
        {user.bio && (
          <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
            {user.bio}
          </p>
        )}
      </div>
    </Card>
  )
}
