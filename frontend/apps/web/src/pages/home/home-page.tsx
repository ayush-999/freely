import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useForm, useWatch } from "react-hook-form"
import { Link, useSearchParams } from "react-router-dom"
import {
  Bookmark,
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe2,
  Heart,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Megaphone,
  Pencil,
  Repeat2,
  Send,
  Share2,
  Trash2,
  Users,
  Video,
  X,
  HatGlasses,
  MessageCircleText,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@workspace/ui/components/card"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { CommentThread } from "@/components/comment-thread"
import { ConfirmationDialog } from "@/components/confirmation-dialog"
import { EmojiPicker, insertAtSelection } from "@/components/emoji-picker"
import { LoadingFallback } from "@/components/loading-fallback"
import { PostEditor } from "@/components/post-editor"
import { PostMenu, type PostMenuItem } from "@/components/post-menu"
import { hasHashtag, RichText } from "@/components/rich-text"
import { SavePostDialog } from "@/components/save-post-dialog"
import { SharePostDialog } from "@/components/share-post-dialog"
import { useAuth } from "@/hooks/use-auth"
import { socialService } from "@/services/social.service"
import type { Comment, Post, PostVisibility } from "@/types"
import { DEFAULT_AVATAR, formatFileSize, getMediaUrl } from "@/utils/media"

import { GuestLoginCard } from "./guest-login-card"
import { ProfileSummaryCard } from "./profile-summary-card"
import { TrendingCard } from "./trending-card"

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

type DeleteConfirmation =
  | { type: "post"; postId: number }
  | { type: "comment"; postId: number; commentId: number }

export function HomePage() {
  const { user, isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({})
  const [comments, setComments] = useState<Record<number, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<
    Record<number, boolean>
  >({})
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({})
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [savingPostId, setSavingPostId] = useState<number | null>(null)
  const [sharingPost, setSharingPost] = useState<Post | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null)
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false)
  const visibilityMenuRef = useRef<HTMLDetailsElement | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const commentInputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // Media attachment state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeAccept, setActiveAccept] = useState<string>(
    "image/*,video/*,.pdf"
  )

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
  const bodyField = register("body", {
    validate: (value) =>
      value.trim().length > 0 || "Write something before posting",
  })
  const visibilityValue = useWatch({ control, name: "visibility" })
  const selectedVisibility =
    visibilityOptions.find((option) => option.value === visibilityValue) ??
    visibilityOptions[0]
  const activeHashtag =
    searchParams.get("hashtag")?.trim().replace(/^#/, "").toLowerCase() ?? ""
  const visiblePosts = activeHashtag
    ? posts.filter((post) => hasHashtag(post.body, activeHashtag))
    : posts

  useEffect(() => {
    socialService
      .getHomePosts()
      .then(setPosts)
      .catch((loadError) => setError(getApiErrorMessage(loadError)))
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

  useEffect(() => {
    if (!composerOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setComposerOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [composerOpen])

  function insertBodyEmoji(emoji: string) {
    const field = bodyRef.current
    const { value, caret } = insertAtSelection(field, bodyValue, emoji)
    setValue("body", value, { shouldDirty: true })
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(caret, caret)
    })
  }

  function insertCommentEmoji(postId: number, emoji: string) {
    const field = commentInputRefs.current[postId] ?? null
    const { value, caret } = insertAtSelection(
      field,
      commentDrafts[postId] ?? "",
      emoji
    )
    setCommentDrafts((current) => ({ ...current, [postId]: value }))
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(caret, caret)
    })
  }

  function triggerFilePick(acceptType: string) {
    setActiveAccept(acceptType)
    setTimeout(() => {
      fileInputRef.current?.click()
    }, 10)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newFiles = Array.from(files)
    setAttachedFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function removeAttachedFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function onCreatePost(values: PostFormValues) {
    setError(null)
    try {
      const post = await socialService.createPost({
        body: values.body.trim(),
        visibility: isAuthenticated ? values.visibility : "public",
      })

      let finalMedia = post.media || []
      if (attachedFiles.length > 0) {
        setUploadingMedia(true)
        for (const file of attachedFiles) {
          try {
            const uploaded = await socialService.uploadPostMedia(post.id, file)
            finalMedia = [...finalMedia, uploaded]
          } catch (uploadErr) {
            console.error("Media upload failed:", uploadErr)
          }
        }
      }

      const updatedPost = { ...post, media: finalMedia }
      setPosts((current) => [updatedPost, ...current])
      setValue("body", "")
      setAttachedFiles([])
      setComposerOpen(false)
    } catch (createError) {
      setError(getApiErrorMessage(createError, "Could not create the post"))
    } finally {
      setUploadingMedia(false)
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

  async function handleBookmark(post: Post) {
    if (!post.is_bookmarked) {
      setSavingPostId(post.id)
      return
    }
    try {
      await socialService.toggleBookmark(post.id)
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id ? { ...item, is_bookmarked: false } : item
        )
      )
    } catch (unsaveError) {
      setError(
        getApiErrorMessage(unsaveError, "Could not remove the saved post")
      )
    }
  }

  function handleSaved(postId: number, collectionName: string | null) {
    setPosts((current) =>
      current.map((item) =>
        item.id === postId ? { ...item, is_bookmarked: true } : item
      )
    )
    setSavingPostId(null)
    toast.add({
      title: collectionName ? `Saved to “${collectionName}”` : "Post saved",
      type: "success",
    })
  }

  async function handleEditPost(postId: number, body: string) {
    const updated = await socialService.editPost(postId, body)
    setPosts((current) =>
      current.map((item) =>
        item.id === postId
          ? { ...item, body: updated.body, edited_at: updated.edited_at }
          : item
      )
    )
    setEditingPostId(null)
  }

  function postMenuItems(post: Post): PostMenuItem[] {
    const isOwner = !!user && post.author_user_id === user.id
    const items: PostMenuItem[] = []
    if (isOwner) {
      items.push({
        key: "edit",
        label: "Edit post",
        Icon: Pencil,
        onSelect: () => setEditingPostId(post.id),
      })
    }
    if (isAuthenticated) {
      items.push({
        key: "save",
        label: post.is_bookmarked ? "Unsave" : "Save",
        Icon: Bookmark,
        onSelect: () => void handleBookmark(post),
      })
    }
    if (post.visibility === "public") {
      items.push({
        key: "share",
        label: "Share",
        Icon: Share2,
        onSelect: () => setSharingPost(post),
      })
    }
    if (isOwner) {
      items.push({
        key: "delete",
        label: "Delete post",
        Icon: Trash2,
        destructive: true,
        onSelect: () => setDeleteConfirmation({ type: "post", postId: post.id }),
      })
    }
    return items
  }

  async function handleComment(postId: number) {
    const draft = (commentDrafts[postId] ?? "").trim()
    if (!draft) return

    try {
      const comment = await socialService.comment(postId, { body: draft })
      setComments((current) => ({
        ...current,
        [postId]: [...(current[postId] ?? []), comment],
      }))
      setCommentDrafts((current) => ({ ...current, [postId]: "" }))
      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? { ...item, comment_count: item.comment_count + 1 }
            : item
        )
      )
    } catch (commentError) {
      setError(getApiErrorMessage(commentError, "Could not submit the comment"))
    }
  }

  async function handleRepost(postId: number) {
    try {
      const result = await socialService.repost(postId, {})
      const reposted = result.message === "reposted"
      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? {
                ...item,
                is_reposted: reposted,
                repost_count: Math.max(
                  0,
                  item.repost_count + (reposted ? 1 : -1)
                ),
              }
            : item
        )
      )
    } catch (repostError) {
      setError(getApiErrorMessage(repostError, "Could not repost"))
    }
  }

  function replaceComment(postId: number, updated: Comment) {
    setComments((current) => ({
      ...current,
      [postId]: (current[postId] ?? []).map((item) =>
        item.id === updated.id ? updated : item
      ),
    }))
  }

  async function handleReply(postId: number, parentId: number, body: string) {
    const reply = await socialService.comment(postId, {
      body,
      parent_comment_id: parentId,
    })
    setComments((current) => ({
      ...current,
      [postId]: [...(current[postId] ?? []), reply],
    }))
    setPosts((current) =>
      current.map((item) =>
        item.id === postId
          ? { ...item, comment_count: item.comment_count + 1 }
          : item
      )
    )
  }

  async function handleEditComment(
    postId: number,
    commentId: number,
    body: string
  ) {
    replaceComment(postId, await socialService.editComment(commentId, body))
  }

  async function handleCommentLike(postId: number, commentId: number) {
    try {
      const result = await socialService.toggleCommentLike(commentId)
      const liked = result.message === "liked"
      setComments((current) => ({
        ...current,
        [postId]: (current[postId] ?? []).map((item) =>
          item.id === commentId
            ? {
                ...item,
                is_liked: liked,
                like_count: Math.max(0, item.like_count + (liked ? 1 : -1)),
              }
            : item
        ),
      }))
    } catch (likeError) {
      setError(getApiErrorMessage(likeError, "Could not like the comment"))
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmation) return

    if (deleteConfirmation.type === "post") {
      await socialService.deletePost(deleteConfirmation.postId)
      setPosts((current) =>
        current.filter((post) => post.id !== deleteConfirmation.postId)
      )
    } else {
      await socialService.deleteComment(deleteConfirmation.commentId)
      setComments((current) => ({
        ...current,
        [deleteConfirmation.postId]: (
          current[deleteConfirmation.postId] ?? []
        ).filter(
          (comment) => comment.id !== deleteConfirmation.commentId
        ),
      }))
      setPosts((current) =>
        current.map((item) =>
          item.id === deleteConfirmation.postId
            ? {
                ...item,
                comment_count: Math.max(0, item.comment_count - 1),
              }
            : item
        )
      )
    }
    setDeleteConfirmation(null)
  }

  async function toggleComments(postId: number) {
    const isOpen = !openComments[postId]
    setOpenComments((current) => ({ ...current, [postId]: isOpen }))

    if (isOpen && comments[postId] === undefined) {
      setLoadingComments((current) => ({ ...current, [postId]: true }))
      try {
        const list = await socialService.getComments(postId, { limit: 200 })
        setComments((current) => ({ ...current, [postId]: list }))
      } catch (commentsError) {
        setError(
          getApiErrorMessage(commentsError, "Could not load the comments")
        )
      }
      setLoadingComments((current) => ({ ...current, [postId]: false }))
    }
  }

  return (
    <>
      <div className="mx-auto grid max-w-6xl justify-center gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,40rem)_18rem]">
        <aside className="sticky top-24 hidden self-start lg:block">
          {isAuthenticated ? <ProfileSummaryCard /> : <GuestLoginCard />}
        </aside>
        <div className="flex min-w-0 flex-col gap-6 sm:gap-6">
          <header className="space-y-2 pt-1">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
              FREELY COMMUNITY
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Community feed
            </h1>
          </header>

          {/* Hidden file input for attachments */}
          <input
            ref={fileInputRef}
            type="file"
            accept={activeAccept}
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <Card className="border-border/70 hover:shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Megaphone aria-hidden="true" className="size-5" />
              </span>
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="h-11 flex-1 rounded-full border border-border/80 bg-muted/30 px-4 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Start a conversation
              </button>
            </CardContent>
          </Card>

          {composerOpen &&
            createPortal(
              <div
                className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-16"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !isSubmitting) {
                    setComposerOpen(false)
                  }
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="composer-title"
                  className="w-full max-w-xl rounded-xl border border-border bg-card text-card-foreground shadow-xl"
                >
                  <form onSubmit={handleSubmit(onCreatePost)} noValidate>
                    <CardHeader className="gap-4 p-5 pb-3 sm:p-6 sm:pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getMediaUrl(
                              user?.avatar_storage_key,
                              DEFAULT_AVATAR
                            )}
                            alt=""
                            className="size-12 rounded-full border border-border object-cover"
                          />
                          <div>
                            <h2
                              id="composer-title"
                              className="text-sm font-semibold"
                            >
                              {isAuthenticated && user
                                ? user.full_name
                                : "Anonymous"}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {isAuthenticated && user
                                ? `Posting as @${user.user_handle}`
                                : "Posting anonymously"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Close"
                          onClick={() => setComposerOpen(false)}
                        >
                          <X aria-hidden="true" className="size-5" />
                        </Button>
                      </div>
                      <Textarea
                        autoFocus
                        placeholder="What do you want to talk about?"
                        className="min-h-40 resize-y rounded-lg border-border/70 bg-muted/30 px-4 py-3 text-sm shadow-none placeholder:text-muted-foreground/80 focus-visible:bg-background"
                        aria-invalid={!!errors.body || undefined}
                        {...bodyField}
                        ref={(element) => {
                          bodyField.ref(element)
                          bodyRef.current = element
                        }}
                      />
                      {errors.body && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.body.message}
                        </p>
                      )}

                      {/* Attached Files Preview */}
                      {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {attachedFiles.map((file, idx) => (
                            <div
                              key={`${file.name}-${idx}`}
                              className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/50 px-2.5 py-1 text-xs"
                            >
                              {file.type.startsWith("image/") ? (
                                <ImageIcon className="size-3.5 text-blue-500" />
                              ) : file.type.startsWith("video/") ? (
                                <Video className="size-3.5 text-purple-500" />
                              ) : (
                                <FileText className="size-3.5 text-red-500" />
                              )}
                              <span className="max-w-[140px] truncate font-medium">
                                {file.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({formatFileSize(file.size)})
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAttachedFile(idx)}
                                className="ml-1 text-muted-foreground hover:text-destructive"
                                title="Remove file"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardHeader>

                    {/* Attachment Action Bar */}
                    <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-5 py-2.5 sm:px-6">
                      <div className="flex items-center gap-1">
                        <span className="mr-1 text-xs text-muted-foreground">
                          Attach:
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerFilePick("image/*")}
                          className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                          title="Add photo or image"
                        >
                          <ImageIcon className="size-3.5 text-blue-500" />
                          <span>Photo</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerFilePick("video/*")}
                          className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                          title="Add video"
                        >
                          <Video className="size-3.5 text-purple-500" />
                          <span>Video</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            triggerFilePick(".pdf,application/pdf")
                          }
                          className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                          title="Add PDF or document"
                        >
                          <FileText className="size-3.5 text-red-500" />
                          <span>PDF / Doc</span>
                        </Button>
                      </div>
                      <EmojiPicker onSelect={insertBodyEmoji} />
                    </div>

                    <CardFooter className="justify-between border-t border-border/60 px-5 py-3 sm:px-6">
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
                          <div className="absolute bottom-full left-0 z-10 mb-1 min-w-full rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
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
                                    setValue("visibility", value, {
                                      shouldDirty: true,
                                    })
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
                        disabled={
                          isSubmitting || uploadingMedia || !bodyValue.trim()
                        }
                        className="min-w-24"
                      >
                        {!(isSubmitting || uploadingMedia) && (
                          <Send aria-hidden="true" />
                        )}
                        {(isSubmitting || uploadingMedia) && (
                          <Loader2 className="animate-spin" />
                        )}
                        {isSubmitting || uploadingMedia ? "Posting…" : "Post"}
                      </Button>
                    </CardFooter>
                  </form>
                </div>
              </div>,
              document.body
            )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading ? (
            <LoadingFallback label="Loading posts…" />
          ) : visiblePosts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
                <MessageSquareText aria-hidden="true" className="size-5" />
              </span>
              <p className="text-sm font-medium">
                {activeHashtag
                  ? `No posts tagged #${activeHashtag}`
                  : "No posts yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeHashtag
                  ? "Try another hashtag or return to all posts."
                  : "Be the first to share something with the community."}
              </p>
              {activeHashtag && (
                <Link
                  to={APP_ROUTES.home}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all posts
                </Link>
              )}
            </div>
          ) : (
            <section className="space-y-4" aria-labelledby="home-posts-heading">
              {visiblePosts.map((post) => (
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
                        ) : post.author_user_id === user?.id ? (
                          <Link to={APP_ROUTES.profile} className="shrink-0">
                            <img
                              src={getMediaUrl(
                                user.avatar_storage_key,
                                DEFAULT_AVATAR
                              )}
                              alt={user.full_name}
                              className="size-12 rounded-full object-cover ring-2 ring-primary/20 transition-opacity hover:opacity-90"
                            />
                          </Link>
                        ) : (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Users aria-hidden="true" className="size-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {post.is_anonymous ? (
                              "Anonymous"
                            ) : post.author_user_id === user?.id ? (
                              <Link
                                to={APP_ROUTES.profile}
                                className="hover:underline"
                              >
                                @{user.user_handle}
                              </Link>
                            ) : (
                              `User #${post.author_user_id ?? "—"}`
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(post.created_at)}
                            {post.edited_at && (
                              <span title={formatDateTime(post.edited_at)}>
                                {" "}
                                · edited
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground capitalize">
                        {visibilityOptions.map(
                          ({ value, Icon, iconClassName }) =>
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

                    {editingPostId === post.id ? (
                      <PostEditor
                        initialValue={post.body}
                        onCancel={() => setEditingPostId(null)}
                        onSave={(body) => handleEditPost(post.id, body)}
                      />
                    ) : (
                      <p className="text-sm leading-6 whitespace-pre-wrap text-foreground sm:text-[15px]">
                        <RichText>{post.body}</RichText>
                      </p>
                    )}

                    {/* Render Attached Media (PDF, Images, Videos) */}
                    {post.media && post.media.length > 0 && (
                      <div className="mt-3 flex flex-col gap-2.5 pt-1">
                        {/* Images gallery */}
                        {post.media.filter((m) => m.media_type === "image")
                          .length > 0 && (
                          <div
                            className={`grid gap-2 ${
                              post.media.filter((m) => m.media_type === "image")
                                .length === 1
                                ? "grid-cols-1"
                                : "grid-cols-2"
                            }`}
                          >
                            {post.media
                              .filter((m) => m.media_type === "image")
                              .map((m) => (
                                <div
                                  key={m.id ?? m.storage_key}
                                  className="overflow-hidden rounded-lg border border-border bg-muted/20"
                                >
                                  <img
                                    src={getMediaUrl(m.storage_key)}
                                    alt={m.alt_text || m.file_name}
                                    className="max-h-96 w-full object-cover transition-transform duration-200 hover:scale-[1.01]"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                          </div>
                        )}

                        {/* Videos */}
                        {post.media
                          .filter((m) => m.media_type === "video")
                          .map((m) => (
                            <div
                              key={m.id ?? m.storage_key}
                              className="overflow-hidden rounded-lg border border-border bg-black"
                            >
                              <video
                                src={getMediaUrl(m.storage_key)}
                                controls
                                className="max-h-96 w-full"
                                preload="metadata"
                              />
                            </div>
                          ))}

                        {/* PDFs & Documents */}
                        {post.media
                          .filter(
                            (m) =>
                              m.media_type === "document" ||
                              m.file_name.toLowerCase().endsWith(".pdf")
                          )
                          .map((m) => (
                            <a
                              key={m.id ?? m.storage_key}
                              href={getMediaUrl(m.storage_key)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 p-3 text-sm transition-colors hover:bg-muted"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400">
                                  <FileText className="size-5" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-foreground sm:text-sm">
                                    {m.file_name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    PDF Document{" "}
                                    {m.file_size_bytes
                                      ? `· ${formatFileSize(m.file_size_bytes)}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 text-xs font-medium text-primary hover:underline">
                                View / Download
                              </span>
                            </a>
                          ))}
                      </div>
                    )}
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
                                ? "text-rose-600 hover:text-rose-600! dark:text-rose-400 dark:hover:text-rose-400!"
                                : "text-muted-foreground hover:text-rose-600! dark:hover:text-rose-400!"
                            }
                            onClick={() => void handleLike(post.id)}
                          >
                            <Heart
                              aria-hidden="true"
                              className={
                                post.is_liked
                                  ? "fill-current"
                                  : "group-hover/button:fill-current"
                              }
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
                              ? "text-amber-600! hover:text-amber-600! dark:text-amber-400! dark:hover:text-amber-400!"
                              : "text-muted-foreground hover:text-amber-600! dark:hover:text-amber-400!"
                          }
                          aria-expanded={!!openComments[post.id]}
                          onClick={() => void toggleComments(post.id)}
                        >
                          <MessageCircleText
                            aria-hidden="true"
                            className={
                              openComments[post.id]
                                ? "fill-current"
                                : "group-hover/button:fill-current"
                            }
                          />
                          {post.comment_count}
                        </Button>
                        {isAuthenticated && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-pressed={post.is_reposted}
                            className={
                              post.is_reposted
                                ? "text-emerald-600! hover:text-emerald-600! dark:text-emerald-400! dark:hover:text-emerald-400!"
                                : "text-muted-foreground hover:text-emerald-600! dark:hover:text-emerald-400!"
                            }
                            title={
                              post.is_reposted
                                ? "Remove repost"
                                : "Repost to your profile"
                            }
                            onClick={() => void handleRepost(post.id)}
                          >
                            <Repeat2 aria-hidden="true" />
                            {post.repost_count > 0
                              ? post.repost_count
                              : "Repost"}
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {postMenuItems(post).length > 0 && (
                          <PostMenu items={postMenuItems(post)} />
                        )}
                      </div>
                    </div>
                  </CardContent>

                  {(isAuthenticated || openComments[post.id]) && (
                    <CardFooter className="flex-col items-stretch gap-4 border-t border-border/60 bg-muted/20 px-5 py-4 sm:px-6">
                      {openComments[post.id] && (
                        <div className="space-y-3" aria-live="polite">
                          {loadingComments[post.id] ? (
                            <p className="text-sm text-muted-foreground">
                              Loading comments…
                            </p>
                          ) : comments[post.id]?.length ? (
                            <CommentThread
                              comments={comments[post.id]}
                              user={user}
                              onReply={(parentId, body) =>
                                handleReply(post.id, parentId, body)
                              }
                              onEdit={(commentId, body) =>
                                handleEditComment(post.id, commentId, body)
                              }
                              onDelete={(commentId) =>
                                setDeleteConfirmation({
                                  type: "comment",
                                  postId: post.id,
                                  commentId,
                                })
                              }
                              onLike={(commentId) =>
                                handleCommentLike(post.id, commentId)
                              }
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 py-3 text-center">
                              <MessageSquareText
                                aria-hidden="true"
                                className="size-5 text-muted-foreground"
                              />
                              <p className="text-sm text-muted-foreground">
                                No comments yet. Start the conversation.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {isAuthenticated && (
                        <form
                          className="flex items-center gap-2"
                          onSubmit={(event) => {
                            event.preventDefault()
                            void handleComment(post.id)
                          }}
                        >
                          <img
                            src={getMediaUrl(
                              user?.avatar_storage_key,
                              DEFAULT_AVATAR
                            )}
                            alt=""
                            className="size-8 shrink-0 rounded-full border border-border object-cover"
                          />
                          <div className="relative min-w-0 flex-1">
                            <input
                              ref={(element) => {
                                commentInputRefs.current[post.id] = element
                              }}
                              aria-label="Write a comment"
                              className="h-10 w-full min-w-0 rounded-full border border-input bg-background pr-11 pl-4 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                              placeholder="Write a comment…"
                              value={commentDrafts[post.id] ?? ""}
                              onChange={(event) =>
                                setCommentDrafts((current) => ({
                                  ...current,
                                  [post.id]: event.target.value,
                                }))
                              }
                            />
                            <EmojiPicker
                              className="absolute top-1/2 right-1 -translate-y-1/2"
                              onSelect={(emoji) =>
                                insertCommentEmoji(post.id, emoji)
                              }
                            />
                          </div>
                          <Button
                            type="submit"
                            size="icon"
                            className="shrink-0 rounded-full"
                            aria-label="Post comment"
                            title="Post comment"
                            disabled={!(commentDrafts[post.id] ?? "").trim()}
                          >
                            <Send aria-hidden="true" />
                          </Button>
                        </form>
                      )}
                    </CardFooter>
                  )}
                </Card>
              ))}
            </section>
          )}
        </div>
        <aside className="sticky top-24 hidden self-start xl:block">
          <TrendingCard />
        </aside>
      </div>
      {savingPostId !== null && (
        <SavePostDialog
          postId={savingPostId}
          onClose={() => setSavingPostId(null)}
          onSaved={(collectionName) =>
            handleSaved(savingPostId, collectionName)
          }
        />
      )}
      {sharingPost && (
        <SharePostDialog
          url={`${window.location.origin}${APP_ROUTES.post(sharingPost.public_post_id)}`}
          onClose={() => setSharingPost(null)}
        />
      )}
      {deleteConfirmation && (
        <ConfirmationDialog
          title={
            deleteConfirmation.type === "post"
              ? "Delete this post?"
              : "Delete this comment?"
          }
          description={
            deleteConfirmation.type === "post"
              ? "This post will be removed from the feed. This action cannot be undone."
              : "This comment will be removed from the conversation. This action cannot be undone."
          }
          confirmLabel={
            deleteConfirmation.type === "post" ? "OK, delete post" : "OK, delete comment"
          }
          onClose={() => setDeleteConfirmation(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  )
}
