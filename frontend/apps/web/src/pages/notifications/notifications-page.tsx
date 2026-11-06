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
import { cn } from "@workspace/ui/lib/utils"
import { formatDateTime, getApiErrorMessage } from "@workspace/utils"

import { LoadingFallback } from "@/components/loading-fallback"
import { notificationService } from "@/services/notification.service"
import type { Notification } from "@/types"

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [reading, setReading] = useState<Set<number>>(new Set())
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    notificationService
      .listMine()
      .then((items) => {
        if (!cancelled) setNotifications(items)
      })
      .catch((listError) => {
        if (!cancelled) setError(getApiErrorMessage(listError))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  async function handleMarkRead(notificationId: number) {
    if (reading.has(notificationId)) return
    setReading((current) => new Set(current).add(notificationId))
    setReadError(null)
    try {
      const updated = await notificationService.markRead(notificationId)
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
    } catch (readFailure) {
      setReadError(
        getApiErrorMessage(readFailure, "Could not mark notification as read")
      )
    } finally {
      setReading((current) => {
        const next = new Set(current)
        next.delete(notificationId)
        return next
      })
    }
  }

  function retryList() {
    setError(null)
    setReadError(null)
    setLoading(true)
    setAttempt((current) => current + 1)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Notifications</h1>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={retryList}>
            Try again
          </Button>
        </div>
      )}
      {readError && (
        <p role="alert" className="text-sm text-destructive">
          {readError}
        </p>
      )}
      {loading ? (
        <LoadingFallback label="Loading notifications…" />
      ) : !error && notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no notifications.
        </p>
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={cn(!notification.read_at && "border-primary/40")}
            >
              <CardHeader className="gap-1">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {notification.subject ?? "Notification"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {notification.channel}
                    </Badge>
                    {!notification.read_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={reading.has(notification.id)}
                        onClick={() => void handleMarkRead(notification.id)}
                      >
                        {reading.has(notification.id)
                          ? "Marking read…"
                          : "Mark read"}
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {formatDateTime(notification.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-wrap">
                  {notification.message}
                </p>
                {notification.grievance_id !== null && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={APP_ROUTES.grievances.detail(
                        notification.grievance_id
                      )}
                    >
                      View grievance
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
