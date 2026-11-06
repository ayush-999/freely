import { Link } from "react-router-dom"
import { Loader2, MessageCircle, UserCheck, UserPlus } from "lucide-react"
import { APP_ROUTES } from "@workspace/constants"
import { Button } from "@workspace/ui/components/button"
import { useAuth } from "@/hooks/use-auth"
import { useRelationship } from "@/hooks/use-relationship"

/** Follow and message controls share the existing identity and messaging flows. */
export function UserActions({
  handle,
  message = true,
}: {
  handle: string
  message?: boolean
}) {
  const { user, isAuthenticated } = useAuth()
  if (user?.user_handle.toLowerCase() === handle.toLowerCase()) return null
  return (
    <Actions
      key={`${user?.user_handle ?? "guest"}:${handle}`}
      handle={handle}
      message={message}
      authenticated={isAuthenticated}
    />
  )
}

function Actions({
  handle,
  message,
  authenticated,
}: {
  handle: string
  message: boolean
  authenticated: boolean
}) {
  const network = useRelationship(handle)
  const following = network.summary?.is_following ?? false
  const profile = APP_ROUTES.user(handle)
  const target = APP_ROUTES.messageUser(handle)
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {authenticated ? (
          <Button
            type="button"
            size="sm"
            variant={following ? "outline" : "default"}
            disabled={network.loading || network.busy || !network.summary}
            aria-label={`${following ? "Unfollow" : "Follow"} @${handle}`}
            title={following ? `Unfollow @${handle}` : `Follow @${handle}`}
            aria-pressed={following}
            onClick={() => {
              void network.toggle()
            }}
          >
            {network.busy || network.loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : following ? (
              <UserCheck className="size-3.5" />
            ) : (
              <UserPlus className="size-3.5" />
            )}
            {following ? "Following" : "Follow"}
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link
              to={APP_ROUTES.login}
              state={{ from: profile }}
              aria-label={`Follow @${handle}`}
            >
              <UserPlus className="size-3.5" />
              Follow
            </Link>
          </Button>
        )}
        {message && (
          <Button asChild variant="outline" size="sm">
            <Link
              to={authenticated ? target : APP_ROUTES.login}
              state={authenticated ? undefined : { from: target }}
              aria-label={`Message @${handle}`}
            >
              <MessageCircle className="size-3.5" />
              Message
            </Link>
          </Button>
        )}
      </div>
      {network.error && authenticated && (
        <div role="alert" className="max-w-64 text-xs text-destructive">
          {network.error}{" "}
          <button type="button" className="underline" onClick={network.retry}>
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
