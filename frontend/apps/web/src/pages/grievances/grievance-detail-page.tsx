import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useParams } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { notificationService } from "@/services/notification.service"
import { slaService } from "@/services/sla.service"
import { workflowService } from "@/services/workflow.service"
import type {
  FeedbackType,
  GrievanceResponseDto,
  SlaClock,
  StatusHistoryEntry,
} from "@/types"

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

type FeedbackFormValues = {
  feedback_type: FeedbackType
  rating: number
  comments: string
}

/** Grievance detail: status timeline, official responses, SLA clock, feedback. */
export function GrievanceDetailPage() {
  const { grievanceId } = useParams<{ grievanceId: string }>()
  const id = Number(grievanceId)
  const isValidId = Number.isInteger(id) && id > 0

  const [history, setHistory] = useState<StatusHistoryEntry[] | null>(null)
  const [responses, setResponses] = useState<GrievanceResponseDto[] | null>(
    null
  )
  const [clock, setClock] = useState<SlaClock | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackFormValues>({
    defaultValues: { feedback_type: "satisfaction", rating: 5, comments: "" },
  })

  useEffect(() => {
    if (!isValidId) {
      return
    }
    // Each section is optional per role — load independently.
    Promise.allSettled([
      workflowService.getHistory(id),
      workflowService.listResponses(id),
      slaService.getClock(id),
    ]).then(([historyResult, responsesResult, clockResult]) => {
      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value)
      }
      if (responsesResult.status === "fulfilled") {
        setResponses(responsesResult.value)
      }
      if (clockResult.status === "fulfilled") {
        setClock(clockResult.value)
      }
      if (
        historyResult.status === "rejected" &&
        responsesResult.status === "rejected" &&
        clockResult.status === "rejected"
      ) {
        setError(getApiErrorMessage(historyResult.reason))
      }
      setLoading(false)
    })
  }, [id, isValidId])

  async function onFeedback(values: FeedbackFormValues) {
    setFeedbackMessage(null)
    try {
      await notificationService.submitFeedback(id, {
        feedback_type: values.feedback_type,
        rating: values.rating,
        ...(values.comments.trim() ? { comments: values.comments.trim() } : {}),
      })
      setFeedbackMessage("Feedback submitted. Thank you!")
      setValue("comments", "")
    } catch (feedbackError) {
      setFeedbackMessage(getApiErrorMessage(feedbackError))
    }
  }

  if (!isValidId) {
    return <p className="text-sm text-destructive">Invalid grievance id</p>
  }
  if (loading) {
    return <LoadingFallback label="Loading grievance…" />
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Grievance #{id}</h1>

      {clock && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">SLA clock</CardTitle>
              <Badge
                variant={clock.breached_at ? "destructive" : "secondary"}
                className="capitalize"
              >
                {clock.clock_status.replaceAll("_", " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <dt className="text-muted-foreground">Ack due</dt>
              <dd className="sm:col-span-2">
                {formatDateTime(clock.acknowledgement_due_at)}
              </dd>
              <dt className="text-muted-foreground">First response due</dt>
              <dd className="sm:col-span-2">
                {formatDateTime(clock.first_response_due_at)}
              </dd>
              <dt className="text-muted-foreground">Resolution due</dt>
              <dd className="sm:col-span-2">
                {formatDateTime(clock.resolution_due_at)}
              </dd>
              {clock.breach_reason && (
                <>
                  <dt className="text-muted-foreground">Breach reason</dt>
                  <dd className="sm:col-span-2">{clock.breach_reason}</dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {history && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <Badge variant="outline" className="mt-0.5 capitalize">
                    {entry.new_status.replaceAll("_", " ")}
                  </Badge>
                  <div>
                    <p className="text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                      {entry.previous_status &&
                        ` · from ${entry.previous_status.replaceAll("_", " ")}`}
                    </p>
                    {entry.change_reason && <p>{entry.change_reason}</p>}
                  </div>
                </li>
              ))}
              {history.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No status changes yet.
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      )}

      {responses && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Official responses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {responses.length === 0 && (
              <p className="text-sm text-muted-foreground">No responses yet.</p>
            )}
            {responses.map((response) => (
              <div key={response.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {response.response_type.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(response.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{response.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Give feedback</CardTitle>
          <CardDescription>
            A complaint or appeal reopens this grievance automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onFeedback)}
            className="flex flex-col gap-4"
            noValidate
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="feedbackType">Type</Label>
                <select
                  id="feedbackType"
                  className={selectClassName}
                  {...register("feedback_type")}
                >
                  <option value="satisfaction">Satisfaction</option>
                  <option value="complaint_reopened">Complaint</option>
                  <option value="appeal">Appeal</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rating">Rating</Label>
                <select
                  id="rating"
                  className={selectClassName}
                  {...register("rating", {
                    valueAsNumber: true,
                    validate: (value) =>
                      (Number.isInteger(value) && value >= 1 && value <= 5) ||
                      "Rating must be between 1 and 5",
                  })}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
                {errors.rating && (
                  <p className="text-xs text-destructive">
                    {errors.rating.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="comments">Comments (optional)</Label>
              <Textarea id="comments" {...register("comments")} />
            </div>
            {feedbackMessage && (
              <p className="text-sm text-muted-foreground">{feedbackMessage}</p>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending…" : "Submit feedback"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
