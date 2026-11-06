import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { useLocation } from "react-router-dom"
import { APP_ROUTES } from "@workspace/constants"
import { useAuth } from "@/hooks/use-auth"
import { ChatController } from "@/services/chat-controller"

interface ChatSession {
  account: string
  controller: ChatController
}

// Undefined denotes an isolated consumer without the application provider;
// null denotes an application visitor without an authenticated chat session.
const ChatSessionContext = createContext<ChatSession | null | undefined>(
  undefined
)

/** One encrypted messaging connection for the authenticated application session. */
export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const account = isAuthenticated ? user?.user_handle : undefined
  const session = useMemo<ChatSession | null>(
    () =>
      account ? { account, controller: new ChatController(account) } : null,
    [account]
  )

  useEffect(() => {
    if (!session) return
    void session.controller.start()
    return () => session.controller.stop()
  }, [session])

  useEffect(() => {
    if (pathname !== APP_ROUTES.messaging) session?.controller.clearSelection()
  }, [pathname, session])

  return <ChatSessionContext value={session}>{children}</ChatSessionContext>
}

export function useChatSession() {
  return useContext(ChatSessionContext)
}
