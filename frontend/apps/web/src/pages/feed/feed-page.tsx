import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Link } from "react-router-dom"
import {
  Bookmark,
  Building2,
  ChevronDown,
  ChevronUp,
  Globe2,
  Heart,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Megaphone,
  Send,
  Trash2,
  Users,
  HatGlasses,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@workspace/ui/components/card"
import { Textarea } from "@workspace/ui/components/textarea"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { useAuth } from "@/hooks/use-auth"
import { socialService } from "@/services/social.service"
import type { Comment, Post, PostVisibility } from "@/types"

const visibilityOptions = [
  {
    value: "public",
    label: "Public",
    Icon: Globe2,
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  {
    value: "followers",
    label: "Followers",
    Icon: Users,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "department",
    label: "Department",
    Icon: Building2,
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "private",
    label: "Private",
    Icon: LockKeyhole,
    iconClassName: "text-rose-600 dark:text-rose-400",
  },
] as const

type PostFormValues = {
  body: string
  visibility: PostVisibility
}

export function FeedPage() {
  const { user, isAuthenticated } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notices, setNotices] = useState<Record<number, string>>({})
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({})
  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({})
  const [savedPosts, setSavedPosts] = useState<Record<number, boolean>>({})
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false)
  const [loadingComments, setLoadingComments] = useState<
    Record<number, boolean>
  >({})
  const visibilityMenuRef = useRef<HTMLDetailsElement>(null)
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    defaultValues: { body: "", visibility: "public" },
  })
  const bodyValue = useWatch({ control, name: "body" })
  const visibilityValue = useWatch({ control, name: "visibility" })
  const selectedVisibility =
    visibilityOptions.find((option) => option.value === visibilityValue) ??
    visibilityOptions[0]

  useEffect(() => {
    socialService
      .getFeed()
      .then(setPosts)
      .catch((feedError) => setError(getApiErrorMessage(feedError)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleOutsidePointerDown(event: PointerEvent) {
      const menu = visibilityMenuRef.current
      if (
        menu?.open &&
        event.target instanceof Node &&
        !menu.contains(event.target)
      ) {
        menu.open = false
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown)
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown)
  }, [])

  function setNotice(postId: number, message: string) {
    setNotices((current) => ({ ...current, [postId]: message }))
  }

  async function onCreatePost(values: PostFormValues) {
    setError(null)
    try {
      const post = await socialService.createPost({
        body: values.body.trim(),
        visibility: isAuthenticated ? values.visibility : "public",
      })
      setPosts((current) => [post, ...current])
      setValue("body", "")
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Could not create the post"))
    }
  }

  async function handleLike(postId: number) {
    const post = posts.find((item) => item.id === postId)
    if (!post) return

    await socialService.toggleLike(postId)
    setPosts((current) =>
      current.map((item) =>
        item.id === postId
          ? {
              ...item,
              is_liked: !post.is_liked,
              like_count: Math.max(
                0,
                item.like_count + (post.is_liked ? -1 : 1)
              ),
            }
          : item
      )
    )
  }

  async function handleBookmark(postId: number) {
    const result = await socialService.toggleBookmark(postId)
    setSavedPosts((current) => ({
      ...current,
      [postId]: result.message === "bookmarked",
    }))
    setNotice(postId, result.message)
  }

  async function handleDelete(postId: number) {
    await socialService.deletePost(postId)
    setPosts((current) => current.filter((post) => post.id !== postId))
  }

  async function handleComment(postId: number) {
    const draft = (commentDrafts[postId] ?? "").trim()
    if (!draft) {
      return
    }
    const comment = await socialService.comment(postId, { body: draft })
    setComments((current) => ({
      ...current,
      [postId]: [...(current[postId] ?? []), comment],
    }))
    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? { ...post, comment_count: post.comment_count + 1 }
          : post
      )
    )
    setOpenComments((current) => ({ ...current, [postId]: true }))
    setCommentDrafts((current) => ({ ...current, [postId]: "" }))
    setNotice(postId, "Comment posted")
  }

  async function toggleComments(postId: number) {
    if (openComments[postId]) {
      setOpenComments((current) => ({ ...current, [postId]: false }))
      return
    }

    setOpenComments((current) => ({ ...current, [postId]: true }))
    if (
      comments[postId] ||
      posts.find((post) => post.id === postId)?.comment_count === 0
    ) {
      return
    }

    setLoadingComments((current) => ({ ...current, [postId]: true }))
    try {
      const result = await socialService.getComments(postId)
      setComments((current) => ({ ...current, [postId]: result }))
    } catch (commentsError) {
      setNotice(
        postId,
        getApiErrorMessage(commentsError, "Could not load comments")
      )
      setOpenComments((current) => ({ ...current, [postId]: false }))
    } finally {
      setLoadingComments((current) => ({ ...current, [postId]: false }))
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 sm:gap-6">
      <header className="space-y-2 pt-1">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
          FREELY COMMUNITY
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Community feed
        </h1>
      </header>

      <Card className="overflow-visible border-border/70 hover:shadow-sm">
        <form onSubmit={handleSubmit(onCreatePost)} noValidate>
          <CardHeader className="gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Megaphone aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Start a conversation</h2>
                <p className="text-xs text-muted-foreground">
                  Your voice belongs here.
                </p>
              </div>
            </div>
            <Textarea
              placeholder="What's happening?"
              className="min-h-28 resize-y rounded-lg border-border/70 bg-muted/30 px-4 py-3 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:bg-background"
              aria-invalid={!!errors.body || undefined}
              {...register("body", {
                validate: (value) =>
                  value.trim().length > 0 || "Write something before posting",
              })}
            />
            {errors.body && (
              <p className="mt-2 text-xs text-destructive">
                {errors.body.message}
              </p>
            )}
          </CardHeader>
          <CardFooter className="justify-between border-t border-border/60 px-5 py-4 sm:px-6">
            <input type="hidden" {...register("visibility")} />
            {isAuthenticated ? (
              <details
                ref={visibilityMenuRef}
                className="relative"
                onToggle={(event) =>
                  setVisibilityMenuOpen(event.currentTarget.open)
                }
              >
                <summary
                  aria-label={`Post visibility: ${selectedVisibility.label}`}
                  className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
                >
                  <selectedVisibility.Icon
                    aria-hidden="true"
                    className={`size-4 ${selectedVisibility.iconClassName}`}
                  />
                  {selectedVisibility.label}
                  {visibilityMenuOpen ? (
                    <ChevronUp
                      aria-hidden="true"
                      className="size-4 text-slate-500 dark:text-slate-400"
                    />
                  ) : (
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 text-slate-500 dark:text-slate-400"
                    />
                  )}
                </summary>
                <div className="absolute top-full left-0 z-10 mt-1 min-w-full rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                  {visibilityOptions.map(
                    ({ value, label, Icon, iconClassName }) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={visibilityValue === value}
                        className={`mb-1 flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm last:mb-0 focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none ${
                          visibilityValue === value
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                        onClick={() => {
                          setValue("visibility", value, { shouldDirty: true })
                          if (visibilityMenuRef.current) {
                            visibilityMenuRef.current.open = false
                          }
                        }}
                      >
                        <Icon
                          aria-hidden="true"
                          className={`size-4 ${iconClassName}`}
                        />
                        {label}
                      </button>
                    )
                  )}
                </div>
              </details>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Post visibility: Public (disabled for anonymous posts)"
                className="flex h-9 cursor-not-allowed list-none items-center gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm text-muted-foreground opacity-60 shadow-xs"
              >
                <Globe2
                  aria-hidden="true"
                  className="size-4 text-sky-600 dark:text-sky-400"
                />
                Public
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 text-slate-500 dark:text-slate-400"
                />
              </button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !bodyValue.trim()}
              className="min-w-24"
            >
              {!isSubmitting && <Send aria-hidden="true" />}
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting ? "Posting…" : "Post"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <LoadingFallback label="Loading feed…" />
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
            <MessageCircle aria-hidden="true" className="size-5" />
          </span>
          <p className="text-sm font-medium">No posts yet</p>
          <p className="text-sm text-muted-foreground">
            Be the first to share something with the community.
          </p>
        </div>
      ) : (
        <section className="space-y-4" aria-labelledby="feed-posts-heading">
          {posts.map((post) => (
            <Card
              key={post.id}
              className="overflow-hidden border-border/70 transition-shadow hover:shadow-sm"
            >
              <CardHeader className="gap-4 p-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {post.is_anonymous ? (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
                        <HatGlasses aria-hidden="true" className="size-5" />
                      </span>
                    ) : (
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <Users aria-hidden="true" className="size-4" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {post.is_anonymous
                          ? "Anonymous"
                          : `User #${post.author_user_id ?? "—"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(post.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground capitalize">
                    {visibilityOptions.map(({ value, Icon, iconClassName }) =>
                      value === post.visibility ? (
                        <Icon
                          key={value}
                          aria-hidden="true"
                          className={`size-3.5 ${iconClassName}`}
                        />
                      ) : null
                    )}
                    {post.visibility}
                  </span>
                </div>
                <p className="text-sm leading-6 whitespace-pre-wrap text-foreground sm:text-[15px]">
                  {post.body}
                </p>
              </CardHeader>

              <CardContent className="px-5 pb-4 sm:px-6 sm:pb-4">
                <div className="flex items-center justify-between gap-1 border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2">
                    {isAuthenticated ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-pressed={post.is_liked}
                        className={
                          post.is_liked
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                        }
                        onClick={() => void handleLike(post.id)}
                      >
                        <Heart
                          aria-hidden="true"
                          className={post.is_liked ? "fill-current" : undefined}
                        />
                        {post.like_count}
                      </Button>
                    ) : (
                      <span className="flex h-9 items-center gap-2 px-3 text-sm text-muted-foreground">
                        <Heart aria-hidden="true" className="size-4" />
                        {post.like_count}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        openComments[post.id]
                          ? "text-amber-600 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400"
                          : "text-muted-foreground"
                      }
                      aria-expanded={!!openComments[post.id]}
                      onClick={() => void toggleComments(post.id)}
                    >
                      <MessageCircle
                        aria-hidden="true"
                        className={
                          openComments[post.id] ? "fill-current" : undefined
                        }
                      />
                      {post.comment_count}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {user && post.author_user_id === user.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(post.id)}
                      >
                        <Trash2 aria-hidden="true" />
                        Delete
                      </Button>
                    )}
                    {isAuthenticated && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-pressed={!!savedPosts[post.id]}
                        className={
                          savedPosts[post.id]
                            ? "text-blue-600 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-400"
                            : "text-muted-foreground"
                        }
                        onClick={() => void handleBookmark(post.id)}
                      >
                        <Bookmark
                          aria-hidden="true"
                          className={
                            savedPosts[post.id] ? "fill-current" : undefined
                          }
                        />
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>

              {(isAuthenticated || openComments[post.id]) && (
                <CardFooter className="flex-col items-stretch gap-3 border-t border-border/60 bg-muted/20 px-5 py-4 sm:px-6">
                  {openComments[post.id] && (
                    <div className="space-y-3" aria-live="polite">
                      {loadingComments[post.id] ? (
                        <p className="text-sm text-muted-foreground">
                          Loading comments…
                        </p>
                      ) : comments[post.id]?.length ? (
                        comments[post.id].map((comment) => (
                          <article key={comment.id} className="space-y-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <Link
                                to={`/u/${comment.user_handle}`}
                                className="text-xs font-semibold hover:underline"
                              >
                                {comment.full_name}
                              </Link>
                              <time className="text-xs text-muted-foreground">
                                {formatDateTime(comment.created_at)}
                              </time>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {comment.body}
                            </p>
                          </article>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No comments yet.
                        </p>
                      )}
                    </div>
                  )}
                  {isAuthenticated && (
                    <div className="flex gap-2">
                      <input
                        className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        placeholder="Write a comment…"
                        value={commentDrafts[post.id] ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!(commentDrafts[post.id] ?? "").trim()}
                        onClick={() => void handleComment(post.id)}
                      >
                        Comment
                      </Button>
                    </div>
                  )}
                  {notices[post.id] && (
                    <p className="text-xs text-muted-foreground" role="status">
                      {notices[post.id]}
                    </p>
                  )}
                </CardFooter>
              )}
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
