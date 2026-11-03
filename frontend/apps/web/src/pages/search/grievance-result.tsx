import { useState } from "react"
import { createPortal } from "react-dom"
import { Eye, X } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { formatDateTime } from "@workspace/utils"

import type { GrievanceTrackingView } from "@/types"

function formatStatus(status: string) {
  return status.replaceAll("_", " ")
}

function TrackingDialog({
  grievance,
  onClose,
}: {
  grievance: GrievanceTrackingView
  onClose: () => void
}) {
  const location = [grievance.district, grievance.state]
    .filter(Boolean)
    .join(", ")

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-16"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-dialog-title"
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="tracking-dialog-title"
              className="truncate text-base font-semibold"
            >
              {grievance.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {grievance.tracking_number} · Priority: {grievance.priority}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {formatStatus(grievance.status)}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              autoFocus
              onClick={onClose}
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatDateTime(grievance.submitted_at)}</dd>
          <dt className="text-muted-foreground">Acknowledged</dt>
          <dd>{formatDateTime(grievance.acknowledged_at)}</dd>
          <dt className="text-muted-foreground">Resolved</dt>
          <dd>{formatDateTime(grievance.resolved_at)}</dd>
          <dt className="text-muted-foreground">Closed</dt>
          <dd>{formatDateTime(grievance.closed_at)}</dd>
          {location && (
            <>
              <dt className="text-muted-foreground">Location</dt>
              <dd>{location}</dd>
            </>
          )}
        </dl>
      </div>
    </div>,
    document.body
  )
}

/** Search-result row for a grievance; the eye icon opens its tracking popup. */
export function GrievanceRow({
  grievance,
}: {
  grievance: GrievanceTrackingView
}) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {grievance.tracking_number}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {grievance.title}
        </p>
      </div>
      <Badge variant="secondary" className="shrink-0 capitalize">
        {formatStatus(grievance.status)}
      </Badge>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="View tracking details"
        title="View tracking details"
        onClick={() => setDialogOpen(true)}
      >
        <Eye aria-hidden="true" className="size-4" />
      </Button>
      {dialogOpen && (
        <TrackingDialog
          grievance={grievance}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  )
}
