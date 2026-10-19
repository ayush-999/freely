import { Link } from "react-router-dom"

import { APP_ROUTES } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-4xl font-semibold">404</p>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Button asChild variant="outline">
        <Link to={APP_ROUTES.home}>Back to home</Link>
      </Button>
    </div>
  )
}
