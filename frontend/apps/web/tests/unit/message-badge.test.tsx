import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { MessageCircle } from "lucide-react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useUnreadMessages } from "@/hooks/use-unread-messages"
import { NavItemLink } from "@/layouts/nav-link-item"

const mocked = vi.hoisted(() => ({
  config: vi.fn(),
  summary: vi.fn(),
  service: vi.fn(),
}))

vi.mock("@/services/chat.service", () => ({
  createChatService: mocked.service,
}))
vi.mock("@workspace/auth", () => ({
  tokenStorage: { get: () => "account-token" },
}))

const item = {
  to: "/messages",
  label: "Messaging",
  Icon: MessageCircle,
  iconClassName: "text-muted-foreground",
  activeIconClassName: "text-fuchsia-400",
}

beforeEach(() => {
  mocked.config.mockReset().mockResolvedValue({ enabled: true })
  mocked.summary.mockReset().mockResolvedValue({ unread_count: 0 })
  mocked.service.mockReset().mockReturnValue(mocked)
})

describe("messaging navigation badge", () => {
  it("keeps the existing messaging label and hides the badge at zero", () => {
    render(
      <MemoryRouter>
        <NavItemLink item={item} />
      </MemoryRouter>
    )
    expect(screen.getByRole("link", { name: "Messaging" })).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("shows unread messages above the icon with the full accessible count", () => {
    render(
      <MemoryRouter>
        <NavItemLink item={item} unreadCount={123} iconOnly />
      </MemoryRouter>
    )
    expect(
      screen.getByRole("link", { name: "Messaging, 123 unread messages" })
    ).toHaveAttribute("href", "/messages")
    expect(screen.getByText("99+")).toBeInTheDocument()
  })
})

describe("unread message metadata", () => {
  it("does not request metadata for logged out users", () => {
    const { result } = renderHook(() => useUnreadMessages(undefined))
    expect(result.current).toBe(0)
    expect(mocked.service).not.toHaveBeenCalled()
  })

  it("keeps the count hidden while messaging is disabled", async () => {
    mocked.config.mockResolvedValue({ enabled: false })
    const { result } = renderHook(() => useUnreadMessages("alice"))
    await waitFor(() => expect(mocked.config).toHaveBeenCalledOnce())
    expect(result.current).toBe(0)
    expect(mocked.summary).not.toHaveBeenCalled()
  })

  it("updates on messaging changes and clears after messages are read", async () => {
    mocked.summary.mockResolvedValueOnce({ unread_count: 3 })
    const { result } = renderHook(() => useUnreadMessages("alice"))
    await waitFor(() => expect(result.current).toBe(3))
    act(() => window.dispatchEvent(new Event("freely:chat-updated")))
    await waitFor(() => expect(result.current).toBe(0))
    expect(mocked.config).toHaveBeenCalledOnce()
  })

  it("never shows a previous account's count and ignores its late requests", async () => {
    let resolveAlice!: (value: { unread_count: number }) => void
    mocked.summary.mockImplementationOnce(
      () => new Promise((resolve) => (resolveAlice = resolve))
    )
    const { result, rerender } = renderHook(
      ({ account }) => useUnreadMessages(account),
      { initialProps: { account: "alice" } }
    )
    await waitFor(() => expect(mocked.summary).toHaveBeenCalledOnce())
    mocked.summary.mockResolvedValue({ unread_count: 2 })
    rerender({ account: "bob" })
    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(2))
    await act(async () => resolveAlice({ unread_count: 9 }))
    expect(result.current).toBe(2)
    const firstSignal = mocked.service.mock.calls[0]?.[1] as AbortSignal
    expect(firstSignal.aborted).toBe(true)
  })

  it("preserves the last count during temporary connection errors", async () => {
    mocked.summary.mockResolvedValueOnce({ unread_count: 4 })
    const { result } = renderHook(() => useUnreadMessages("alice"))
    await waitFor(() => expect(result.current).toBe(4))
    mocked.summary.mockRejectedValueOnce(new Error("Offline"))
    act(() => window.dispatchEvent(new Event("focus")))
    await waitFor(() => expect(mocked.summary).toHaveBeenCalledTimes(2))
    expect(result.current).toBe(4)
  })
})
