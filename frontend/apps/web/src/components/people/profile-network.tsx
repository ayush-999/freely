import { useCallback, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { useAuth } from "@/hooks/use-auth"
import { useRelationship } from "@/hooks/use-relationship"
import type { NetworkList } from "@/types/relationship"
import { PeopleListDialog } from "./people-list-dialog"
import { UserActions } from "./user-actions"

export function ProfileNetwork({
  handle,
  actions = false,
  compact = false,
}: {
  handle: string
  actions?: boolean
  compact?: boolean
}) {
  const { user } = useAuth()
  return (
    <Network
      key={`${user?.user_handle ?? "guest"}:${handle}`}
      handle={handle}
      actions={actions}
      compact={compact}
    />
  )
}

function Network({
  handle,
  actions,
  compact,
}: {
  handle: string
  actions: boolean
  compact: boolean
}) {
  const { summary, error, loading, retry } = useRelationship(handle)
  const [list, setList] = useState<NetworkList | null>(null)
  const close = useCallback(() => setList(null), [])
  return (
    <div
      className={
        compact
          ? "mt-3 border-t border-border/60 pt-3"
          : "mt-4 space-y-2 border-t border-border/60 pt-4"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <button
            type="button"
            className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            disabled={loading || !summary}
            onClick={() => setList("followers")}
            aria-label={`${summary?.followers_count ?? 0} Followers`}
          >
            <span className="font-semibold text-foreground">
              {summary ? summary.followers_count.toLocaleString() : "—"}
            </span>{" "}
            Followers
          </button>
          <button
            type="button"
            className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            disabled={loading || !summary}
            onClick={() => setList("following")}
            aria-label={`${summary?.following_count ?? 0} Following`}
          >
            <span className="font-semibold text-foreground">
              {summary ? summary.following_count.toLocaleString() : "—"}
            </span>{" "}
            Following
          </button>
          {summary?.follows_you && (
            <Badge variant="secondary">Follows you</Badge>
          )}
        </div>
        {actions && <UserActions handle={handle} />}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={retry}>
            Retry
          </button>
        </p>
      )}
      {list && <PeopleListDialog handle={handle} list={list} onClose={close} />}
    </div>
  )
}
