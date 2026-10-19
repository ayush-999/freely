import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Loader2 } from "lucide-react"

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
import type { Post, PostVisibility } from "@/types"

const selectClassName =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

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

  useEffect(() => {
    socialService
      .getFeed()
      .then(setPosts)
      .catch((feedError) => setError(getApiErrorMessage(feedError)))
      .finally(() => setLoading(false))
  }, [])

  function setNotice(postId: number, message: string) {
    setNotices((current) => ({ ...current, [postId]: message }))
  }

  async function onCreatePost(values: PostFormValues) {
    setError(null)
    try {
      const post = await socialService.createPost({
        body: values.body.trim(),
        visibility: values.visibility,
      })
      setPosts((current) => [post, ...current])
      setValue("body", "")
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Could not create the post"))
    }
  }

  async function handleLike(postId: number) {
    const result = await socialService.toggleLike(postId)
    setNotice(postId, result.message)
  }

  async function handleBookmark(postId: number) {
    const result = await socialService.toggleBookmark(postId)
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
    await socialService.comment(postId, { body: draft })
    setCommentDrafts((current) => ({ ...current, [postId]: "" }))
    setNotice(postId, "Comment posted")
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card>
        <form onSubmit={handleSubmit(onCreatePost)} noValidate>
          <CardHeader>
            <Textarea
              placeholder="What's happening?"
              className="min-h-20"
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
          <CardFooter className="justify-between">
            <select
              className={selectClassName}
              aria-label="Post visibility"
              {...register("visibility")}
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="department">Department</option>
              <option value="private">Private</option>
            </select>
            <Button type="submit" disabled={isSubmitting || !bodyValue.trim()}>
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
        <p className="text-center text-sm text-muted-foreground">
          No posts yet. Be the first to post.
        </p>
      ) : (
        posts.map((post) => (
          <Card key={post.id}>
            <CardHeader className="gap-1">
              <p className="text-sm whitespace-pre-wrap">{post.body}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {post.is_anonymous
                  ? "Anonymous"
                  : `User #${post.author_user_id ?? "—"}`}
              </span>
              <span>·</span>
              <span>{formatDateTime(post.created_at)}</span>
              <span>·</span>
              <span className="capitalize">{post.visibility}</span>
            </CardContent>
            {isAuthenticated && (
              <CardFooter className="flex-col items-stretch gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleLike(post.id)}
                  >
                    Like
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleBookmark(post.id)}
                  >
                    Bookmark
                  </Button>
                  {user && post.author_user_id === user.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void handleDelete(post.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
                    onClick={() => void handleComment(post.id)}
                  >
                    Comment
                  </Button>
                </div>
                {notices[post.id] && (
                  <p className="text-xs text-muted-foreground">
                    {notices[post.id]}
                  </p>
                )}
              </CardFooter>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
