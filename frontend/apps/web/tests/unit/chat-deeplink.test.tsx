import { StrictMode } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ChatPage } from "@/pages/chat/chat-page"
import type { ChatSnapshot } from "@/services/chat-controller"
import type { ChatConversation } from "@/types/chat"

const mocked = vi.hoisted(() => ({
  state: null as ChatSnapshot | null,
  controller: {
    createConversation: vi.fn(),
    select: vi.fn(),
    markVisibleRead: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    send: vi.fn(),
    typing: vi.fn(),
    revoke: vi.fn(),
    loadHistory: vi.fn(),
  },
}))
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { user_handle: "alice" } }),
}))
vi.mock("@/hooks/use-chat", () => ({
  useChat: () => ({ state: mocked.state, controller: mocked.controller }),
}))
vi.mock("@/services/identity.service", () => ({
  identityService: { searchUsers: vi.fn().mockResolvedValue([]) },
}))
vi.mock("@/components/chat/message-composer", () => ({
  MessageComposer: ({
    disabled,
    disabledReason,
  }: {
    disabled: boolean
    disabledReason?: string
  }) => (
    <textarea
      aria-label="Message"
      disabled={disabled}
      placeholder={disabledReason}
    />
  ),
}))

const conversation: ChatConversation = {
  public_conversation_id: "conversation-bob-001",
  peer: {
    user_handle: "bob",
    full_name: "Bob Example",
    avatar_storage_key: null,
  },
  created_at: "2026-11-05T00:00:00",
  updated_at: null,
}

function state(overrides: Partial<ChatSnapshot> = {}): ChatSnapshot {
  return {
    phase: "ready",
    connection: "online",
    conversations: [],
    selected: null,
    messages: [],
    devices: [],
    deviceId: "device-alice-001",
    trusts: [],
    busy: false,
    error: null,
    typing: false,
    online: false,
    hasOlder: false,
    ...overrides,
  }
}

function page(target: string, strict = false) {
  const tree = (
    <MemoryRouter
      initialEntries={[`/messages?to=${encodeURIComponent(target)}`]}
    >
      <ChatPage />
    </MemoryRouter>
  )
  return strict ? <StrictMode>{tree}</StrictMode> : tree
}

beforeEach(() => {
  mocked.state = state()
  for (const callback of Object.values(mocked.controller)) callback.mockReset()
  mocked.controller.createConversation.mockResolvedValue(true)
  mocked.controller.select.mockResolvedValue(true)
  mocked.controller.markVisibleRead.mockResolvedValue(undefined)
  Element.prototype.scrollIntoView = vi.fn()
})

describe("profile-to-messaging links", () => {
  it("waits for secure messaging to be ready before starting a profile conversation", async () => {
    mocked.state = state({ phase: "loading" })
    const view = render(page("bob"))
    expect(mocked.controller.createConversation).not.toHaveBeenCalled()
    mocked.state = state()
    view.rerender(page("bob"))
    await waitFor(() =>
      expect(
        mocked.controller.createConversation
      ).toHaveBeenCalledExactlyOnceWith("bob")
    )
  })

  it("opens an existing conversation without creating a duplicate", async () => {
    mocked.state = state({ conversations: [conversation] })
    render(page("BOB"))
    await waitFor(() =>
      expect(mocked.controller.select).toHaveBeenCalledExactlyOnceWith(
        conversation
      )
    )
    expect(mocked.controller.createConversation).not.toHaveBeenCalled()
  })

  it("does not recreate a recipient conversation on StrictMode or ordinary polling rerenders", async () => {
    const view = render(page("bob", true))
    await waitFor(() =>
      expect(mocked.controller.createConversation).toHaveBeenCalledTimes(1)
    )
    mocked.state = state({ connection: "reconnecting" })
    view.rerender(page("bob", true))
    mocked.state = state()
    view.rerender(page("bob", true))
    expect(
      mocked.controller.createConversation
    ).toHaveBeenCalledExactlyOnceWith("bob")
  })

  it("retries a failed profile conversation only after the user requests it", async () => {
    mocked.state = state({ error: "The network is unavailable." })
    mocked.controller.createConversation.mockResolvedValueOnce(false)
    const view = render(page("bob", true))
    const retry = await screen.findByRole("button", {
      name: "Retry opening conversation",
    })
    expect(mocked.controller.createConversation).toHaveBeenCalledTimes(1)

    mocked.state = state({ error: "The network is unavailable." })
    view.rerender(page("bob", true))
    expect(mocked.controller.createConversation).toHaveBeenCalledTimes(1)
    await userEvent.click(retry)
    await waitFor(() =>
      expect(mocked.controller.createConversation).toHaveBeenCalledTimes(2)
    )
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Retry opening conversation",
        })
      ).not.toBeInTheDocument()
    )
    expect(mocked.controller.select).not.toHaveBeenCalled()
  })

  it("retries opening an existing conversation without creating another", async () => {
    mocked.state = state({
      error: "Could not load device keys.",
      conversations: [conversation],
    })
    mocked.controller.select.mockResolvedValueOnce(false)
    render(page("bob"))
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Retry opening conversation",
      })
    )
    await waitFor(() =>
      expect(mocked.controller.select).toHaveBeenCalledTimes(2)
    )
    expect(mocked.controller.createConversation).not.toHaveBeenCalled()
  })

  it.each(["alice", "ALICE", "ab", "../bob", "bob<script>", "user name", ""])(
    "ignores self or invalid recipient %s",
    async (target) => {
      render(page(target))
      await Promise.resolve()
      expect(mocked.controller.createConversation).not.toHaveBeenCalled()
      expect(mocked.controller.select).not.toHaveBeenCalled()
    }
  )

  it("provides the existing public profile route from the selected chat heading", async () => {
    mocked.state = state({
      selected: conversation,
      conversations: [conversation],
    })
    render(page(""))
    expect(
      await screen.findByRole("link", { name: "Bob Example" })
    ).toHaveAttribute("href", "/u/bob")
  })
})

describe("messaging inbox", () => {
  const bob: ChatConversation = {
    ...conversation,
    received_count: 32,
    unread_count: 3,
  }
  const carol: ChatConversation = {
    ...conversation,
    public_conversation_id: "conversation-carol-001",
    peer: {
      user_handle: "carol",
      full_name: "Carol Example",
      avatar_storage_key: null,
    },
    received_count: 17,
    unread_count: 0,
  }

  it("allows writing immediately even before the recipient registers a messaging device", () => {
    mocked.state = state({ selected: bob, conversations: [bob], trusts: [] })
    render(page(""))
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled()
    expect(
      screen.queryByText(/Ask this person to open Messaging/)
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Write your first message below/)
    ).toBeInTheDocument()
  })

  it("shows saved outgoing messages as queued without increasing received counts", () => {
    mocked.state = state({
      selected: conversation,
      conversations: [conversation],
      pendingDelivery: "recipient-setup",
      messages: [
        {
          public_message_id: null,
          conversation_id: conversation.public_conversation_id,
          client_message_id: "queued-message-001",
          sender_device_id: "device-alice-001",
          sender_handle: "alice",
          text: "Hello before your first visit",
          created_at: "2026-11-05T00:00:00Z",
          status: "pending",
        },
      ],
    })
    render(page(""))
    expect(screen.getByRole("log")).toHaveTextContent(
      "Hello before your first visit"
    )
    expect(screen.getByLabelText("pending")).toHaveTextContent("Queued")
    expect(
      screen.getByRole("status", { name: "Queued message status" })
    ).toHaveTextContent(
      "Waiting for the recipient to set up messaging before delivery."
    )
    expect(
      screen.getByLabelText("0 total messages received")
    ).toHaveTextContent("0")
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled()
  })

  it("sends with existing unverified device records without displaying manual verification controls", () => {
    mocked.state = state({
      selected: conversation,
      conversations: [conversation],
      pendingDelivery: "connection",
      trusts: [
        {
          public_device_id: "device-bob-001",
          user_handle: "bob",
          verified: false,
          safety_number: "123",
        },
      ],
      messages: [
        {
          public_message_id: null,
          conversation_id: conversation.public_conversation_id,
          client_message_id: "queued-message-001",
          sender_device_id: "device-alice-001",
          sender_handle: "alice",
          text: "Waiting to deliver",
          created_at: "2026-11-05T00:00:00Z",
          status: "pending",
        },
      ],
    })
    render(page(""))
    expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled()
    expect(
      screen.getByRole("status", { name: "Queued message status" })
    ).toHaveTextContent("Sending your messages securely…")
    expect(screen.queryByText(/Verify.*device/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole("textbox", { name: "Matching safety number" })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("pending")).toHaveTextContent("Sending…")
  })

  it("shows total and selected conversation received counts from server metadata", () => {
    mocked.state = state({
      selected: bob,
      conversations: [bob, carol],
      summary: { received_count: 149, unread_count: 3 },
      messages: [],
    })
    render(page(""))

    expect(
      screen.getByLabelText("149 total messages received")
    ).toHaveTextContent("149")
    expect(
      screen.getByLabelText("32 messages received in this conversation")
    ).toHaveTextContent("32 received")
    expect(
      screen.getByLabelText("3 unread messages from Bob Example")
    ).toHaveTextContent("3")
    expect(screen.getByRole("button", { name: "Unread 3" })).toBeInTheDocument()
  })

  it("filters out read conversations and restores them with All chats", async () => {
    mocked.state = state({ conversations: [bob, carol] })
    render(page(""))
    const user = userEvent.setup()

    expect(
      screen.getByRole("button", { name: /Carol Example/ })
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Unread 3" }))
    expect(screen.getByRole("button", { name: "Unread 3" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    expect(
      screen.getByRole("button", { name: /Bob Example/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Carol Example/ })
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText("49 total messages received")
    ).toHaveTextContent("49")

    await user.click(screen.getByRole("button", { name: "All chats" }))
    expect(
      screen.getByRole("button", { name: /Carol Example/ })
    ).toBeInTheDocument()
  })

  it("keeps the full inbox and requested recipient visible while messaging is disabled", () => {
    mocked.state = state({ phase: "disabled" })
    render(page("bob"))

    expect(
      screen.getByRole("region", { name: "Messaging" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Messaging" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New message" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "All chats" })
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unread" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Find people" })).toBeEnabled()
    expect(screen.getByRole("link", { name: "@bob" })).toHaveAttribute(
      "href",
      "/u/bob"
    )
    expect(
      screen.getByRole("log", { name: "Message history" })
    ).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled()
    expect(
      screen.getByLabelText("0 total messages received")
    ).toBeInTheDocument()
    expect(mocked.controller.createConversation).not.toHaveBeenCalled()
    expect(mocked.controller.select).not.toHaveBeenCalled()
  })

  it("opens the matching conversation when a sidebar recipient is selected", async () => {
    mocked.state = state({ conversations: [bob, carol] })
    render(page(""))

    await userEvent.click(screen.getByRole("button", { name: /Carol Example/ }))
    await waitFor(() =>
      expect(mocked.controller.select).toHaveBeenCalledExactlyOnceWith(carol)
    )
    expect(mocked.controller.createConversation).not.toHaveBeenCalled()
  })
})
