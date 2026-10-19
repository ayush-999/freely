import { useEffect, useState } from "react"
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
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { grievanceService } from "@/services/grievance.service"
import type { Grievance } from "@/types"

export function MyGrievancesPage() {
  const [grievances, setGrievances] = useState<Grievance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    grievanceService
      .listMine()
      .then(setGrievances)
      .catch((listError) => setError(getApiErrorMessage(listError)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My grievances</h1>
        <Button asChild>
          <Link to={APP_ROUTES.grievances.new}>New grievance</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <LoadingFallback label="Loading grievances…" />
      ) : grievances.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have not submitted any grievance yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {grievances.map((grievance) => (
            <Link
              key={grievance.id}
              to={APP_ROUTES.grievances.detail(grievance.id)}
            >
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader className="gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {grievance.title}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">
                        {grievance.priority}
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {grievance.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    {grievance.tracking_number} · Submitted{" "}
                    {formatDateTime(grievance.submitted_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {grievance.description}
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
