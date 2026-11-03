import { Link, useSearchParams } from "react-router-dom"
import { Hourglass } from "lucide-react"

import { APP_ROUTES } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"

export function ComingSoonPage() {
  const [searchParams] = useSearchParams()
  const feature = searchParams.get("feature")?.trim().slice(0, 60)

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Hourglass aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold">Coming Soon</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {feature ? `${feature} is` : "This feature is"} not available yet. We
        are working on it.
      </p>
      <Button asChild variant="outline">
        <Link to={APP_ROUTES.home}>Back to Home</Link>
      </Button>
    </div>
  )
}
