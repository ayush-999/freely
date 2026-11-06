import { useEffect, useState } from "react"
import { tokenStorage } from "@workspace/auth"
import { createChatService } from "@/services/chat.service"

/** Fetch message metadata without opening another encrypted messaging session. */
export function useUnreadMessages(account: string | undefined) {
  const [result, setResult] = useState({ account, count: 0 })

  useEffect(() => {
    if (!account) return
    const abort = new AbortController()
    const service = createChatService(
      tokenStorage.get() ?? undefined,
      abort.signal
    )
    let cancelled = false
    let pending = false
    let refreshRequested = false
    let enabled = false

    async function refresh() {
      if (cancelled) return
      if (pending) {
        refreshRequested = true
        return
      }
      pending = true
      try {
        if (!enabled) enabled = (await service.config()).enabled
        if (cancelled) return
        const summary = enabled ? await service.summary() : null
        if (!cancelled)
          setResult({ account, count: summary?.unread_count ?? 0 })
      } catch {
        // A temporary connection failure keeps the last known message count.
      } finally {
        pending = false
        if (refreshRequested && !cancelled) {
          refreshRequested = false
          void refresh()
        }
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") void refresh()
    }

    void refresh()
    const interval = setInterval(onVisible, 5000)
    window.addEventListener("focus", onVisible)
    window.addEventListener("freely:chat-updated", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      abort.abort()
      clearInterval(interval)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("freely:chat-updated", onVisible)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [account])

  return result.account === account ? result.count : 0
}
