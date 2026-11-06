import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, Loader2, Users, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { tokenStorage } from "@workspace/auth"
import { getApiErrorMessage } from "@workspace/utils"
import { useAuth } from "@/hooks/use-auth"
import { RELATIONSHIP_CHANGED } from "@/hooks/use-relationship"
import { relationshipService } from "@/services/relationship.service"
import type { NetworkList, PeoplePage } from "@/types/relationship"
import { PersonRow } from "./person-row"

export function PeopleListDialog({
  handle,
  list,
  onClose,
}: {
  handle: string
  list: NetworkList
  onClose: () => void
}) {
  const { user } = useAuth()
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const key = `${user?.user_handle ?? "guest"}:${handle}:${list}:${offset}`
  const [result, setResult] = useState<{
    key: string
    page: PeoplePage | null
    error: string | null
  } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const abort = new AbortController()
    relationshipService
      .people(handle, list, offset, {
        signal: abort.signal,
        token: tokenStorage.get(),
      })
      .then((page) => {
        if (!abort.signal.aborted) setResult({ key, page, error: null })
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setResult({
            key,
            page: null,
            error: getApiErrorMessage(error, "Could not load these people."),
          })
      })
    return () => abort.abort()
  }, [handle, list, offset, key, revision])
  useEffect(() => {
    const changed = () => setRevision((value) => value + 1)
    window.addEventListener(RELATIONSHIP_CHANGED, changed)
    return () => window.removeEventListener(RELATIONSHIP_CHANGED, changed)
  }, [])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    box.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
      if (event.key !== "Tab") return
      const items = box.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]'
      )
      if (!items?.length) return
      const first = items[0],
        last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener("keydown", keydown)
      previous?.focus()
    }
  }, [onClose])

  const current = result?.key === key ? result : null
  const page = current?.page
  const title = list === "followers" ? "Followers" : "Following"
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-xl rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <p className="text-xs text-muted-foreground">@{handle}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close people list"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="mt-4 max-h-[60svh] space-y-1 overflow-y-auto">
          {!current ? (
            <p
              role="status"
              className="flex items-center gap-2 p-3 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Loading people…
            </p>
          ) : current.error ? (
            <div
              role="alert"
              className="space-y-2 p-3 text-sm text-destructive"
            >
              <p>{current.error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevision((value) => value + 1)}
              >
                Retry
              </Button>
            </div>
          ) : !page?.items.length ? (
            <div className="space-y-2 p-6 text-center text-muted-foreground">
              <Users className="mx-auto size-7" />
              <p className="text-sm">
                {offset
                  ? "No more people on this page."
                  : list === "followers"
                    ? "No followers yet."
                    : "Not following anyone yet."}
              </p>
            </div>
          ) : (
            page.items.map((person) => (
              <PersonRow
                key={person.user_handle}
                person={person}
                onNavigate={onClose}
              />
            ))
          )}
        </div>
        {page && (offset > 0 || page.total > page.limit) && (
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - page.limit))}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {page.total.toLocaleString()} people
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + page.limit >= page.total}
              onClick={() => setOffset(offset + page.limit)}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
