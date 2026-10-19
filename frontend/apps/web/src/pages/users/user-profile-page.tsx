import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { formatDate, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { identityService } from "@/services/identity.service"
import type { UserPublic } from "@/types"

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

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>@{profile.user_handle}</CardTitle>
          {profile.is_verified && <Badge>Verified</Badge>}
        </div>
        <CardDescription>
          {profile.full_name} · Joined {formatDate(profile.created_at)}
        </CardDescription>
      </CardHeader>
      {(profile.bio || profile.website_url) && (
        <CardContent className="flex flex-col gap-2 text-sm">
          {profile.bio && <p>{profile.bio}</p>}
          {profile.website_url && (
            <a
              href={profile.website_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              {profile.website_url}
            </a>
          )}
        </CardContent>
      )}
    </Card>
  )
}
