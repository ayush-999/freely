import { useState } from "react"
import { useForm } from "react-hook-form"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { grievanceService } from "@/services/grievance.service"
import type { GrievanceTrackingView } from "@/types"

type TrackFormValues = {
  tracking_number: string
}

/** Public grievance tracking by tracking number (no login required). */
export function TrackGrievancePage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TrackFormValues>({ defaultValues: { tracking_number: "" } })
  const [result, setResult] = useState<GrievanceTrackingView | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(values: TrackFormValues) {
    setError(null)
    setResult(null)
    try {
      setResult(await grievanceService.track(values.tracking_number.trim()))
    } catch (trackError) {
      setError(getApiErrorMessage(trackError, "Grievance not found"))
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Track a grievance</CardTitle>
          <CardDescription>
            Enter the tracking number you received when submitting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex gap-2"
            noValidate
          >
            <div className="grid flex-1 content-start gap-2">
              <Label htmlFor="trackingNumber" className="sr-only">
                Tracking number
              </Label>
              <Input
                id="trackingNumber"
                placeholder="e.g. GRV-2026-XXXXXX"
                aria-invalid={!!errors.tracking_number || undefined}
                {...register("tracking_number", {
                  required: "Tracking number is required",
                  validate: (value) =>
                    value.trim().length > 0 || "Tracking number is required",
                })}
              />
              {errors.tracking_number && (
                <p className="text-xs text-destructive">
                  {errors.tracking_number.message}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="self-start"
            >
              {isSubmitting ? "Searching…" : "Track"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{result.title}</CardTitle>
              <Badge variant="secondary" className="capitalize">
                {result.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <CardDescription>
              {result.tracking_number} · Priority: {result.priority}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{formatDateTime(result.submitted_at)}</dd>
              <dt className="text-muted-foreground">Acknowledged</dt>
              <dd>{formatDateTime(result.acknowledged_at)}</dd>
              <dt className="text-muted-foreground">Resolved</dt>
              <dd>{formatDateTime(result.resolved_at)}</dd>
              <dt className="text-muted-foreground">Closed</dt>
              <dd>{formatDateTime(result.closed_at)}</dd>
              {(result.district || result.state) && (
                <>
                  <dt className="text-muted-foreground">Location</dt>
                  <dd>
                    {[result.district, result.state].filter(Boolean).join(", ")}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
