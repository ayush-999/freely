import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bookmark,
  Check,
  FolderPlus,
  Folder,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { getApiErrorMessage } from "@workspace/utils"

import { ConfirmationDialog } from "@/components/confirmation-dialog"
import { LoadingFallback } from "@/components/loading-fallback"
import { ProfilePostCard } from "@/components/profile-posts"
import { socialService } from "@/services/social.service"
import type { BookmarkCollection, SavedPost } from "@/types"

const ALL_SAVED = 0

type SavedResult = {
  key: number
  posts: SavedPost[]
  error: string | null
}

function CollectionMenu({
  post,
  collections,
  onToggle,
}: {
  post: SavedPost
  collections: BookmarkCollection[]
  onToggle: (collection: BookmarkCollection) => void
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-violet-500!"
      >
        <FolderPlus aria-hidden="true" className="size-3.5" />
        Collections
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-40 mb-2 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {collections.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No collections yet. Create one above, then add this post to it.
            </p>
          ) : (
            collections.map((collection) => {
              const isMember = post.collection_ids.includes(collection.id)
              return (
                <button
                  key={collection.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isMember}
                  onClick={() => onToggle(collection)}
                  className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none"
                >
                  <Folder
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {collection.name}
                  </span>
                  {isMember && (
                    <Check
                      aria-hidden="true"
                      className="size-4 shrink-0 text-emerald-500"
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export function SavedPage() {
  const [collections, setCollections] = useState<BookmarkCollection[] | null>(
    null
  )
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<BookmarkCollection | null>(null)
  const [activeKey, setActiveKey] = useState(ALL_SAVED)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<SavedResult | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    socialService
      .getCollections()
      .then((list) => {
        if (!cancelled) setCollections(list)
      })
      .catch((loadError) => {
        if (!cancelled) {
          setCollections([])
          setError(getApiErrorMessage(loadError, "Could not load collections"))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    socialService
      .getSavedPosts(activeKey === ALL_SAVED ? undefined : activeKey)
      .then((posts) => {
        if (!cancelled) setResult({ key: activeKey, posts, error: null })
      })
      .catch((loadError) => {
        if (!cancelled)
          setResult({
            key: activeKey,
            posts: [],
            error: getApiErrorMessage(loadError, "Could not load saved posts"),
          })
      })
    return () => {
      cancelled = true
    }
  }, [activeKey, reloadKey])

  const current = result?.key === activeKey ? result : null
  const activeCollection =
    collections?.find((collection) => collection.id === activeKey) ?? null

  function updatePosts(update: (posts: SavedPost[]) => SavedPost[]) {
    setResult((previous) =>
      previous ? { ...previous, posts: update(previous.posts) } : previous
    )
  }

  async function refreshCollections() {
    try {
      setCollections(await socialService.getCollections())
    } catch {
      // Counts are cosmetic; the next load refreshes them.
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return
    setFormError(null)
    try {
      const created = await socialService.createCollection(name)
      setCollections((list) => [...(list ?? []), created])
      setNewName("")
      setCreating(false)
    } catch (createError) {
      setFormError(getApiErrorMessage(createError, "Could not create it"))
    }
  }

  async function handleConfirmDeleteCollection() {
    if (!deleteConfirmation) return

    await socialService.deleteCollection(deleteConfirmation.id)
    setCollections((list) =>
      (list ?? []).filter((item) => item.id !== deleteConfirmation.id)
    )
    setActiveKey(ALL_SAVED)
    setReloadKey((key) => key + 1)
    setDeleteConfirmation(null)
  }

  async function handleToggleMembership(
    post: SavedPost,
    collection: BookmarkCollection
  ) {
    const isMember = post.collection_ids.includes(collection.id)
    try {
      if (isMember) {
        await socialService.removeFromCollection(collection.id, post.id)
      } else {
        await socialService.addToCollection(collection.id, post.id)
      }
      updatePosts((posts) =>
        isMember && activeKey === collection.id
          ? posts.filter((item) => item.id !== post.id)
          : posts.map((item) =>
              item.id === post.id
                ? {
                    ...item,
                    collection_ids: isMember
                      ? item.collection_ids.filter((id) => id !== collection.id)
                      : [...item.collection_ids, collection.id],
                  }
                : item
            )
      )
      void refreshCollections()
    } catch (membershipError) {
      setError(
        getApiErrorMessage(membershipError, "Could not update the collection")
      )
    }
  }

  async function handleUnsave(post: SavedPost) {
    try {
      await socialService.toggleBookmark(post.id)
      updatePosts((posts) => posts.filter((item) => item.id !== post.id))
      void refreshCollections()
    } catch (unsaveError) {
      setError(getApiErrorMessage(unsaveError, "Could not remove the post"))
    }
  }

  const chipClassName = (isActive: boolean) =>
    cn(
      "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
      isActive
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    )

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="space-y-2 pt-1">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
          FREELY SAVED
        </p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Saved
        </h1>
        <p className="text-sm text-muted-foreground">
          Posts you saved. File them into collections to keep them organised, or
          leave them here.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeKey === ALL_SAVED}
          onClick={() => setActiveKey(ALL_SAVED)}
          className={chipClassName(activeKey === ALL_SAVED)}
        >
          <Bookmark aria-hidden="true" className="size-3.5" />
          All saved
        </button>
        {(collections ?? []).map((collection) => (
          <button
            key={collection.id}
            type="button"
            role="tab"
            aria-selected={activeKey === collection.id}
            onClick={() => setActiveKey(collection.id)}
            className={chipClassName(activeKey === collection.id)}
          >
            <Folder aria-hidden="true" className="size-3.5" />
            <span className="max-w-40 truncate">{collection.name}</span>
            <span className="text-xs text-muted-foreground">
              {collection.post_count}
            </span>
          </button>
        ))}
        {creating ? (
          <form onSubmit={handleCreate} className="flex items-center gap-1.5">
            <input
              autoFocus
              value={newName}
              maxLength={100}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setCreating(false)
                  setFormError(null)
                }
              }}
              placeholder="Collection name"
              aria-label="Collection name"
              className="h-9 w-44 rounded-full border border-input bg-background px-3.5 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <Button
              type="submit"
              size="sm"
              className="rounded-full"
              disabled={!newName.trim()}
            >
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel"
              onClick={() => {
                setCreating(false)
                setFormError(null)
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(chipClassName(false), "border-dashed")}
          >
            <Plus aria-hidden="true" className="size-3.5" />
            New collection
          </button>
        )}
      </div>
      {formError && (
        <p className="-mt-3 text-xs text-destructive">{formError}</p>
      )}

      {activeCollection && (
        <div className="-mt-2 flex items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            Collection: <strong>{activeCollection.name}</strong>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive!"
            onClick={() => setDeleteConfirmation(activeCollection)}
          >
            <Trash2 aria-hidden="true" />
            Delete collection
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!current ? (
        <LoadingFallback label="Loading saved posts…" />
      ) : current.error ? (
        <p className="text-sm text-destructive">{current.error}</p>
      ) : current.posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
            <Bookmark aria-hidden="true" className="size-5" />
          </span>
          <p className="text-sm font-medium">
            {activeCollection
              ? "No posts in this collection yet"
              : "Nothing saved yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {activeCollection
              ? "Open All saved and use Collections on a post to add it here."
              : "Use Save on any post and it will show up here."}
          </p>
          {!activeCollection && (
            <Link
              to={APP_ROUTES.home}
              className="text-sm font-medium text-primary hover:underline"
            >
              Browse Home
            </Link>
          )}
        </div>
      ) : (
        current.posts.map((post) => (
          <ProfilePostCard
            key={post.id}
            post={post}
            actions={
              <>
                <CollectionMenu
                  post={post}
                  collections={collections ?? []}
                  onToggle={(collection) =>
                    void handleToggleMembership(post, collection)
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleUnsave(post)}
                  className="h-7 gap-1 px-2 text-xs text-blue-600 hover:text-blue-600! dark:text-blue-400 dark:hover:text-blue-400!"
                >
                  <Bookmark
                    aria-hidden="true"
                    className="size-3.5 fill-current"
                  />
                  Unsave
                </Button>
              </>
            }
          />
        ))
      )}
      {deleteConfirmation && (
        <ConfirmationDialog
          title="Delete this collection?"
          description={`Delete the collection "${deleteConfirmation.name}"? Its posts stay saved. This action cannot be undone.`}
          confirmLabel="OK, delete collection"
          onClose={() => setDeleteConfirmation(null)}
          onConfirm={handleConfirmDeleteCollection}
        />
      )}
    </div>
  )
}
