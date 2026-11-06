import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Calendar, Globe, Pencil } from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { formatDate, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { ProfileNetwork } from "@/components/people/profile-network"
import { ProfilePosts } from "@/components/profile-posts"
import { useAuth } from "@/hooks/use-auth"
import { identityService } from "@/services/identity.service"
import type { UserPublic } from "@/types"
import { DEFAULT_AVATAR, DEFAULT_COVER, getMediaUrl } from "@/utils/media"
import { getProfileWebsite } from "@/utils/profile"

function PublicProfile({ handle }: { handle: string }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    identityService
      .getPublicProfile(handle)
      .then((value) => {
        if (active) {
          setProfile(value)
          setError(null)
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(getApiErrorMessage(failure))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [handle, attempt])

  if (loading) return <LoadingFallback label="Loading profile…" />
  if (error || !profile)
    return (
      <div className="mx-auto max-w-3xl space-y-3 rounded-xl border p-6">
        <p role="alert" className="text-sm text-destructive">
          {error ?? "User not found"}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setLoading(true)
            setError(null)
            setAttempt((value) => value + 1)
          }}
        >
          Retry
        </Button>
      </div>
    )

  const own =
    user?.user_handle.toLowerCase() === profile.user_handle.toLowerCase()
  const website = getProfileWebsite(profile.website_url)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-12">
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-60">
          <img
            src={getMediaUrl(profile.cover_storage_key, DEFAULT_COVER)}
            alt="Profile cover banner"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="relative px-6 pt-0 pb-6">
          <div className="-mt-16 flex flex-wrap items-end justify-between gap-4 sm:-mt-20">
            <div className="relative size-28 shrink-0 overflow-hidden rounded-full bg-background shadow-md ring-4 ring-background sm:size-36">
              <img
                src={getMediaUrl(profile.avatar_storage_key, DEFAULT_AVATAR)}
                alt={profile.full_name}
                className="size-full rounded-full object-cover"
              />
            </div>
            {own && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="mb-2 gap-1.5"
              >
                <Link to={`${APP_ROUTES.profile}?edit=1`}>
                  <Pencil className="size-3.5" />
                  Edit profile
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-xl font-bold tracking-tight break-words text-foreground sm:text-2xl">
                {profile.full_name}
              </h1>
              {profile.is_verified && <Badge>Verified</Badge>}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              @{profile.user_handle}
            </p>
            {profile.bio && (
              <p className="max-w-2xl pt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                {profile.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground/70" />
                Joined {formatDate(profile.created_at)}
              </span>
              {website && (
                <a
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
                >
                  <Globe className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {profile.website_url?.replace(/^https?:\/\//i, "")}
                  </span>
                </a>
              )}
            </div>
          </div>
          <ProfileNetwork handle={profile.user_handle} actions={!own} />
        </div>
      </Card>
      <ProfilePosts handle={profile.user_handle} isOwn={own} />
    </div>
  )
}

export function UserProfilePage() {
  const { handle } = useParams<{ handle: string }>()
  return handle ? (
    <PublicProfile key={handle} handle={handle} />
  ) : (
    <p role="alert" className="text-sm text-destructive">
      Missing user handle
    </p>
  )
}
