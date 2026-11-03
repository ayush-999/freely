import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Heart, Send } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { EmojiPicker, insertAtSelection } from "@/components/emoji-picker"
import { RichText } from "@/components/rich-text"
import type { Comment, UserMe } from "@/types"
import { DEFAULT_AVATAR, getMediaUrl } from "@/utils/media"

const MAX_INDENT_DEPTH = 3

function InlineComposer({
  initialValue = "",
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValue?: string
  placeholder: string
  submitLabel: string
  onSubmit: (body: string) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function addEmoji(emoji: string) {
    const field = inputRef.current
    const next = insertAtSelection(field, value, emoji)
    setValue(next.value)
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(next.caret, next.caret)
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const body = value.trim()
    if (!body) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(body)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Could not save the comment"))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            autoFocus
            aria-label={placeholder}
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel()
            }}
            className="h-9 w-full min-w-0 rounded-full border border-input bg-background pr-11 pl-4 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
          <EmojiPicker
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onSelect={addEmoji}
          />
        </div>
        <Button
          type="submit"
          size="icon-sm"
          className="shrink-0 rounded-full"
          aria-label={submitLabel}
          title={submitLabel}
          disabled={busy || !value.trim()}
        >
          <Send aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="px-2 text-xs text-destructive">{error}</p>}
    </form>
  )
}

interface ThreadState {
  user: UserMe | null
  childrenByParent: Map<number, Comment[]>
  replyingTo: number | null
  setReplyingTo: (id: number | null) => void
  editingId: number | null
  setEditingId: (id: number | null) => void
  onReply: (parentId: number, body: string) => Promise<void>
  onEdit: (commentId: number, body: string) => Promise<void>
  onDelete: (commentId: number) => void
  onLike: (commentId: number) => Promise<void>
}

const actionClassName =
  "text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"

function CommentNode({
  comment,
  depth,
  thread,
}: {
  comment: Comment
  depth: number
  thread: ThreadState
}) {
  const { user } = thread
  const isMine = !!user && comment.user_id === user.id
  const replies = thread.childrenByParent.get(comment.id) ?? []
  const isEditing = thread.editingId === comment.id
  const isReplying = thread.replyingTo === comment.id

  return (
    <div>
      <article
        className={cn("flex items-end gap-2.5", isMine && "flex-row-reverse")}
      >
        <img
          src={
            isMine
              ? getMediaUrl(user.avatar_storage_key, DEFAULT_AVATAR)
              : DEFAULT_AVATAR
          }
          alt=""
          className="size-8 shrink-0 rounded-full border border-border object-cover"
        />
        <div
          className={cn(
            "flex max-w-[80%] min-w-0 flex-col gap-1",
            isMine ? "items-end" : "items-start",
            isEditing && "w-full max-w-full"
          )}
        >
          {isEditing ? (
            <InlineComposer
              initialValue={comment.body}
              placeholder="Edit your comment"
              submitLabel="Save comment"
              onCancel={() => thread.setEditingId(null)}
              onSubmit={async (body) => {
                await thread.onEdit(comment.id, body)
                thread.setEditingId(null)
              }}
            />
          ) : (
            <div
              className={cn(
                "min-w-0 rounded-2xl border px-3.5 py-2 shadow-xs",
                isMine
                  ? "rounded-br-sm border-primary/30 bg-primary/15"
                  : "rounded-bl-sm border-border/50 bg-background"
              )}
            >
              <div
                className={cn(
                  "flex items-baseline gap-3",
                  isMine ? "flex-row-reverse" : "justify-between"
                )}
              >
                {!isMine && (
                  <Link
                    to={`/u/${comment.user_handle}`}
                    className="truncate text-xs font-semibold text-foreground hover:underline"
                  >
                    {comment.full_name}
                  </Link>
                )}
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  <time>{formatDateTime(comment.created_at)}</time>
                  {comment.updated_at && (
                    <span title={formatDateTime(comment.updated_at)}>
                      {" "}
                      · edited
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">
                <RichText>{comment.body}</RichText>
              </p>
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center gap-3 px-1">
              {user ? (
                <button
                  type="button"
                  aria-pressed={comment.is_liked}
                  onClick={() => void thread.onLike(comment.id)}
                  className={cn(
                    actionClassName,
                    "flex items-center gap-1 hover:text-rose-600! dark:hover:text-rose-400!",
                    comment.is_liked && "text-rose-600! dark:text-rose-400!"
                  )}
                >
                  <Heart
                    aria-hidden="true"
                    className={cn(
                      "size-3.5",
                      comment.is_liked && "fill-current"
                    )}
                  />
                  {comment.like_count > 0 ? comment.like_count : "Like"}
                </button>
              ) : (
                comment.like_count > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Heart aria-hidden="true" className="size-3.5" />
                    {comment.like_count}
                  </span>
                )
              )}
              {user && (
                <button
                  type="button"
                  className={actionClassName}
                  onClick={() =>
                    thread.setReplyingTo(isReplying ? null : comment.id)
                  }
                >
                  Reply
                </button>
              )}
              {isMine && comment.can_edit && (
                <button
                  type="button"
                  className={actionClassName}
                  onClick={() => thread.setEditingId(comment.id)}
                >
                  Edit
                </button>
              )}
              {comment.can_delete && (
                <button
                  type="button"
                  className={actionClassName}
                  onClick={() => void thread.onDelete(comment.id)}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </article>

      {(replies.length > 0 || isReplying) && (
        <div
          className={cn(
            "mt-2 space-y-3",
            depth < MAX_INDENT_DEPTH &&
              "ml-4 border-l border-border/60 pl-3 sm:ml-10"
          )}
        >
          {replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              thread={thread}
            />
          ))}
          {isReplying && (
            <InlineComposer
              placeholder={`Reply to ${comment.full_name}…`}
              submitLabel="Post reply"
              onCancel={() => thread.setReplyingTo(null)}
              onSubmit={async (body) => {
                await thread.onReply(comment.id, body)
                thread.setReplyingTo(null)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Comments shown as a conversation; replies nest under the comment they answer. */
export function CommentThread({
  comments,
  user,
  onReply,
  onEdit,
  onDelete,
  onLike,
}: {
  comments: Comment[]
  user: UserMe | null
  onReply: ThreadState["onReply"]
  onEdit: ThreadState["onEdit"]
  onDelete: ThreadState["onDelete"]
  onLike: ThreadState["onLike"]
}) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const ids = new Set(comments.map((comment) => comment.id))
  const childrenByParent = new Map<number, Comment[]>()
  const roots: Comment[] = []
  for (const comment of comments) {
    const parentId = comment.parent_comment_id
    if (parentId !== null && ids.has(parentId)) {
      childrenByParent.set(parentId, [
        ...(childrenByParent.get(parentId) ?? []),
        comment,
      ])
    } else {
      roots.push(comment)
    }
  }

  const thread: ThreadState = {
    user,
    childrenByParent,
    replyingTo,
    setReplyingTo,
    editingId,
    setEditingId,
    onReply,
    onEdit,
    onDelete,
    onLike,
  }

  return (
    <div className="space-y-3">
      {roots.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          depth={0}
          thread={thread}
        />
      ))}
    </div>
  )
}
