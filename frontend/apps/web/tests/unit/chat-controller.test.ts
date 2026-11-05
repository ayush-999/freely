import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  DeviceMaterial,
  HistoryMessage,
  IncomingMessage,
  PeerBundle,
  PreparedMessage,
  PublicPreKey,
} from "@/crypto/types"
import type {
  ChatConversation,
  ChatDevice,
  ChatEvent,
  MessagePage,
  ServerMessage,
} from "@/types/chat"

type Connection = "connecting" | "online" | "reconnecting" | "offline"
interface FakeRealtime {
  deviceId: string
  event: (event: ChatEvent) => void
  state: (connection: Connection) => void
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
}

const mocked = vi.hoisted(() => ({
  open: vi.fn(),
  factory: vi.fn(),
  token: vi.fn(),
  sockets: [] as FakeRealtime[],
}))

vi.mock("@/crypto", () => ({ ChatCrypto: { open: mocked.open } }))
vi.mock("@/services/chat.service", () => ({
  createChatService: mocked.factory,
}))
vi.mock("@workspace/auth", () => ({ tokenStorage: { get: mocked.token } }))
vi.mock("@/services/chat-realtime", () => ({
  ChatRealtime: class {
    start = vi.fn()
    stop = vi.fn()
    send = vi.fn()
    constructor(
      public deviceId: string,
      public event: (event: ChatEvent) => void,
      public state: (connection: Connection) => void
    ) {
      mocked.sockets.push(this)
    }
  },
}))

import { ChatController } from "@/services/chat-controller"

const ownDevice: ChatDevice = {
  public_device_id: "device-alice-0001",
  user_handle: "alice",
  signal_device_id: 1,
  registration_id: 41,
  protocol_version: "signal-pqxdh-v1",
  identity_public_key: "public-alice-identity",
  label: "This browser",
  created_at: "2026-11-04T10:00:00Z",
  revoked_at: null,
  available_ec_one_time: 20,
  available_kem_one_time: 5,
}
const peerDevice: ChatDevice = {
  ...ownDevice,
  public_device_id: "device-bob-000001",
  user_handle: "bob",
  registration_id: 42,
  identity_public_key: "public-bob-identity",
}
const conversation: ChatConversation = {
  public_conversation_id: "conversation-0001",
  peer: { user_handle: "bob", full_name: "Bob", avatar_storage_key: null },
  created_at: "2026-11-04T10:00:00Z",
  updated_at: null,
}
const oldKeys: PublicPreKey[] = [
  {
    key_kind: "ec_signed",
    key_id: 1,
    public_key: "old-public-key",
    signature: "old-public-signature",
  },
]
const refreshedKeys: PublicPreKey[] = [
  {
    key_kind: "ec_signed",
    key_id: 2,
    public_key: "new-public-key",
    signature: "new-public-signature",
  },
]
const peerBundle: PeerBundle = { ...peerDevice, prekeys: refreshedKeys }

function emptyPage(): MessagePage {
  return { items: [], next_before_id: null, next_after_id: null }
}
function serverMessage(
  id: string,
  override: Partial<ServerMessage> = {}
): ServerMessage {
  return {
    public_message_id: id,
    public_conversation_id: conversation.public_conversation_id,
    client_message_id: `client-${id}`,
    sender_handle: "bob",
    sender_device: peerDevice,
    created_at: "2026-11-04T10:01:00Z",
    status: "sent",
    ciphertext: `opaque-ciphertext-${id}`,
    message_type: 3,
    recipient_device_id: ownDevice.public_device_id,
    ...override,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function settle() {
  for (let index = 0; index < 50; index++) await Promise.resolve()
}

let controllers: ChatController[]
let material: DeviceMaterial
let archive: HistoryMessage[]
let outbox: PreparedMessage[]
let rejectedMessages: Set<string>

function createVault() {
  return {
    getDevice: vi.fn(async () => material),
    provision: vi.fn(async () => material),
    attachDevice: vi.fn(async (id: string) => {
      material.public_device_id = id
    }),
    refreshPrekeys: vi.fn(async () => {
      material = { ...material, prekeys: refreshedKeys }
      return []
    }),
    needsSession: vi.fn(async () => false),
    getPeer: vi.fn(async (id: string) =>
      id === peerBundle.public_device_id ? peerBundle : null
    ),
    acceptPeer: vi.fn(async (bundle: PeerBundle) => ({
      public_device_id: bundle.public_device_id,
      user_handle: bundle.user_handle,
      verified: true,
      safety_number: "1".repeat(60),
    })),
    verifyPeer: vi.fn(async () => undefined),
    receive: vi.fn(async (input: IncomingMessage) => {
      if (rejectedMessages.has(input.public_message_id))
        throw new Error("Cannot decrypt this envelope")
      let item = archive.find(
        (message) => message.public_message_id === input.public_message_id
      )
      if (!item) {
        item = {
          public_message_id: input.public_message_id,
          conversation_id: input.conversation_id,
          client_message_id: input.client_message_id,
          sender_device_id: input.sender.public_device_id,
          sender_handle: input.sender.user_handle,
          text: "Decrypted locally 💬",
          created_at: input.created_at,
          status: "delivered",
        }
        archive.push(item)
      }
      return item
    }),
    history: vi.fn(async (id: string) =>
      archive.filter((item) => item.conversation_id === id)
    ),
    outbox: vi.fn(async () => [...outbox]),
    prepareMessage: vi.fn(
      async (input: {
        conversation_id: string
        client_message_id: string
        text: string
        peers: PeerBundle[]
      }) => {
        const prepared: PreparedMessage = {
          conversation_id: input.conversation_id,
          client_message_id: input.client_message_id,
          sender_device_id: ownDevice.public_device_id,
          envelopes: input.peers.map((peer) => ({
            recipient_device_id: peer.public_device_id,
            protocol_version: "signal-pqxdh-v1",
            message_type: 3,
            ciphertext: `fixed-encrypted-${input.client_message_id}`,
          })),
        }
        outbox.push(prepared)
        archive.push({
          public_message_id: null,
          conversation_id: input.conversation_id,
          client_message_id: input.client_message_id,
          sender_device_id: ownDevice.public_device_id,
          sender_handle: "alice",
          text: input.text,
          created_at: "2026-11-04T10:02:00Z",
          status: "pending",
        })
        return prepared
      }
    ),
    repreparePending: vi.fn(),
    confirmSent: vi.fn(
      async (clientId: string, messageId: string, timestamp: string) => {
        outbox = outbox.filter((item) => item.client_message_id !== clientId)
        const message = archive.find(
          (item) => item.client_message_id === clientId
        )
        if (message) {
          message.public_message_id = messageId
          message.status = "sent"
          message.created_at = timestamp
        }
      }
    ),
    markReceipt: vi.fn(
      async (id: string, status: "sent" | "delivered" | "read") => {
        const message = archive.find((item) => item.public_message_id === id)
        if (message) message.status = status
      }
    ),
    close: vi.fn(),
  }
}

function createApi() {
  return {
    config: vi.fn(async () => ({
      enabled: true,
      protocol_version: "signal-pqxdh-v1",
      max_ciphertext_bytes: 65536,
    })),
    devices: vi.fn(async () => [ownDevice]),
    conversations: vi.fn(async () => [conversation]),
    createConversation: vi.fn(async () => conversation),
    registerDevice: vi.fn(async () => ownDevice),
    revokeDevice: vi.fn(async () => undefined),
    uploadKeys: vi.fn(async () => undefined),
    keys: vi.fn(async (handle: string) => [
      {
        device: handle === "alice" ? ownDevice : peerDevice,
        prekeys: refreshedKeys,
      },
    ]),
    claim: vi.fn(async (handle: string) => [
      {
        device: handle === "alice" ? ownDevice : peerDevice,
        prekeys: refreshedKeys,
      },
    ]),
    send: vi.fn(async (message: PreparedMessage) => ({
      public_message_id: "message-accepted-0001",
      client_message_id: message.client_message_id,
      created_at: "2026-11-04T10:02:01Z",
      duplicate: false,
    })),
    messages: vi.fn(async () => emptyPage()),
    pending: vi.fn(async () => emptyPage()),
    receipt: vi.fn(async () => undefined),
  }
}

let vault: ReturnType<typeof createVault>
let api: ReturnType<typeof createApi>

function controller() {
  const result = new ChatController("alice")
  controllers.push(result)
  return result
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-11-04T10:00:00Z"))
  vi.clearAllMocks()
  mocked.sockets.length = 0
  controllers = []
  archive = []
  outbox = []
  rejectedMessages = new Set()
  material = {
    ...ownDevice,
    public_device_id: ownDevice.public_device_id,
    protocol_version: "signal-pqxdh-v1",
    label: "This browser",
    prekeys: oldKeys,
  }
  vault = createVault()
  api = createApi()
  mocked.open.mockResolvedValue(vault)
  mocked.factory.mockReturnValue(api)
  mocked.token.mockReturnValue("pinned-alice-token")
  vi.spyOn(document, "hasFocus").mockReturnValue(false)
})

afterEach(() => {
  controllers.forEach((item) => item.stop())
  vi.useRealTimers()
})

describe("chat controller lifecycle and durable relay", () => {
  it("uploads the full current public material after refreshing prekeys", async () => {
    const chat = controller()
    await chat.start()
    expect(chat.getSnapshot().phase).toBe("ready")
    expect(vault.refreshPrekeys).toHaveBeenCalledOnce()
    expect(vault.getDevice).toHaveBeenCalledTimes(2)
    expect(api.uploadKeys).toHaveBeenCalledExactlyOnceWith(
      ownDevice.public_device_id,
      refreshedKeys
    )
    expect(api.registerDevice).not.toHaveBeenCalled()
    expect(mocked.factory).toHaveBeenLastCalledWith(
      "pinned-alice-token",
      expect.any(AbortSignal)
    )
  })

  it("does not open crypto, query chat tables, or connect when activation is disabled", async () => {
    api.config.mockResolvedValue({
      enabled: false,
      protocol_version: "signal-pqxdh-v1",
      max_ciphertext_bytes: 65536,
    })
    const chat = controller()
    await chat.start()
    expect(chat.getSnapshot().phase).toBe("disabled")
    expect(mocked.open).not.toHaveBeenCalled()
    expect(api.devices).not.toHaveBeenCalled()
    expect(api.uploadKeys).not.toHaveBeenCalled()
    expect(mocked.sockets).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("aborts the pinned-token service and prevents late startup writes after account cleanup", async () => {
    const delayed = deferred<ChatDevice[]>()
    api.devices.mockReturnValueOnce(delayed.promise)
    const chat = controller()
    const starting = chat.start()
    await settle()
    const signal = mocked.factory.mock.calls.at(-1)?.[1] as AbortSignal
    expect(signal.aborted).toBe(false)
    chat.stop()
    mocked.token.mockReturnValue("new-account-token")
    delayed.resolve([ownDevice])
    await starting
    expect(signal.aborted).toBe(true)
    expect(vault.close).toHaveBeenCalledOnce()
    expect(api.registerDevice).not.toHaveBeenCalled()
    expect(api.uploadKeys).not.toHaveBeenCalled()
    expect(mocked.sockets).toHaveLength(0)
    expect(chat.getSnapshot().messages).toEqual([])
    expect(chat.getSnapshot().deviceId).toBeNull()
  })

  it("keeps an offline encrypted outbox and retries exactly the original ciphertext and client ID", async () => {
    const chat = controller()
    await chat.start()
    await chat.select(conversation)
    api.send.mockRejectedValueOnce(new Error("Network offline"))
    expect(await chat.send("Hello 💬")).toBe(true)
    expect(outbox).toHaveLength(1)
    expect(chat.getSnapshot().messages[0]).toMatchObject({
      text: "Hello 💬",
      status: "pending",
    })
    const original = api.send.mock.calls[0][0]
    expect(JSON.stringify(original)).not.toContain("Hello")
    expect(vault.confirmSent).not.toHaveBeenCalled()
    await chat.sync()
    expect(api.send).toHaveBeenCalledTimes(2)
    expect(api.send.mock.calls[1][0]).toBe(original)
    expect(vault.prepareMessage).toHaveBeenCalledOnce()
    expect(api.claim).not.toHaveBeenCalled()
    expect(outbox).toHaveLength(0)
    expect(chat.getSnapshot().messages[0].status).toBe("sent")
  })

  it("reconciles receipt history after reconnect and fetches realtime messages from durable pending storage", async () => {
    const chat = controller()
    await chat.start()
    archive.push({
      public_message_id: "own-message-0001",
      conversation_id: conversation.public_conversation_id,
      client_message_id: "own-client-id",
      sender_device_id: ownDevice.public_device_id,
      sender_handle: "alice",
      text: "Stored locally",
      created_at: "2026-11-04T10:01:00Z",
      status: "sent",
    })
    await chat.select(conversation)
    api.messages.mockResolvedValue({
      items: [
        serverMessage("own-message-0001", {
          sender_handle: "alice",
          sender_device: ownDevice,
          ciphertext: null,
          message_type: null,
          recipient_device_id: null,
          status: "read",
        }),
      ],
      next_before_id: null,
      next_after_id: null,
    })
    mocked.sockets[0].state("online")
    await settle()
    expect(vault.markReceipt).toHaveBeenCalledWith("own-message-0001", "read")
    expect(chat.getSnapshot().messages[0].status).toBe("read")
    api.pending.mockResolvedValueOnce({
      items: [serverMessage("new-message-0001")],
      next_before_id: null,
      next_after_id: null,
    })
    mocked.sockets[0].event({
      type: "message.receive",
      data: { public_message_id: "new-message-0001" },
    })
    await settle()
    expect(vault.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        public_message_id: "new-message-0001",
        ciphertext: "opaque-ciphertext-new-message-0001",
      })
    )
    expect(api.receipt).toHaveBeenCalledWith(
      "new-message-0001",
      ownDevice.public_device_id,
      "delivered"
    )
    expect(api.receipt).not.toHaveBeenCalledWith(
      "new-message-0001",
      ownDevice.public_device_id,
      "read"
    )
  })

  it("scans later pending pages when an earlier envelope cannot decrypt and restarts each recovery scan", async () => {
    const chat = controller()
    await chat.start()
    rejectedMessages.add("undecryptable-0001")
    api.pending.mockResolvedValueOnce({
      items: [serverMessage("undecryptable-0001")],
      next_before_id: null,
      next_after_id: "undecryptable-0001",
    })
    api.pending.mockResolvedValueOnce({
      items: [serverMessage("trusted-message-0002")],
      next_before_id: null,
      next_after_id: null,
    })
    const priorCalls = api.pending.mock.calls.length
    await chat.sync()
    expect(api.pending.mock.calls.slice(priorCalls)).toEqual([
      [ownDevice.public_device_id, undefined],
      [ownDevice.public_device_id, "undecryptable-0001"],
    ])
    expect(api.receipt).not.toHaveBeenCalledWith(
      "undecryptable-0001",
      expect.anything(),
      expect.anything()
    )
    expect(api.receipt).toHaveBeenCalledWith(
      "trusted-message-0002",
      ownDevice.public_device_id,
      "delivered"
    )
    await chat.sync()
    expect(api.pending).toHaveBeenLastCalledWith(
      ownDevice.public_device_id,
      undefined
    )
  })

  it("marks read only after decrypted history is displayed in a focused visible conversation", async () => {
    api.pending.mockResolvedValueOnce({
      items: [serverMessage("visible-message-0001")],
      next_before_id: null,
      next_after_id: null,
    })
    const chat = controller()
    await chat.start()
    expect(api.receipt).toHaveBeenCalledWith(
      "visible-message-0001",
      ownDevice.public_device_id,
      "delivered"
    )
    await chat.select(conversation)
    await chat.markVisibleRead()
    expect(api.receipt).not.toHaveBeenCalledWith(
      "visible-message-0001",
      ownDevice.public_device_id,
      "read"
    )
    vi.mocked(document.hasFocus).mockReturnValue(true)
    await chat.markVisibleRead()
    expect(api.receipt).toHaveBeenCalledWith(
      "visible-message-0001",
      ownDevice.public_device_id,
      "read"
    )
    expect(chat.getSnapshot().messages[0].status).toBe("read")
  })

  it("clears plaintext, aborts requests, and stops polling when this device is revoked", async () => {
    const chat = controller()
    await chat.start()
    await chat.select(conversation)
    await chat.send("Private local history")
    expect(chat.getSnapshot().messages).toHaveLength(1)
    const signal = mocked.factory.mock.calls.at(-1)?.[1] as AbortSignal
    const pendingCalls = api.pending.mock.calls.length
    await chat.revoke(ownDevice.public_device_id)
    expect(chat.getSnapshot()).toMatchObject({
      phase: "error",
      connection: "offline",
      messages: [],
      selected: null,
      deviceId: null,
      trusts: [],
    })
    expect(signal.aborted).toBe(true)
    expect(vault.close).toHaveBeenCalledOnce()
    expect(mocked.sockets[0].stop).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(60000)
    expect(api.pending).toHaveBeenCalledTimes(pendingCalls)
    expect(vi.getTimerCount()).toBe(0)
  })
})
