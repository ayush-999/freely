import { useEffect, useState } from "react"

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

  useEffect(() => {
    notificationService
      .listMine()
      .then(setNotifications)
      .catch((listError) => setError(getApiErrorMessage(listError)))
      .finally(() => setLoading(false))
  }, [])

  async function handleMarkRead(notificationId: number) {
    const updated = await notificationService.markRead(notificationId)
    setNotifications((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Notifications</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <LoadingFallback label="Loading notifications…" />
      ) : notifications.length === 0 ? (
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
                        onClick={() => void handleMarkRead(notification.id)}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {formatDateTime(notification.created_at)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {notification.message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
