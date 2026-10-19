import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Link } from "react-router-dom"

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
import { Input } from "@workspace/ui/components/input"
import { formatDate, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { jobService } from "@/services/job.service"
import type { Job, JobType } from "@/types"

const selectClassName =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"

type JobSearchValues = {
  q: string
  type: JobType | ""
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit } = useForm<JobSearchValues>({
    defaultValues: { q: "", type: "" },
  })

  useEffect(() => {
    jobService
      .search()
      .then(setJobs)
      .catch((searchError) => setError(getApiErrorMessage(searchError)))
      .finally(() => setLoading(false))
  }, [])

  function onSearch(values: JobSearchValues) {
    setLoading(true)
    setError(null)
    jobService
      .search({
        ...(values.q.trim() ? { q: values.q.trim() } : {}),
        ...(values.type ? { type: values.type } : {}),
      })
      .then(setJobs)
      .catch((searchError) => setError(getApiErrorMessage(searchError)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
      </div>

      <form
        onSubmit={handleSubmit(onSearch)}
        className="flex flex-wrap gap-2"
        noValidate
      >
        <Input
          className="min-w-48 flex-1"
          placeholder="Search jobs…"
          {...register("q")}
        />
        <select
          className={selectClassName}
          aria-label="Job type"
          {...register("type")}
        >
          <option value="">All types</option>
          <option value="government">Government</option>
          <option value="private">Private</option>
          <option value="individual">Individual</option>
          <option value="ngo">NGO</option>
          <option value="other">Other</option>
        </select>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <LoadingFallback label="Loading jobs…" />
      ) : jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs found.</p>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <Link key={job.id} to={APP_ROUTES.jobs.detail(job.public_job_id)}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{job.title}</CardTitle>
                    <Badge variant="secondary" className="capitalize">
                      {job.job_type.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <CardDescription>
                    {[job.city, job.state].filter(Boolean).join(", ") || "—"}
                    {job.application_deadline &&
                      ` · Apply by ${formatDate(job.application_deadline)}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {job.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
