import { useEffect, useMemo, useSyncExternalStore } from "react"
import { ChatController } from "@/services/chat-controller"

export function useChat(account: string) {
  const controller = useMemo(() => new ChatController(account), [account])
  useEffect(() => {
    void controller.start()
    return () => controller.stop()
  }, [controller])
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot
  )
  return { state, controller }
}
