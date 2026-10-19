import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { formatDate, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { organizationService } from "@/services/organization.service"
import type { Organization } from "@/types"

export function OrganizationProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      return
    }
    organizationService
      .getBySlug(slug)
      .then(setOrganization)
      .catch((orgError) => setError(getApiErrorMessage(orgError)))
      .finally(() => setLoading(false))
  }, [slug])

  if (!slug) {
    return <p className="text-sm text-destructive">Missing organization slug</p>
  }
  if (loading) {
    return <LoadingFallback label="Loading organization…" />
  }
  if (error || !organization) {
    return (
      <p className="text-sm text-destructive">
        {error ?? "Organization not found"}
      </p>
    )
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{organization.name}</CardTitle>
          <Badge variant="secondary" className="capitalize">
            {organization.organization_type.replaceAll("_", " ")}
          </Badge>
        </div>
        <CardDescription>
          {[organization.city, organization.state, organization.country]
            .filter(Boolean)
            .join(", ") || "—"}{" "}
          · Since {formatDate(organization.created_at)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {organization.description && <p>{organization.description}</p>}
        {organization.website_url && (
          <a
            href={organization.website_url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {organization.website_url}
          </a>
        )}
        {organization.contact_email && (
          <p className="text-muted-foreground">{organization.contact_email}</p>
        )}
      </CardContent>
    </Card>
  )
}
