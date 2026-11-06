import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { BriefcaseBusiness, Loader2, Search } from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Badge } from "@workspace/ui/components/badge"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { getApiErrorMessage } from "@workspace/utils"

import { grievanceService } from "@/services/grievance.service"
import { identityService } from "@/services/identity.service"
import { jobService } from "@/services/job.service"
import type { GrievanceTrackingView, Job, UserPublic } from "@/types"
import { PersonRow } from "@/components/people/person-row"

import { GrievanceRow } from "./grievance-result"

const TABS = [
  { value: "all", label: "All" },
  { value: "people", label: "People" },
  { value: "jobs", label: "Jobs" },
  { value: "grievances", label: "Grievances" },
] as const

type Tab = (typeof TABS)[number]["value"]

function parseTab(value: string | null): Tab {
  return TABS.find((tab) => tab.value === value)?.value ?? "all"
}

type SearchResults = {
  query: string
  people: UserPublic[]
  jobs: Job[]
  error: string | null
}

type TrackingResult = {
  query: string
  grievance: GrievanceTrackingView | null
  error: string | null
}

function JobRow({ job }: { job: Job }) {
  const place = [job.city, job.state].filter(Boolean).join(", ")

  return (
    <Link
      to={APP_ROUTES.jobs.detail(job.public_job_id)}
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-amber-500">
        <BriefcaseBusiness aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{job.title}</p>
        {place && (
          <p className="truncate text-xs text-muted-foreground">{place}</p>
        )}
      </div>
      <Badge variant="secondary" className="shrink-0 capitalize">
        {job.job_type.replaceAll("_", " ")}
      </Badge>
    </Link>
  )
}

function ResultSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-1">
      {title && (
        <h3 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
      )}
      {children}
    </section>
  )
}

export function SearchPage() {
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get("tab"))
  const [results, setResults] = useState<SearchResults | null>(null)
  const [tracking, setTracking] = useState<TrackingResult | null>(null)
  const trackingMode = tab === "grievances"

  function selectTab(next: Tab) {
    setSearchParams(next === "all" ? {} : { tab: next }, { replace: true })
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!debounced || trackingMode) return
    let cancelled = false

    Promise.all([
      identityService.searchUsers(debounced),
      jobService.search({ q: debounced, limit: 10 }),
    ])
      .then(([people, jobs]) => {
        if (!cancelled)
          setResults({ query: debounced, people, jobs, error: null })
      })
      .catch((searchError) => {
        if (!cancelled)
          setResults({
            query: debounced,
            people: [],
            jobs: [],
            error: getApiErrorMessage(searchError, "Search failed"),
          })
      })

    return () => {
      cancelled = true
    }
  }, [debounced, trackingMode])

  useEffect(() => {
    if (!debounced || !trackingMode) return
    let cancelled = false

    grievanceService
      .track(debounced)
      .then((grievance) => {
        if (!cancelled)
          setTracking({ query: debounced, grievance, error: null })
      })
      .catch((trackError) => {
        if (!cancelled)
          setTracking({
            query: debounced,
            grievance: null,
            error: getApiErrorMessage(trackError, "Grievance not found"),
          })
      })

    return () => {
      cancelled = true
    }
  }, [debounced, trackingMode])

  const loading =
    debounced !== "" &&
    (trackingMode
      ? tracking?.query !== debounced
      : results?.query !== debounced)
  const current = debounced !== "" && !loading && !trackingMode ? results : null
  const currentTracking =
    debounced !== "" && !loading && trackingMode ? tracking : null
  const showPeople = tab === "all" || tab === "people"
  const showJobs = tab === "all" || tab === "jobs"
  const people = current && showPeople ? current.people : []
  const jobs = current && showJobs ? current.jobs : []

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex min-w-0 flex-col gap-4">
        <header className="space-y-2 pt-1">
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">
            FREELY SEARCH
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Search
          </h1>
        </header>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              trackingMode
                ? "Enter a tracking number, e.g. GRV-2026-XXXXXX"
                : "Search people and jobs"
            }
            aria-label="Search"
            autoFocus
            className="h-11 pl-9"
          />
          {loading && (
            <Loader2
              aria-hidden="true"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}
        </div>

        <div
          role="tablist"
          aria-label="Search categories"
          className="flex gap-1 border-b border-border"
        >
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => selectTab(value)}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none",
                tab === value
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Card className="min-h-64 gap-4 border-border/70 p-3 hover:shadow-sm">
          {debounced === "" ? (
            <p className="p-2 text-sm text-muted-foreground">
              {trackingMode
                ? "Enter the tracking number you received when submitting a grievance."
                : `Type a name or @handle to find people${showJobs ? ", or a title to find jobs" : ""}.`}
            </p>
          ) : trackingMode ? (
            currentTracking?.grievance ? (
              <GrievanceRow grievance={currentTracking.grievance} />
            ) : currentTracking ? (
              <p className="p-2 text-sm text-destructive">
                {currentTracking.error}
              </p>
            ) : null
          ) : current?.error ? (
            <p className="p-2 text-sm text-destructive">{current.error}</p>
          ) : current && people.length === 0 && jobs.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">
              No results for “{debounced}”.
            </p>
          ) : (
            <>
              {people.length > 0 && (
                <ResultSection title={tab === "all" ? "People" : undefined}>
                  {people.map((person) => (
                    <PersonRow key={person.user_handle} person={person} />
                  ))}
                </ResultSection>
              )}
              {jobs.length > 0 && (
                <ResultSection title={tab === "all" ? "Jobs" : undefined}>
                  {jobs.map((job) => (
                    <JobRow key={job.id} job={job} />
                  ))}
                </ResultSection>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
