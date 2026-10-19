import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  formatDate,
  formatDateTime,
  getApiErrorMessage,
} from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { useAuth } from "@/hooks/use-auth"
import { jobService } from "@/services/job.service"
import type { Job } from "@/types"

export function JobDetailPage() {
  const { publicJobId } = useParams<{ publicJobId: string }>()
  const { isAuthenticated } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!publicJobId) {
      return
    }
    jobService
      .getJob(publicJobId)
      .then(setJob)
      .catch((jobError) => setError(getApiErrorMessage(jobError)))
      .finally(() => setLoading(false))
  }, [publicJobId])

  async function handleApply() {
    if (!job) {
      return
    }
    setNotice(null)
    try {
      await jobService.apply(job.id, {})
      setNotice("Application submitted.")
    } catch (applyError) {
      setNotice(getApiErrorMessage(applyError))
    }
  }

  async function handleSave() {
    if (!job) {
      return
    }
    const result = await jobService.toggleSavedJob(job.id)
    setNotice(result.message)
  }

  if (!publicJobId) {
    return <p className="text-sm text-destructive">Missing job id</p>
  }
  if (loading) {
    return <LoadingFallback label="Loading job…" />
  }
  if (error || !job) {
    return (
      <p className="text-sm text-destructive">{error ?? "Job not found"}</p>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{job.title}</CardTitle>
              <CardDescription>
                {[job.city, job.state, job.country]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="capitalize">
              {job.job_type.replaceAll("_", " ")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {job.employment_type && (
              <>
                <dt className="text-muted-foreground">Employment</dt>
                <dd className="capitalize sm:col-span-2">
                  {job.employment_type.replaceAll("_", " ")}
                </dd>
              </>
            )}
            {job.workplace_type && (
              <>
                <dt className="text-muted-foreground">Workplace</dt>
                <dd className="capitalize sm:col-span-2">
                  {job.workplace_type}
                </dd>
              </>
            )}
            {(job.salary_min !== null || job.salary_max !== null) && (
              <>
                <dt className="text-muted-foreground">Salary</dt>
                <dd className="sm:col-span-2">
                  {job.salary_min ?? "—"} – {job.salary_max ?? "—"}{" "}
                  {job.salary_currency ?? ""}{" "}
                  {job.salary_period ? `(${job.salary_period})` : ""}
                </dd>
              </>
            )}
            {job.application_deadline && (
              <>
                <dt className="text-muted-foreground">Apply by</dt>
                <dd className="sm:col-span-2">
                  {formatDate(job.application_deadline)}
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Posted</dt>
            <dd className="sm:col-span-2">
              {formatDateTime(job.published_at ?? job.created_at)}
            </dd>
          </dl>
          <p className="text-sm whitespace-pre-wrap">{job.description}</p>
          <div className="flex flex-wrap items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button onClick={() => void handleApply()}>Apply</Button>
                <Button variant="outline" onClick={() => void handleSave()}>
                  Save
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link to={APP_ROUTES.login}>Log in to apply</Link>
              </Button>
            )}
          </div>
          {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
