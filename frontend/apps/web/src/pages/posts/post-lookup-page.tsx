import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@workspace/ui/components/card"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { socialService } from "@/services/social.service"
import type { PostPublicView } from "@/types"

/** Anonymous post lookup by public ID (public-safe fields only). */
export function PostLookupPage() {
  const { publicPostId } = useParams<{ publicPostId: string }>()
  const [post, setPost] = useState<PostPublicView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicPostId) {
      return
    }
    socialService
      .lookupPost(publicPostId)
      .then(setPost)
      .catch((postError) => setError(getApiErrorMessage(postError)))
      .finally(() => setLoading(false))
  }, [publicPostId])

  if (!publicPostId) {
    return <p className="text-sm text-destructive">Missing post id</p>
  }
  if (loading) {
    return <LoadingFallback label="Loading post…" />
  }
  if (error || !post) {
    return (
      <p className="text-sm text-destructive">{error ?? "Post not found"}</p>
    )
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            {post.post_type}
          </Badge>
          {post.is_sensitive && <Badge variant="destructive">Sensitive</Badge>}
        </div>
        <CardDescription>{formatDateTime(post.created_at)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{post.body}</p>
      </CardContent>
    </Card>
  )
}
