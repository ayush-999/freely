import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  FileText,
  HatGlasses,
  Heart,
  MessageSquareText,
  Repeat2,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Card } from "@workspace/ui/components/card"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { RichText } from "@/components/rich-text"
import { socialService } from "@/services/social.service"
import type { Post, ProfilePost } from "@/types"
import { DEFAULT_AVATAR, getMediaUrl } from "@/utils/media"

type FeedResult = {
  handle: string
  posts: ProfilePost[]
  error: string | null
}

export function ProfilePostCard({
  post,
  actions,
}: {
  post: Post & { reposted_by_handle?: string | null }
  actions?: ReactNode
}) {
  const media = post.media ?? []
  const images = media.filter((item) => item.media_type === "image")
  const videos = media.filter((item) => item.media_type === "video")
  const documents = media.filter((item) => item.media_type === "document")

  return (
    <Card className="gap-3 border-border/70 p-4 sm:p-5">
      {post.reposted_by_handle && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Repeat2
            aria-hidden="true"
            className="size-3.5 text-emerald-600 dark:text-emerald-400"
          />
          @{post.reposted_by_handle} reposted
        </p>
      )}

      <div className="flex items-center gap-3">
        {post.is_anonymous || !post.author_handle ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
            <HatGlasses aria-hidden="true" className="size-5" />
          </span>
        ) : (
          <img
            src={getMediaUrl(post.author_avatar_storage_key, DEFAULT_AVATAR)}
            alt=""
            className="size-10 shrink-0 rounded-full border border-border object-cover"
          />
        )}
        <div className="min-w-0">
          {post.is_anonymous || !post.author_handle ? (
            <p className="text-sm font-semibold">Anonymous</p>
          ) : (
            <Link
              to={APP_ROUTES.user(post.author_handle)}
              className="block truncate text-sm font-semibold hover:underline"
            >
              {post.author_full_name ?? post.author_handle}
              <span className="ml-1.5 font-normal text-muted-foreground">
                @{post.author_handle}
              </span>
            </Link>
          )}
          <p className="text-xs text-muted-foreground">
            {formatDateTime(post.created_at)}
            {post.edited_at && " · edited"}
          </p>
        </div>
      </div>

      <p className="text-sm leading-6 break-words whitespace-pre-wrap">
        <RichText>{post.body}</RichText>
      </p>

      {images.length > 0 && (
        <div
          className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {images.map((item) => (
            <img
              key={item.id ?? item.storage_key}
              src={getMediaUrl(item.storage_key)}
              alt={item.alt_text ?? item.file_name}
              className="max-h-80 w-full rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}
      {videos.map((item) => (
        <video
          key={item.id ?? item.storage_key}
          src={getMediaUrl(item.storage_key)}
          controls
          className="max-h-80 w-full rounded-lg border border-border bg-black"
        />
      ))}
      {documents.map((item) => (
        <a
          key={item.id ?? item.storage_key}
          href={getMediaUrl(item.storage_key)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm hover:bg-muted/60"
        >
          <FileText
            aria-hidden="true"
            className="size-4 shrink-0 text-red-500"
          />
          <span className="truncate">{item.file_name}</span>
        </a>
      ))}

      <div className="flex items-center gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart aria-hidden="true" className="size-3.5" />
          {post.like_count}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquareText aria-hidden="true" className="size-3.5" />
          {post.comment_count}
        </span>
        <span className="flex items-center gap-1">
          <Repeat2 aria-hidden="true" className="size-3.5" />
          {post.repost_count}
        </span>
        {post.visibility === "public" && (
          <Link
            to={APP_ROUTES.post(post.public_post_id)}
            className="ml-auto font-medium text-primary hover:underline"
          >
            View post
          </Link>
        )}
        {actions && (
          <div
            className={`flex items-center gap-1 ${post.visibility === "public" ? "" : "ml-auto"}`}
          >
            {actions}
          </div>
        )}
      </div>
    </Card>
  )
}

/** A user's own posts plus the posts they reposted, newest first. */
export function ProfilePosts({
  handle,
  isOwn = false,
}: {
  handle: string
  isOwn?: boolean
}) {
  const [result, setResult] = useState<FeedResult | null>(null)

  useEffect(() => {
    let cancelled = false
    socialService
      .getUserPosts(handle, { limit: 50 })
      .then((posts) => {
        if (!cancelled) setResult({ handle, posts, error: null })
      })
      .catch((loadError) => {
        if (!cancelled)
          setResult({
            handle,
            posts: [],
            error: getApiErrorMessage(loadError, "Could not load posts"),
          })
      })
    return () => {
      cancelled = true
    }
  }, [handle])

  const current = result?.handle === handle ? result : null

  return (
    <section aria-labelledby="profile-posts-heading" className="space-y-3">
      <h2 id="profile-posts-heading" className="text-lg font-semibold">
        Posts
      </h2>
      {!current ? (
        <LoadingFallback label="Loading posts…" />
      ) : current.error ? (
        <p className="text-sm text-destructive">{current.error}</p>
      ) : current.posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {isOwn
            ? "Your posts and reposts will appear here."
            : "No posts or reposts yet."}
        </p>
      ) : (
        current.posts.map((post) => (
          <ProfilePostCard key={`${post.id}-${post.activity_at}`} post={post} />
        ))
      )}
    </section>
  )
}
