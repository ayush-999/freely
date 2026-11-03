import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { Calendar, Globe } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { formatDate, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { ProfilePosts } from "@/components/profile-posts"
import { identityService } from "@/services/identity.service"
import type { UserPublic } from "@/types"
import { DEFAULT_AVATAR, DEFAULT_COVER, getMediaUrl } from "@/utils/media"

export function UserProfilePage() {
  const { handle } = useParams<{ handle: string }>()
  const [profile, setProfile] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!handle) {
      return
    }
    identityService
      .getPublicProfile(handle)
      .then(setProfile)
      .catch((profileError) => setError(getApiErrorMessage(profileError)))
      .finally(() => setLoading(false))
  }, [handle])

  if (!handle) {
    return <p className="text-sm text-destructive">Missing user handle</p>
  }
  if (loading) {
    return <LoadingFallback label="Loading profile…" />
  }
  if (error || !profile) {
    return (
      <p className="text-sm text-destructive">{error ?? "User not found"}</p>
    )
  }

  const coverUrl = getMediaUrl(profile.cover_storage_key, DEFAULT_COVER)
  const avatarUrl = getMediaUrl(profile.avatar_storage_key, DEFAULT_AVATAR)

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="overflow-hidden border-border/80 shadow-xs">
        {/* Cover Photo */}
        <div className="relative h-44 w-full overflow-hidden bg-muted sm:h-52">
          <img
            src={coverUrl}
            alt="Profile cover banner"
            className="h-full w-full object-cover"
          />
        </div>

        {/* Profile Avatar & Info */}
        <div className="relative px-6 pt-0 pb-6">
          <div className="-mt-14 flex items-end justify-between sm:-mt-16">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full bg-background shadow-md ring-4 ring-background sm:size-28">
              <img
                src={avatarUrl}
                alt={profile.full_name}
                className="size-full rounded-full object-cover"
              />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {profile.full_name}
              </h1>
              {profile.is_verified && <Badge>Verified</Badge>}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              @{profile.user_handle}
            </p>

            {profile.bio && (
              <p className="pt-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground/70" />
                Joined {formatDate(profile.created_at)}
              </span>

              {profile.website_url && (
                <a
                  href={
                    profile.website_url.startsWith("http")
                      ? profile.website_url
                      : `https://${profile.website_url}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-3.5" />
                  {profile.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        <ProfilePosts handle={profile.user_handle} />
      </div>
    </div>
  )
}
