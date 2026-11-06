import { StrictMode, useEffect } from "react"
import { render, renderHook, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, MemoryRouter, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatSessionProvider } from "@/components/chat/chat-session-provider"
import { useChat } from "@/hooks/use-chat"

interface FakeController {
  account: string
  active: boolean
  overlappingStarts: number
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  clearSelection: ReturnType<typeof vi.fn>
}

const mocked = vi.hoisted(() => ({
  account: "alice" as string | undefined,
  authenticated: true,
  controllers: [] as FakeController[],
  consumers: [] as FakeController[],
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    isAuthenticated: mocked.authenticated,
    user: mocked.account ? { user_handle: mocked.account } : null,
  }),
}))

vi.mock("@/services/chat-controller", () => ({
  ChatController: class {
    active = false
    overlappingStarts = 0
    snapshot = { phase: "ready" }
    getSnapshot = () => this.snapshot
    subscribe = () => () => undefined
    start = vi.fn(async () => {
      if (this.active) this.overlappingStarts++
      this.active = true
    })
    stop = vi.fn(() => {
      this.active = false
    })
    clearSelection = vi.fn()
    constructor(public account: string) {
      mocked.controllers.push(this)
    }
  },
}))

function Consumer({ label = "Chat" }: { label?: string }) {
  const { state, controller } = useChat(mocked.account!)
  useEffect(() => {
    mocked.consumers.push(controller as unknown as FakeController)
  }, [controller])
  return (
    <p>
      {label}: {state.phase}
    </p>
  )
}

function Application() {
  const { pathname } = useLocation()
  return (
    <>
      <Link to="/home">Home</Link>
      <Link to="/messages">Messages</Link>
      {pathname === "/messages" ? <Consumer /> : <p>Feed</p>}
    </>
  )
}

function tree(path = "/home", consumers = false) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <ChatSessionProvider>
        {consumers ? (
          <>
            <Consumer label="First" />
            <Consumer label="Second" />
          </>
        ) : (
          <Application />
        )}
      </ChatSessionProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mocked.account = "alice"
  mocked.authenticated = true
  mocked.controllers = []
  mocked.consumers = []
})

describe("authenticated messaging session", () => {
  it("starts messaging outside the inbox so signed-in users register a receiving device", () => {
    render(tree())
    expect(screen.getByText("Feed")).toBeInTheDocument()
    expect(mocked.controllers).toHaveLength(1)
    expect(mocked.controllers[0]!.start).toHaveBeenCalledOnce()
    expect(mocked.controllers[0]!.active).toBe(true)
  })

  it("shares one controller between inbox consumers without starting another session", () => {
    render(tree("/messages", true))
    expect(mocked.controllers).toHaveLength(1)
    expect(mocked.consumers).toHaveLength(2)
    expect(
      mocked.consumers.every(
        (controller) => controller === mocked.controllers[0]
      )
    ).toBe(true)
    expect(mocked.controllers[0]!.start).toHaveBeenCalledOnce()
  })

  it("clears the selected plaintext thread on navigation while keeping background delivery running", async () => {
    render(tree("/messages"))
    const controller = mocked.controllers[0]!
    expect(controller.clearSelection).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("link", { name: "Home" }))
    expect(screen.getByText("Feed")).toBeInTheDocument()
    expect(controller.clearSelection).toHaveBeenCalledOnce()
    expect(controller.stop).not.toHaveBeenCalled()
    expect(controller.active).toBe(true)
    await userEvent.click(screen.getByRole("link", { name: "Messages" }))
    expect(screen.getByText("Chat: ready")).toBeInTheDocument()
    expect(mocked.controllers).toHaveLength(1)
    expect(controller.start).toHaveBeenCalledOnce()
  })

  it("stops the old account session before starting a switched account and clears it on logout", () => {
    const view = render(tree())
    const alice = mocked.controllers[0]!
    mocked.account = "bob"
    view.rerender(tree())
    const bob = mocked.controllers[1]!
    expect(alice.stop).toHaveBeenCalledOnce()
    expect(alice.active).toBe(false)
    expect(bob.account).toBe("bob")
    expect(bob.active).toBe(true)
    mocked.authenticated = false
    mocked.account = undefined
    view.rerender(tree())
    expect(bob.stop).toHaveBeenCalledOnce()
    expect(mocked.controllers.every((controller) => !controller.active)).toBe(
      true
    )
  })

  it("does not start a messaging session for unauthenticated visitors", () => {
    mocked.authenticated = false
    mocked.account = undefined
    render(tree())
    expect(mocked.controllers).toHaveLength(0)
  })

  it("survives StrictMode cleanup with one active shared connection", () => {
    const view = render(<StrictMode>{tree("/messages", true)}</StrictMode>)
    const started = mocked.controllers.filter(
      (controller) => controller.start.mock.calls.length
    )
    expect(started).toHaveLength(1)
    expect(
      mocked.controllers.filter((controller) => controller.active)
    ).toEqual(started)
    expect(started[0]!.overlappingStarts).toBe(0)
    expect(
      mocked.consumers.every((controller) => controller === started[0])
    ).toBe(true)
    view.unmount()
    expect(mocked.controllers.every((controller) => !controller.active)).toBe(
      true
    )
  })

  it("retains page-scoped lifecycle for isolated useChat consumers", () => {
    const hook = renderHook(() => useChat("alice"))
    expect(mocked.controllers).toHaveLength(1)
    expect(mocked.controllers[0]!.start).toHaveBeenCalledOnce()
    hook.unmount()
    expect(mocked.controllers[0]!.stop).toHaveBeenCalledOnce()
  })
})
