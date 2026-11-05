import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  LockKeyhole,
  MessageCircle,
  Monitor,
  Search,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { getApiErrorMessage } from "@workspace/utils"
import { DeviceVerification } from "@/components/chat/device-verification"
import { MessageComposer } from "@/components/chat/message-composer"
import { useAuth } from "@/hooks/use-auth"
import { useChat } from "@/hooks/use-chat"
import { identityService } from "@/services/identity.service"
import type { UserPublic } from "@/types/identity"
import { DEFAULT_AVATAR, getMediaUrl } from "@/utils/media"

function utcDate(value: string) {
  return new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}

function Messaging({ account }: { account: string }) {
  const { state, controller } = useChat(account)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserPublic[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [showList, setShowList] = useState(true)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      identityService
        .searchUsers(query.trim())
        .then((users) => {
          if (!cancelled) {
            setResults(users.filter((user) => user.user_handle !== account))
            setSearchError(null)
          }
        })
        .catch((error: unknown) => {
          if (!cancelled)
            setSearchError(getApiErrorMessage(error, "Search is unavailable."))
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, account])
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [state.messages.length])
  const unread = state.messages.filter(
    (message) => message.sender_handle !== account && message.status !== "read"
  ).length
  useEffect(() => {
    if (!unread) return
    const markRead = () => {
      void controller.markVisibleRead()
    }
    markRead()
    window.addEventListener("focus", markRead)
    document.addEventListener("visibilitychange", markRead)
    return () => {
      window.removeEventListener("focus", markRead)
      document.removeEventListener("visibilitychange", markRead)
    }
  }, [controller, unread])

  if (state.phase === "loading")
    return (
      <p className="p-8 text-center text-muted-foreground" role="status">
        Opening secure messaging…
      </p>
    )
  if (state.phase === "disabled")
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border p-8 text-center">
        <MessageCircle className="mx-auto size-9 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Messaging</h1>
        <p className="text-muted-foreground">
          Messaging is not available yet. You can continue using the other
          features of Freely.
        </p>
      </div>
    )
  if (state.phase === "error")
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border p-8">
        <h1 className="text-xl font-semibold">Messaging is unavailable</h1>
        <p role="alert" className="text-sm text-muted-foreground">
          {state.error}
        </p>
        <Button
          onClick={() => {
            controller.stop()
            void controller.start()
          }}
        >
          Try again
        </Button>
      </div>
    )
  const selected = state.selected
  const canSend =
    state.trusts.length > 0 && state.trusts.every((trust) => trust.verified)
  return (
    <section
      aria-label="Messaging"
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <LockKeyhole className="size-5 text-emerald-600" />
          Messaging
        </h1>
        <span role="status" className="text-xs text-muted-foreground">
          {state.connection === "online"
            ? "Connected"
            : state.connection === "reconnecting"
              ? "Reconnecting…"
              : state.connection === "connecting"
                ? "Connecting…"
                : "Offline · messages will retry"}
        </span>
      </div>
      {state.error && (
        <div
          role="alert"
          className="border-b bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}
      <div className="grid min-h-[65svh] md:grid-cols-[18rem_1fr]">
        <aside
          className={cn("border-r", !showList && selected && "hidden md:block")}
        >
          <div className="relative p-3">
            <Search className="pointer-events-none absolute top-6 left-6 size-4 text-muted-foreground" />
            <label className="sr-only" htmlFor="chat-search">
              Find people
            </label>
            <Input
              id="chat-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder="Find people…"
            />
          </div>
          {searchError && (
            <p role="alert" className="px-3 text-sm text-destructive">
              {searchError}
            </p>
          )}
          <div className="max-h-[55svh] overflow-y-auto">
            {query.trim().length >= 2
              ? results.map((user) => (
                  <button
                    key={user.user_handle}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted"
                    disabled={state.busy}
                    onClick={() => {
                      void controller
                        .createConversation(user.user_handle)
                        .then(() => {
                          setQuery("")
                          setShowList(false)
                        })
                    }}
                  >
                    <img
                      src={getMediaUrl(user.avatar_storage_key, DEFAULT_AVATAR)}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {user.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        @{user.user_handle}
                      </span>
                    </span>
                  </button>
                ))
              : state.conversations.map((conversation) => (
                  <button
                    key={conversation.public_conversation_id}
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left hover:bg-muted",
                      selected?.public_conversation_id ===
                        conversation.public_conversation_id && "bg-muted"
                    )}
                    onClick={() => {
                      void controller.select(conversation)
                      setShowList(false)
                    }}
                  >
                    <img
                      src={getMediaUrl(
                        conversation.peer.avatar_storage_key,
                        DEFAULT_AVATAR
                      )}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {conversation.peer.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        @{conversation.peer.user_handle}
                      </span>
                    </span>
                  </button>
                ))}
            {!query && !state.conversations.length && (
              <p className="p-4 text-sm text-muted-foreground">
                Find someone to start a private conversation.
              </p>
            )}
          </div>
        </aside>
        <div
          className={cn(
            "flex min-w-0 flex-col",
            showList && selected && "hidden md:flex"
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <MessageCircle className="size-10" />
              <p>Choose a conversation or find someone to message.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b p-3">
                <Button
                  aria-label="Back to conversations"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setShowList(true)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <img
                  src={getMediaUrl(
                    selected.peer.avatar_storage_key,
                    DEFAULT_AVATAR
                  )}
                  alt=""
                  className="size-9 rounded-full object-cover"
                />
                <div>
                  <h2 className="text-sm font-semibold">
                    {selected.peer.full_name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {state.typing
                      ? "Typing…"
                      : state.online
                        ? "Online"
                        : "Offline"}
                  </p>
                </div>
              </div>
              <DeviceVerification
                trusts={state.trusts}
                onVerify={(id, number) => controller.verify(id, number)}
              />
              <div
                className="h-[42svh] min-h-64 flex-1 space-y-3 overflow-y-auto p-4"
                role="log"
                aria-label="Message history"
                aria-live="polite"
              >
                {state.hasOlder && (
                  <div className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void controller.loadHistory()
                      }}
                    >
                      Load earlier messages
                    </Button>
                  </div>
                )}
                {!state.messages.length && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Messages appear here after device verification. Earlier
                    history is available on the devices where it was received.
                  </p>
                )}
                {state.messages.map((message) => {
                  const own = message.sender_handle === account
                  return (
                    <article
                      key={`${message.sender_device_id}:${message.client_message_id}`}
                      className={cn(
                        "flex",
                        own ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2",
                          own
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm bg-muted"
                        )}
                      >
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {message.text}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] opacity-75">
                          <time
                            dateTime={utcDate(message.created_at).toISOString()}
                            title={utcDate(message.created_at).toLocaleString()}
                          >
                            {utcDate(message.created_at).toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </time>
                          {own && (
                            <span
                              aria-label={message.status}
                              className="flex items-center gap-1"
                            >
                              {message.status === "pending" ? (
                                "Queued"
                              ) : message.status === "sent" ? (
                                <Check className="size-3" />
                              ) : (
                                <CheckCheck
                                  className={cn(
                                    "size-3",
                                    message.status === "read" && "text-sky-300"
                                  )}
                                />
                              )}
                              <span className="sr-only">{message.status}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
                <div ref={bottom} />
              </div>
              <MessageComposer
                key={selected.public_conversation_id}
                disabled={!canSend}
                busy={state.busy}
                onSend={(text) => controller.send(text)}
                onTyping={(active) => controller.typing(active)}
              />
            </>
          )}
        </div>
      </div>
      <details className="border-t p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Monitor className="size-4" />
          Your messaging devices
        </summary>
        <div className="mt-3 space-y-2">
          {state.devices.map((device) => (
            <div
              key={device.public_device_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"
            >
              <span>
                {device.label || "Browser"} ·{" "}
                {device.public_device_id.slice(-8)}
                {device.public_device_id === state.deviceId
                  ? " · This device"
                  : ""}
                {device.revoked_at ? " · Revoked" : ""}
              </span>
              {!device.revoked_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Revoke this messaging device? It will lose access to new messages."
                      )
                    )
                      void controller.revoke(device.public_device_id)
                  }}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

export function ChatPage() {
  const { user } = useAuth()
  return user ? (
    <Messaging key={user.user_handle} account={user.user_handle} />
  ) : null
}
