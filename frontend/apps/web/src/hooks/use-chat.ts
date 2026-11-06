import { useEffect, useMemo, useSyncExternalStore } from "react"
import { ChatController } from "@/services/chat-controller"
import { useChatSession } from "@/components/chat/chat-session-provider"

export function useChat(account: string) {
  const session = useChatSession()
  if (session !== undefined && session?.account !== account)
    throw new Error("Messaging requires the matching authenticated account")
  const sharedController = session?.controller
  const controller = useMemo(
    () => sharedController ?? new ChatController(account),
    [account, sharedController]
  )
  useEffect(() => {
    if (sharedController) return
    void controller.start()
    return () => controller.stop()
  }, [controller, sharedController])
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  )
  return { state, controller }
}
