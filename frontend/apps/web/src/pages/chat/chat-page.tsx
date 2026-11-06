import { Fragment, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { APP_ROUTES } from "@workspace/constants"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  ChevronRight,
  Inbox,
  Loader2,
  LockKeyhole,
  MessageCircle,
  MessageSquarePlus,
  Monitor,
  Search,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { getApiErrorMessage } from "@workspace/utils"
import { MessageComposer } from "@/components/chat/message-composer"
import { useAuth } from "@/hooks/use-auth"
import { useChat } from "@/hooks/use-chat"
import { identityService } from "@/services/identity.service"
import type { ChatConversation } from "@/types/chat"
import type { UserPublic } from "@/types/identity"
import { DEFAULT_AVATAR, getMediaUrl } from "@/utils/media"

function utcDate(value: string) {
  return new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}

function dateLabel(value: string) {
  const date = utcDate(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return "Today"
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function Avatar({
  user,
  className,
}: {
  user: ChatConversation["peer"]
  className?: string
}) {
  return (
    <img
      src={getMediaUrl(user.avatar_storage_key, DEFAULT_AVATAR)}
      alt=""
      className={cn(
        "size-11 shrink-0 rounded-full border border-border/60 object-cover",
        className
      )}
    />
  )
}

function Messaging({ account }: { account: string }) {
  const { state, controller } = useChat(account)
  const [params, setParams] = useSearchParams()
  const requested = params.get("to")?.trim() ?? ""
  const recipient =
    /^[A-Za-z0-9_]{3,50}$/.test(requested) &&
    requested.toLowerCase() !== account.toLowerCase()
      ? requested
      : null
  const opened = useRef<string | null>(null)
  const openRequest = useRef(0)
  const [openRevision, setOpenRevision] = useState(0)
  const [failedRecipient, setFailedRecipient] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserPublic[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [showList, setShowList] = useState(!recipient)
  const search = useRef<HTMLInputElement>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const history = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const ready = state.phase === "ready"

  useEffect(() => {
    if (!recipient || state.phase !== "ready") {
      opened.current = null
      openRequest.current++
      return
    }
    if (opened.current === recipient) return
    opened.current = recipient
    const request = ++openRequest.current
    setFailedRecipient(null)
    const existing = state.conversations.find(
      (item) => item.peer.user_handle.toLowerCase() === recipient.toLowerCase()
    )
    const opening = existing
      ? controller.select(existing)
      : controller.createConversation(recipient)
    void opening.then((success) => {
      if (openRequest.current === request)
        setFailedRecipient(success ? null : recipient)
    })
    nearBottom.current = true
    setShowList(false)
  }, [recipient, state.phase, state.conversations, controller, openRevision])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (query.trim().length < 2) return
      identityService
        .searchUsers(query.trim())
        .then((users) => {
          if (!cancelled)
            setResults(
              users.filter(
                (user) =>
                  user.user_handle.toLowerCase() !== account.toLowerCase()
              )
            )
        })
        .catch((error: unknown) => {
          if (!cancelled)
            setSearchError(
              getApiErrorMessage(
                error,
                "Search is unavailable. Please try again."
              )
            )
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, account])

  useEffect(() => {
    if (nearBottom.current)
      bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [state.messages.length, state.selected?.public_conversation_id])

  const unreadInThread = state.messages.filter(
    (message) => message.sender_handle !== account && message.status !== "read"
  ).length
  useEffect(() => {
    if (
      !unreadInThread ||
      (showList && window.matchMedia?.("(max-width: 767px)").matches)
    )
      return
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
  }, [controller, unreadInThread, showList])

  function changeQuery(value: string) {
    setQuery(value)
    setResults([])
    setSearchError(null)
    setSearching(value.trim().length >= 2)
  }

  function openConversation(handle: string) {
    changeQuery("")
    setFilter("all")
    setShowList(false)
    const next = new URLSearchParams(params)
    next.set("to", handle)
    setParams(next, { replace: true })
    if (recipient?.toLowerCase() === handle.toLowerCase()) {
      opened.current = null
      setOpenRevision((value) => value + 1)
    }
  }

  const selected = state.selected
  const peer =
    selected?.peer ??
    (recipient
      ? {
          user_handle: recipient,
          full_name: `@${recipient}`,
          avatar_storage_key: null,
        }
      : null)
  const totalUnread =
    state.summary?.unread_count ??
    state.conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0)
  const totalReceived =
    state.summary?.received_count ??
    state.conversations.reduce(
      (sum, item) => sum + (item.received_count ?? 0),
      0
    )
  const conversationReceived =
    selected?.received_count ??
    state.messages.filter((message) => message.sender_handle !== account).length
  const normalizedQuery = query.trim().toLowerCase()
  const conversations = state.conversations.filter(
    (item) =>
      (filter === "all" || (item.unread_count ?? 0) > 0) &&
      (!normalizedQuery ||
        `${item.peer.full_name} ${item.peer.user_handle}`
          .toLowerCase()
          .includes(normalizedQuery))
  )
  const people = results.filter(
    (user) =>
      !conversations.some((item) => item.peer.user_handle === user.user_handle)
  )
  const hasRecipientDevice = state.trusts.some(
    (trust) => trust.user_handle.toLowerCase() !== account.toLowerCase()
  )
  const queuedCount = state.messages.filter(
    (message) =>
      message.sender_handle === account && message.status === "pending"
  ).length
  const deliveryReason =
    state.pendingDelivery ??
    (!hasRecipientDevice ? "recipient-setup" : "connection")
  const sending =
    state.connection === "online" && hasRecipientDevice && !state.error
  const deliveryNotice =
    queuedCount > 0
      ? deliveryReason === "recipient-setup"
        ? "Saved on this device. Waiting for the recipient to set up messaging before delivery."
        : sending
          ? "Sending your messages securely…"
          : "Saved on this device. Your queued messages will send when the connection is ready."
      : null
  const connectionLabel =
    state.phase === "loading"
      ? "Opening secure messaging…"
      : !ready
        ? "Unavailable"
        : state.connection === "online"
          ? "Connected"
          : state.connection === "reconnecting"
            ? "Reconnecting…"
            : state.connection === "connecting"
              ? "Connecting…"
              : "Offline · messages will retry"
  const displayError =
    state.phase === "disabled"
      ? "Messaging is temporarily unavailable. Please try again shortly."
      : state.error

  return (
    <section
      aria-label="Messaging"
      className="flex h-[calc(100svh-15rem)] max-h-[56rem] min-h-[34rem] overflow-hidden rounded-2xl border bg-card shadow-sm max-md:h-[calc(100svh-11rem)]"
    >
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r md:w-80 lg:w-[22rem]",
          !showList && peer && "hidden md:flex"
        )}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Messaging
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Your conversations, in one place.
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="New message"
              className="rounded-full text-fuchsia-600 dark:text-fuchsia-400"
              onClick={() => {
                setFilter("all")
                search.current?.focus()
              }}
            >
              <MessageSquarePlus className="size-5" />
            </Button>
          </div>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <label className="sr-only" htmlFor="chat-search">
              Find people
            </label>
            <Input
              ref={search}
              id="chat-search"
              value={query}
              onChange={(event) => changeQuery(event.target.value)}
              className="h-10 rounded-xl border-transparent bg-muted/60 pl-9 text-sm shadow-none"
              placeholder="Search chats or find people…"
            />
          </div>
          <div
            className="mt-4 flex items-center gap-2"
            aria-label="Conversation filters"
          >
            <button
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              All chats
            </button>
            <button
              aria-pressed={filter === "unread"}
              onClick={() => setFilter("unread")}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                filter === "unread"
                  ? "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Unread{" "}
              {totalUnread > 0 && (
                <span className="font-semibold">{totalUnread}</span>
              )}
            </button>
          </div>
        </div>
        {displayError && (
          <div
            role="alert"
            className="mx-4 mb-3 rounded-xl bg-amber-500/10 px-3 py-3 text-xs leading-relaxed text-amber-800 md:hidden dark:text-amber-200"
          >
            {displayError}
            {!ready && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2 block"
                onClick={() => {
                  controller.stop()
                  void controller.start()
                }}
              >
                Try again
              </Button>
            )}
          </div>
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
          aria-label="Conversations"
        >
          {conversations.map((conversation) => {
            const active =
              selected?.public_conversation_id ===
              conversation.public_conversation_id
            const last = active ? state.messages.at(-1) : null
            return (
              <button
                key={conversation.public_conversation_id}
                aria-current={active ? "true" : undefined}
                onClick={() => openConversation(conversation.peer.user_handle)}
                className={cn(
                  "mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-muted/70",
                  active && "bg-fuchsia-500/[0.08] hover:bg-fuchsia-500/10"
                )}
              >
                <Avatar user={conversation.peer} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {conversation.peer.full_name}
                    </span>
                    {conversation.updated_at && (
                      <time
                        className="shrink-0 text-[10px] text-muted-foreground"
                        dateTime={conversation.updated_at}
                      >
                        {utcDate(conversation.updated_at).toLocaleDateString(
                          [],
                          { month: "short", day: "numeric" }
                        )}
                      </time>
                    )}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {last
                        ? `${last.sender_handle === account ? "You: " : ""}${last.text}`
                        : conversation.updated_at
                          ? "Encrypted conversation"
                          : `@${conversation.peer.user_handle}`}
                    </span>
                    {(conversation.unread_count ?? 0) > 0 && (
                      <span
                        aria-label={`${conversation.unread_count} unread messages from ${conversation.peer.full_name}`}
                        className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-600 px-1.5 text-[10px] font-semibold text-white"
                      >
                        {(conversation.unread_count ?? 0) > 99
                          ? "99+"
                          : conversation.unread_count}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
          {normalizedQuery.length >= 2 && (
            <>
              <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                People on Freely
              </p>
              {searching && (
                <p
                  role="status"
                  className="px-3 py-4 text-xs text-muted-foreground"
                >
                  Searching people…
                </p>
              )}
              {searchError && (
                <p role="alert" className="px-3 py-2 text-xs text-destructive">
                  {searchError}
                </p>
              )}
              {!searching && !searchError && !people.length && (
                <p className="px-3 py-4 text-xs text-muted-foreground">
                  No other people found. Try a name or username.
                </p>
              )}
              {people.map((user) => (
                <button
                  key={user.user_handle}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted/70"
                  disabled={state.busy}
                  onClick={() => openConversation(user.user_handle)}
                >
                  <Avatar user={user} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {user.full_name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{user.user_handle}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </>
          )}
          {!conversations.length && normalizedQuery.length < 2 && (
            <div className="px-6 py-12 text-center">
              <MessageCircle className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">
                {filter === "unread"
                  ? "You’re all caught up"
                  : "Start a conversation"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {filter === "unread"
                  ? "Your unread conversations will appear here."
                  : "Search for someone by name or username to send your first message."}
              </p>
            </div>
          )}
        </div>
        <div className="space-y-3 border-t px-5 py-4">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Inbox className="size-3.5" />
              Messages received
            </span>
            <span
              aria-label={`${totalReceived} total messages received`}
              className="font-semibold tabular-nums"
            >
              {totalReceived}
            </span>
          </div>
          <div
            role="status"
            className="flex items-center gap-2 text-[10px] text-muted-foreground"
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                ready && state.connection === "online"
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              )}
            />
            {connectionLabel}
          </div>
        </div>
      </aside>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col bg-background/50",
          showList && "hidden md:flex"
        )}
      >
        {displayError && (
          <div
            role="alert"
            className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-amber-500/5 px-5 py-3 text-xs text-amber-800 dark:text-amber-200"
          >
            <p className="min-w-0 flex-1 leading-relaxed">{displayError}</p>
            {recipient && failedRecipient === recipient ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  opened.current = null
                  setFailedRecipient(null)
                  setOpenRevision((value) => value + 1)
                }}
              >
                Retry opening conversation
              </Button>
            ) : (
              !ready && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    controller.stop()
                    void controller.start()
                  }}
                >
                  Try again
                </Button>
              )
            )}
          </div>
        )}
        {peer ? (
          <>
            <div className="flex min-h-20 shrink-0 items-center gap-3 border-b bg-card/70 px-4 py-3 md:px-5">
              <Button
                aria-label="Back to conversations"
                variant="ghost"
                size="icon"
                className="-ml-2 shrink-0 md:hidden"
                onClick={() => setShowList(true)}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Avatar user={peer} className="size-10" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold">
                  <Link
                    className="hover:underline"
                    to={APP_ROUTES.user(peer.user_handle)}
                  >
                    {peer.full_name}
                  </Link>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {state.typing ? (
                    <span className="text-fuchsia-600 dark:text-fuchsia-400">
                      Typing…
                    </span>
                  ) : state.online ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Online
                    </span>
                  ) : (
                    `@${peer.user_handle}`
                  )}
                </p>
              </div>
              <div className="shrink-0 rounded-xl bg-muted/60 px-3 py-2 text-right">
                <p
                  className="text-xs font-semibold tabular-nums"
                  aria-label={`${conversationReceived} messages received in this conversation`}
                >
                  {conversationReceived} received
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Messages
                </p>
              </div>
            </div>
            <div
              ref={history}
              onScroll={() => {
                const el = history.current
                if (el)
                  nearBottom.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 120
              }}
              className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(var(--border)_0.6px,transparent_0.6px)] bg-size-[22px_22px] px-4 py-5 md:px-7"
              role="log"
              aria-label="Message history"
              aria-live="polite"
            >
              {state.hasOlder && (
                <div className="mb-5 text-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      nearBottom.current = false
                      void controller.loadHistory()
                    }}
                  >
                    Load earlier messages
                  </Button>
                </div>
              )}
              <div className="mx-auto mb-6 flex w-fit max-w-sm items-center justify-center gap-2 rounded-lg border bg-card/90 px-3 py-2 text-center text-[10px] leading-relaxed text-muted-foreground">
                <LockKeyhole className="size-3 shrink-0" />
                Messages in this conversation are end-to-end encrypted.
              </div>
              {!state.messages.length && (
                <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
                  {state.phase === "loading" ? (
                    <Loader2 className="mb-4 size-7 animate-spin text-fuchsia-400" />
                  ) : (
                    <MessageCircle className="mb-4 size-9 text-fuchsia-500/60" />
                  )}
                  <p className="text-sm font-medium">
                    {state.phase === "loading"
                      ? "Opening your conversation…"
                      : `Say hello to ${peer.full_name}`}
                  </p>
                  <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    {!ready
                      ? "Your conversation is ready here. Sending will be available when messaging connects."
                      : !hasRecipientDevice
                        ? "Write your first message below. We’ll save it securely on this device until this person sets up messaging."
                        : "Send your first message to get the conversation started."}
                  </p>
                </div>
              )}
              {state.messages.map((message, index) => {
                const own = message.sender_handle === account
                const date = dateLabel(message.created_at)
                const showDate =
                  index === 0 ||
                  dateLabel(state.messages[index - 1]!.created_at) !== date
                return (
                  <Fragment
                    key={`${message.sender_device_id}:${message.client_message_id}`}
                  >
                    {showDate && (
                      <div className="my-5 text-center">
                        <span className="rounded-lg border bg-card/90 px-3 py-1.5 text-[10px] text-muted-foreground">
                          {date}
                        </span>
                      </div>
                    )}
                    <article
                      className={cn(
                        "mb-2 flex",
                        own ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl border px-3.5 py-2.5 shadow-xs md:max-w-[75%]",
                          own
                            ? "rounded-tr-sm border-fuchsia-500/15 bg-fuchsia-50 dark:bg-[#302038]"
                            : "rounded-tl-sm border-border/60 bg-card"
                        )}
                      >
                        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                          {message.text}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
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
                              title={
                                message.status === "pending"
                                  ? "Saved on this device. Not delivered yet."
                                  : undefined
                              }
                              className="flex items-center gap-1"
                            >
                              {message.status === "pending" ? (
                                sending ? (
                                  "Sending…"
                                ) : (
                                  "Queued"
                                )
                              ) : message.status === "sent" ? (
                                <Check className="size-3.5" />
                              ) : (
                                <CheckCheck
                                  className={cn(
                                    "size-3.5",
                                    message.status === "read" && "text-sky-500"
                                  )}
                                />
                              )}
                              <span className="sr-only">{message.status}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  </Fragment>
                )
              })}
              <div ref={bottom} />
            </div>
            {deliveryNotice && (
              <div
                role="status"
                aria-label="Queued message status"
                className="flex shrink-0 items-start gap-2 border-t bg-fuchsia-500/5 px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground md:px-5"
              >
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-fuchsia-500" />
                <p>{deliveryNotice}</p>
              </div>
            )}
            <MessageComposer
              key={selected?.public_conversation_id ?? peer.user_handle}
              disabled={!ready || !selected}
              busy={state.busy}
              onSend={(text) => {
                nearBottom.current = true
                return controller.send(text)
              }}
              onTyping={(active) => controller.typing(active)}
              disabledReason={
                !ready
                  ? "Messaging is connecting…"
                  : !selected
                    ? "Opening your conversation…"
                    : undefined
              }
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="relative mb-7 flex size-28 items-center justify-center rounded-full border border-fuchsia-500/10 bg-fuchsia-500/5">
              <div className="flex size-20 items-center justify-center rounded-3xl border border-fuchsia-500/20 bg-card shadow-sm">
                <MessageCircle
                  className="size-10 text-fuchsia-500"
                  strokeWidth={1.4}
                />
              </div>
              <span className="absolute right-1 bottom-2 flex size-8 items-center justify-center rounded-full border-4 border-background bg-emerald-500">
                <Check className="size-4 text-white" />
              </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              A little closer, a little more private.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Choose a chat or find someone on Freely.
              <br />
              Your next conversation starts here.
            </p>
            <Button
              variant="outline"
              className="mt-6 gap-2 rounded-full"
              onClick={() => {
                setShowList(true)
                search.current?.focus()
              }}
            >
              <MessageSquarePlus className="size-4 text-fuchsia-500" />
              Start a conversation
            </Button>
            <p className="mt-12 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              Private conversations. End-to-end encrypted.
            </p>
          </div>
        )}
        {ready && (
          <details className="shrink-0 border-t bg-card/60 px-4 py-2.5">
            <summary className="flex cursor-pointer items-center gap-2 text-[10px] text-muted-foreground">
              <Monitor className="size-3.5" />
              Your messaging devices
            </summary>
            <div className="mt-3 max-h-28 space-y-2 overflow-y-auto">
              {state.devices.map((device) => (
                <div
                  key={device.public_device_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs"
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
        )}
      </div>
    </section>
  )
}

export function ChatPage() {
  const { user } = useAuth()
  return user ? (
    <Messaging key={user.user_handle} account={user.user_handle} />
  ) : null
}
