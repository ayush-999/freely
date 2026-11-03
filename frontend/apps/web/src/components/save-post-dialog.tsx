import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Bookmark, Check, Folder, Plus, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { getApiErrorMessage } from "@workspace/utils"

import { socialService } from "@/services/social.service"
import type { BookmarkCollection } from "@/types"

type Choice = number | "new" | null

/** Asks where to file a post when saving: a collection, a new one, or just saved. */
export function SavePostDialog({
  postId,
  onClose,
  onSaved,
}: {
  postId: number
  onClose: () => void
  onSaved: (collectionName: string | null) => void
}) {
  const [collections, setCollections] = useState<BookmarkCollection[] | null>(
    null
  )
  const [choice, setChoice] = useState<Choice>(null)
  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    socialService
      .getCollections()
      .then((list) => {
        if (!cancelled) setCollections(list)
      })
      .catch(() => {
        if (!cancelled) setCollections([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const needsName = choice === "new" && !newName.trim()

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      let target: BookmarkCollection | null = null
      if (choice === "new") {
        target = await socialService.createCollection(newName.trim())
      } else if (typeof choice === "number") {
        target = collections?.find((item) => item.id === choice) ?? null
      }

      const result = await socialService.toggleBookmark(postId)
      if (result.message !== "bookmarked") {
        // Already saved elsewhere: the toggle removed it, so toggle back.
        await socialService.toggleBookmark(postId)
      }
      if (target) await socialService.addToCollection(target.id, postId)
      onSaved(target?.name ?? null)
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Could not save the post"))
      setBusy(false)
    }
  }

  const optionClassName = (selected: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      selected
        ? "border-primary bg-primary/10"
        : "border-border hover:bg-muted/60"
    )

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-post-title"
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="save-post-title" className="text-base font-semibold">
              Save post
            </h2>
            <p className="text-xs text-muted-foreground">
              Add it to a collection, or just save it.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <div
          className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1"
          role="radiogroup"
        >
          <button
            type="button"
            role="radio"
            aria-checked={choice === null}
            onClick={() => setChoice(null)}
            className={optionClassName(choice === null)}
          >
            <Bookmark aria-hidden="true" className="size-4 text-blue-500" />
            <span className="flex-1">
              <span className="block font-medium">Just save</span>
              <span className="block text-xs text-muted-foreground">
                Keep it in All saved
              </span>
            </span>
            {choice === null && <Check aria-hidden="true" className="size-4" />}
          </button>

          {collections?.map((collection) => (
            <button
              key={collection.id}
              type="button"
              role="radio"
              aria-checked={choice === collection.id}
              onClick={() => setChoice(collection.id)}
              className={optionClassName(choice === collection.id)}
            >
              <Folder aria-hidden="true" className="size-4 text-violet-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {collection.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {collection.post_count}{" "}
                  {collection.post_count === 1 ? "post" : "posts"}
                </span>
              </span>
              {choice === collection.id && (
                <Check aria-hidden="true" className="size-4" />
              )}
            </button>
          ))}

          <button
            type="button"
            role="radio"
            aria-checked={choice === "new"}
            onClick={() => setChoice("new")}
            className={optionClassName(choice === "new")}
          >
            <Plus aria-hidden="true" className="size-4 text-emerald-500" />
            <span className="flex-1 font-medium">New collection</span>
            {choice === "new" && (
              <Check aria-hidden="true" className="size-4" />
            )}
          </button>
          {choice === "new" && (
            <input
              autoFocus
              value={newName}
              maxLength={100}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Collection name"
              aria-label="New collection name"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          )}
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || needsName || collections === null}
          >
            Save
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
