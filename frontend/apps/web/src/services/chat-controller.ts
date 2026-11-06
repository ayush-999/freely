import axios from "axios"
import { tokenStorage } from "@workspace/auth"
import { getApiErrorMessage } from "@workspace/utils"
import { ChatCrypto } from "@/crypto"
import type { HistoryMessage, PeerBundle, PeerTrust } from "@/crypto/types"
import type {
  ChatConversation,
  ChatDevice,
  ChatEvent,
  ChatSummary,
  ServerMessage,
} from "@/types/chat"
import { peerBundle } from "@/types/chat"
import { createChatService } from "./chat.service"
import { ChatRealtime, type ConnectionState } from "./chat-realtime"

export type PendingDelivery = "recipient-setup" | "connection"

export interface ChatSnapshot {
  phase: "loading" | "disabled" | "ready" | "error"
  connection: ConnectionState
  conversations: ChatConversation[]
  summary?: ChatSummary
  selected: ChatConversation | null
  messages: HistoryMessage[]
  devices: ChatDevice[]
  deviceId: string | null
  trusts: PeerTrust[]
  busy: boolean
  error: string | null
  typing: boolean
  online: boolean
  hasOlder: boolean
  pendingDelivery?: PendingDelivery | null
}

function initialSnapshot(): ChatSnapshot {
  return {
    phase: "loading",
    connection: "connecting",
    conversations: [],
    selected: null,
    messages: [],
    devices: [],
    deviceId: null,
    trusts: [],
    busy: false,
    error: null,
    typing: false,
    online: false,
    hasOlder: false,
    pendingDelivery: null,
  }
}

/** Account-session state. Selected plaintext is cleared when the messaging page closes. */
export class ChatController {
  private account: string
  private snapshot = initialSnapshot()
  private listeners = new Set<() => void>()
  private crypto: ChatCrypto | null = null
  private realtime: ChatRealtime | null = null
  private poll: ReturnType<typeof setInterval> | null = null
  private typingTimer: ReturnType<typeof setTimeout> | null = null
  private peers = new Map<string, PeerBundle>()
  private syncing: Promise<void> | null = null
  private running = false
  private api = createChatService()
  private abort: AbortController | null = null
  private epoch = 0
  private olderCursor: string | null = null
  private lastTypingAt = 0
  private lastKeyRefresh = 0
  private selectionEpoch = 0
  private pendingReasons = new Map<string, PendingDelivery>()

  constructor(account: string) {
    this.account = account
  }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  private update(next: Partial<ChatSnapshot>) {
    if (!this.running) return
    this.snapshot = { ...this.snapshot, ...next }
    this.listeners.forEach((listener) => listener())
  }
  private fail(error: unknown) {
    if (axios.isCancel(error)) return
    this.update({
      error: getApiErrorMessage(
        error,
        "Messaging could not complete this action."
      ),
    })
  }

  private waiting(conversationId: string, reason: PendingDelivery) {
    this.pendingReasons.set(conversationId, reason)
    if (this.snapshot.selected?.public_conversation_id === conversationId)
      this.update({ pendingDelivery: reason })
  }

  private deliveryState(conversationId: string, messages: HistoryMessage[]) {
    return messages.some(
      (message) =>
        message.sender_handle === this.account && message.status === "pending"
    )
      ? (this.pendingReasons.get(conversationId) ?? "connection")
      : null
  }

  async start() {
    this.running = true
    const epoch = ++this.epoch
    this.abort = new AbortController()
    this.api = createChatService(
      tokenStorage.get() ?? undefined,
      this.abort.signal
    )
    const alive = () => this.running && epoch === this.epoch
    this.update({ phase: "loading", error: null })
    try {
      const config = await this.api.config()
      if (!this.running || epoch !== this.epoch) return
      if (!config.enabled) {
        this.update({
          phase: "disabled",
          error:
            config.unavailable_reason ??
            "Messaging is temporarily unavailable. Please try again shortly.",
        })
        return
      }
      const vault = await ChatCrypto.open(this.account)
      if (!this.running || epoch !== this.epoch) {
        vault.close()
        return
      }
      this.crypto = vault
      const devices = await this.api.devices()
      if (!alive()) return
      let material = await vault.getDevice()
      if (!alive()) return
      if (!material)
        material = await vault.provision(
          Math.max(0, ...devices.map((device) => device.signal_device_id)) + 1
        )
      if (!alive()) return
      let device = devices.find(
        (item) => item.public_device_id === material?.public_device_id
      )
      if (!material.public_device_id) {
        device = devices.find(
          (item) =>
            item.signal_device_id === material?.signal_device_id &&
            item.identity_public_key === material?.identity_public_key
        )
        device ??= await this.api.registerDevice(material)
        if (!alive()) return
        await vault.attachDevice(device.public_device_id)
      }
      if (!device || device.revoked_at)
        throw new Error(
          "This messaging device has been revoked. Use another trusted device."
        )
      if (!alive()) return
      await vault.refreshPrekeys()
      const publicMaterial = await vault.getDevice()
      if (!alive() || !publicMaterial) return
      await this.api.uploadKeys(device.public_device_id, publicMaterial.prekeys)
      this.lastKeyRefresh = Date.now()
      if (!this.running || epoch !== this.epoch) return
      const [activeDevices, conversations, summary] = await Promise.all([
        this.api.devices(),
        this.api.conversations(),
        this.api.summary(),
      ])
      if (!alive()) return
      this.update({
        phase: "ready",
        deviceId: device.public_device_id,
        devices: activeDevices,
        conversations,
        summary,
      })
      this.realtime = new ChatRealtime(
        device.public_device_id,
        (event) => {
          void this.event(event).catch((error: unknown) => this.fail(error))
        },
        (connection) => {
          this.update({ connection })
          if (connection === "online") {
            void this.sync()
            void this.refreshConversations()
            void this.loadHistory(false)
          }
        }
      )
      this.realtime.start()
      this.poll = setInterval(() => {
        void this.sync()
        void this.refreshConversations()
        void this.loadHistory(false)
      }, 5000)
      await this.sync()
    } catch (error) {
      if (this.running && epoch === this.epoch) {
        this.fail(error)
        this.update({ phase: "error" })
      }
    }
  }

  stop() {
    this.running = false
    this.epoch++
    this.abort?.abort()
    this.abort = null
    if (this.poll) clearInterval(this.poll)
    if (this.typingTimer) clearTimeout(this.typingTimer)
    this.poll = null
    this.realtime?.stop()
    this.realtime = null
    this.crypto?.close()
    this.crypto = null
    this.syncing = null
    this.selectionEpoch++
    this.peers.clear()
    this.pendingReasons.clear()
    this.snapshot = initialSnapshot()
  }

  async refreshConversations() {
    const epoch = this.epoch
    try {
      const [conversations, summary] = await Promise.all([
        this.api.conversations(),
        this.api.summary(),
      ])
      if (epoch === this.epoch && this.running) {
        this.update({
          conversations,
          summary,
          selected:
            conversations.find(
              (item) =>
                item.public_conversation_id ===
                this.snapshot.selected?.public_conversation_id
            ) ?? this.snapshot.selected,
        })
        window.dispatchEvent(new Event("freely:chat-updated"))
      }
    } catch (error) {
      if (epoch === this.epoch) this.fail(error)
    }
  }

  async createConversation(handle: string) {
    this.update({ busy: true, error: null })
    try {
      const conversation = await this.api.createConversation(handle)
      await this.refreshConversations()
      return await this.select(conversation)
    } catch (error) {
      this.fail(error)
      return false
    } finally {
      this.update({ busy: false })
    }
  }

  async select(conversation: ChatConversation) {
    if (!this.crypto) return false
    const selection = ++this.selectionEpoch
    const previous = this.snapshot.selected
    if (previous)
      this.realtime?.send("typing.stop", {
        public_conversation_id: previous.public_conversation_id,
      })
    this.olderCursor = null
    this.update({
      selected: conversation,
      messages: [],
      trusts: [],
      typing: false,
      online: false,
      hasOlder: false,
      pendingDelivery: null,
      error: null,
    })
    try {
      await this.loadPeers(conversation)
      if (selection !== this.selectionEpoch || !this.running) return false
      this.realtime?.send("presence.subscribe", {
        public_conversation_id: conversation.public_conversation_id,
      })
      await this.loadHistory(false)
      await this.sync()
      return selection === this.selectionEpoch && this.running
    } catch (error) {
      this.fail(error)
      return false
    }
  }

  clearSelection() {
    if (!this.snapshot.selected && !this.snapshot.messages.length) return
    this.typing(false)
    this.selectionEpoch++
    this.olderCursor = null
    this.update({
      selected: null,
      messages: [],
      trusts: [],
      pendingDelivery: null,
      typing: false,
      online: false,
      hasOlder: false,
    })
  }

  private async loadPeers(conversation: ChatConversation) {
    const vault = this.crypto
    if (!vault) return null
    const epoch = this.epoch
    const selection = this.selectionEpoch
    const bundles = [
      ...(await this.api.keys(conversation.peer.user_handle)),
      ...(await this.api.keys(this.account)),
    ]
    const trusts: PeerTrust[] = []
    for (const bundle of bundles) {
      if (!this.running || epoch !== this.epoch) return null
      if (bundle.device.public_device_id === this.snapshot.deviceId) continue
      const peer = peerBundle(bundle)
      const trust = await vault.acceptPeer(peer)
      if (!this.running || epoch !== this.epoch) return null
      this.peers.set(peer.public_device_id, peer)
      trusts.push(trust)
    }
    if (
      epoch === this.epoch &&
      selection === this.selectionEpoch &&
      this.snapshot.selected?.public_conversation_id ===
        conversation.public_conversation_id
    )
      this.update({ trusts })
    return trusts
  }

  /** Validate and pin destination identities before creating encrypted envelopes. */
  private async queuedDestinations(
    conversation: ChatConversation,
    deviceId: string
  ) {
    const vault = this.crypto
    if (!vault) return null
    const epoch = this.epoch
    const trusts = await this.loadPeers(conversation)
    if (!trusts || epoch !== this.epoch || !this.running) return null
    const id = conversation.public_conversation_id
    if (
      !trusts.some(
        (trust) =>
          trust.user_handle.toLowerCase() ===
          conversation.peer.user_handle.toLowerCase()
      )
    ) {
      this.waiting(id, "recipient-setup")
      return null
    }
    const peers = [
      ...(await this.destinationBundles(
        conversation.peer.user_handle,
        deviceId
      )),
      ...(await this.destinationBundles(this.account, deviceId)),
    ]
    if (epoch !== this.epoch || !this.running) return null
    if (
      !peers.some(
        (peer) =>
          peer.user_handle.toLowerCase() ===
          conversation.peer.user_handle.toLowerCase()
      )
    ) {
      this.waiting(id, "recipient-setup")
      return null
    }
    // A device may register between the directory read and the key claim.
    for (const peer of peers) {
      await vault.acceptPeer(peer)
      if (epoch !== this.epoch || !this.running) return null
    }
    this.waiting(id, "connection")
    return peers
  }

  private async destinationBundles(
    handle: string,
    deviceId: string
  ): Promise<PeerBundle[]> {
    const vault = this.crypto
    if (!vault) throw new Error("This encryption session is closed")
    const directory = (await this.api.keys(handle))
      .map(peerBundle)
      .filter((peer) => peer.public_device_id !== deviceId)
    const needed = new Set<string>()
    for (const peer of directory)
      if (await vault.needsSession(peer.public_device_id))
        needed.add(peer.public_device_id)
    if (!needed.size) return directory
    const claimed = (await this.api.claim(handle, deviceId)).map(peerBundle)
    return directory.map((peer) =>
      needed.has(peer.public_device_id)
        ? (claimed.find(
            (item) => item.public_device_id === peer.public_device_id
          ) ?? peer)
        : peer
    )
  }

  private async process(message: ServerMessage) {
    const vault = this.crypto
    const deviceId = this.snapshot.deviceId
    if (!vault || !deviceId) return
    if (
      message.ciphertext &&
      message.message_type &&
      message.recipient_device_id === deviceId
    ) {
      let sender =
        this.peers.get(message.sender_device.public_device_id) ??
        (await vault.getPeer(message.sender_device.public_device_id)) ??
        undefined
      if (!sender) {
        const bundle = (await this.api.keys(message.sender_handle)).find(
          (item) =>
            item.device.public_device_id ===
            message.sender_device.public_device_id
        )
        if (!bundle)
          throw new Error(
            "The sender's messaging device is no longer available."
          )
        sender = peerBundle(bundle)
        await vault.acceptPeer(sender)
        this.peers.set(sender.public_device_id, sender)
      }
      await vault.receive({
        public_message_id: message.public_message_id,
        conversation_id: message.public_conversation_id,
        client_message_id: message.client_message_id,
        sender,
        recipient_device_id: deviceId,
        message_type: message.message_type,
        ciphertext: message.ciphertext,
        created_at: message.created_at,
      })
      await this.api.receipt(message.public_message_id, deviceId, "delivered")
    }
    if (message.sender_handle === this.account)
      await vault.markReceipt(message.public_message_id, message.status)
  }

  async loadHistory(older = true) {
    const epoch = this.epoch
    const selection = this.selectionEpoch
    const selected = this.snapshot.selected
    const vault = this.crypto
    const deviceId = this.snapshot.deviceId
    if (!selected || !vault || !deviceId) return
    const id = selected.public_conversation_id
    try {
      const local = await vault.history(id)
      if (epoch !== this.epoch || selection !== this.selectionEpoch) return
      this.update({
        messages: local,
        pendingDelivery: this.deliveryState(id, local),
      })
      const page = await this.api.messages(
        id,
        deviceId,
        older ? (this.olderCursor ?? undefined) : undefined
      )
      for (const item of [...page.items].reverse()) {
        if (epoch !== this.epoch || !this.running) return
        try {
          await this.process(item)
        } catch {
          /* Undecryptable ciphertext stays unacknowledged for recovery. */
        }
      }
      const messages = await vault.history(id)
      if (
        epoch !== this.epoch ||
        selection !== this.selectionEpoch ||
        this.snapshot.selected?.public_conversation_id !== id
      )
        return
      if (older || this.olderCursor === null)
        this.olderCursor = page.next_before_id
      this.update({
        messages,
        hasOlder: !!this.olderCursor,
        pendingDelivery: this.deliveryState(id, messages),
      })
    } catch (error) {
      if (epoch === this.epoch) this.fail(error)
    }
  }

  async markVisibleRead() {
    if (document.visibilityState !== "visible" || !document.hasFocus()) return
    const selected = this.snapshot.selected
    const vault = this.crypto
    const deviceId = this.snapshot.deviceId
    if (!selected || !vault || !deviceId) return
    const epoch = this.epoch
    const selection = this.selectionEpoch
    let changed = false
    try {
      for (const message of this.snapshot.messages) {
        if (
          message.sender_handle === this.account ||
          message.status === "read" ||
          !message.public_message_id
        )
          continue
        if (
          !this.running ||
          this.snapshot.selected?.public_conversation_id !==
            selected.public_conversation_id
        )
          return
        await this.api.receipt(message.public_message_id, deviceId, "read")
        await vault.markReceipt(message.public_message_id, "read")
        changed = true
      }
      const messages = await vault.history(selected.public_conversation_id)
      if (
        epoch === this.epoch &&
        selection === this.selectionEpoch &&
        this.snapshot.selected?.public_conversation_id ===
          selected.public_conversation_id
      )
        this.update({ messages })
      if (changed) await this.refreshConversations()
    } catch (error) {
      this.fail(error)
    }
  }

  sync(): Promise<void> {
    if (!this.running || !this.crypto || !this.snapshot.deviceId)
      return Promise.resolve()
    if (this.syncing) return this.syncing
    const pending = this.doSync().finally(() => {
      if (this.syncing === pending) this.syncing = null
    })
    this.syncing = pending
    return this.syncing
  }

  private async doSync() {
    const epoch = this.epoch
    const vault = this.crypto
    const deviceId = this.snapshot.deviceId
    if (!vault || !deviceId) return
    try {
      const queued = await vault.queuedMessages()
      const groups = new Map<string, HistoryMessage[]>()
      for (const message of queued) {
        const group = groups.get(message.conversation_id) ?? []
        group.push(message)
        groups.set(message.conversation_id, group)
      }
      for (const [id, messages] of groups) {
        if (epoch !== this.epoch || !this.running) return
        try {
          const conversation =
            this.snapshot.conversations.find(
              (item) => item.public_conversation_id === id
            ) ??
            (this.snapshot.selected?.public_conversation_id === id
              ? this.snapshot.selected
              : null) ??
            (await this.api.conversation(id))
          const peers = await this.queuedDestinations(conversation, deviceId)
          if (!peers || epoch !== this.epoch || !this.running) continue
          for (const message of messages)
            await vault.prepareQueuedMessage(message.client_message_id, peers)
        } catch (error) {
          if (epoch === this.epoch) {
            this.waiting(id, "connection")
            this.fail(error)
          }
        }
      }
      let sentAny = false
      for (let pending of await vault.outbox()) {
        if (epoch !== this.epoch || !this.running) return
        try {
          let result
          try {
            result = await this.api.send(pending)
          } catch (error) {
            if (
              !axios.isAxiosError(error) ||
              error.response?.status !== 409 ||
              !String(error.response.data?.detail).startsWith(
                "Device roster changed;"
              )
            )
              throw error
            const conversation =
              this.snapshot.conversations.find(
                (item) =>
                  item.public_conversation_id === pending.conversation_id
              ) ?? (await this.api.conversation(pending.conversation_id))
            const peers = await this.queuedDestinations(conversation, deviceId)
            if (!peers) continue
            pending = await vault.repreparePending(
              pending.client_message_id,
              peers
            )
            result = await this.api.send(pending)
          }
          await vault.confirmSent(
            pending.client_message_id,
            result.public_message_id,
            result.created_at
          )
          sentAny = true
        } catch (error) {
          if (epoch === this.epoch) {
            this.waiting(pending.conversation_id, "connection")
            this.fail(error)
          }
        }
      }
      if (sentAny) {
        this.update({ error: null })
        await this.refreshConversations()
      }
      let afterId: string | undefined
      const seenCursors = new Set<string>()
      do {
        if (epoch !== this.epoch || !this.running) return
        const page = await this.api.pending(deviceId, afterId)
        for (const message of page.items) {
          try {
            await this.process(message)
          } catch {
            if (
              message.public_conversation_id ===
              this.snapshot.selected?.public_conversation_id
            )
              this.update({
                error:
                  "A message is waiting for secure delivery. Please try again shortly.",
              })
          }
        }
        afterId = page.next_after_id ?? undefined
        if (afterId && seenCursors.has(afterId))
          throw new Error(
            "Messaging returned a repeated recovery cursor. Retry the connection."
          )
        if (afterId) seenCursors.add(afterId)
      } while (afterId && this.running)
      if (Date.now() - this.lastKeyRefresh > 60000) {
        const devices = await this.api.devices()
        const own = devices.find(
          (device) => device.public_device_id === deviceId
        )
        if (!own || own.revoked_at)
          throw new Error("This messaging device has been revoked.")
        await vault.refreshPrekeys({
          ec: own.available_ec_one_time ?? 0,
          kem: own.available_kem_one_time ?? 0,
        })
        const material = await vault.getDevice()
        if (material) await this.api.uploadKeys(deviceId, material.prekeys)
        this.lastKeyRefresh = Date.now()
        this.update({ devices })
      }
      const selected = this.snapshot.selected
      if (selected) {
        if (
          !this.snapshot.trusts.some(
            (trust) => trust.user_handle === selected.peer.user_handle
          )
        )
          await this.loadPeers(selected)
        const messages = await vault.history(selected.public_conversation_id)
        if (
          epoch === this.epoch &&
          this.snapshot.selected?.public_conversation_id ===
            selected.public_conversation_id
        )
          this.update({
            messages,
            pendingDelivery: this.deliveryState(
              selected.public_conversation_id,
              messages
            ),
          })
      }
    } catch (error) {
      if (epoch === this.epoch) this.fail(error)
    }
  }

  async send(text: string) {
    const selected = this.snapshot.selected
    const vault = this.crypto
    const deviceId = this.snapshot.deviceId
    if (
      !selected ||
      !vault ||
      !deviceId ||
      !text.trim() ||
      this.snapshot.phase !== "ready"
    )
      return false
    const epoch = this.epoch
    this.update({ busy: true, error: null })
    try {
      await vault.queueMessage({
        conversation_id: selected.public_conversation_id,
        client_message_id: crypto.randomUUID(),
        text,
      })
      if (epoch !== this.epoch || !this.running) return false
      const messages = await vault.history(selected.public_conversation_id)
      if (epoch !== this.epoch || !this.running) return false
      if (
        this.snapshot.selected?.public_conversation_id ===
        selected.public_conversation_id
      ) {
        const reason = !this.snapshot.trusts.some(
          (trust) =>
            trust.user_handle.toLowerCase() ===
            selected.peer.user_handle.toLowerCase()
        )
          ? "recipient-setup"
          : "connection"
        this.waiting(selected.public_conversation_id, reason)
        this.update({ messages })
      }
      if (
        this.snapshot.selected?.public_conversation_id ===
        selected.public_conversation_id
      )
        this.typing(false)
      void this.sync()
      return true
    } catch (error) {
      this.fail(error)
      return false
    } finally {
      this.update({ busy: false })
    }
  }

  typing(active: boolean) {
    const id = this.snapshot.selected?.public_conversation_id
    if (!id) return
    if (active && Date.now() - this.lastTypingAt < 1500) return
    this.lastTypingAt = Date.now()
    this.realtime?.send(active ? "typing.start" : "typing.stop", {
      public_conversation_id: id,
    })
  }

  async revoke(deviceId: string) {
    try {
      await this.api.revokeDevice(deviceId)
      if (deviceId === this.snapshot.deviceId) {
        this.stop()
        this.running = true
        this.update({
          phase: "error",
          error: "This messaging device has been revoked.",
          connection: "offline",
        })
        return
      }
      this.update({ devices: await this.api.devices() })
    } catch (error) {
      this.fail(error)
    }
  }

  private async event(event: ChatEvent) {
    if (!this.running) return
    if (
      event.type === "device.revoked" &&
      event.data?.public_device_id === this.snapshot.deviceId
    ) {
      this.stop()
      this.running = true
      this.update({
        phase: "error",
        error: "This messaging device has been revoked.",
        connection: "offline",
      })
      return
    }
    if (event.type === "message.receive") {
      await this.sync()
      await this.refreshConversations()
      return
    }
    const data = event.data
    if (!data) return
    if (
      ["message.read", "message.delivered"].includes(event.type) &&
      typeof data.public_message_id === "string"
    ) {
      await this.crypto?.markReceipt(
        data.public_message_id,
        event.type === "message.read" ? "read" : "delivered"
      )
      const selected = this.snapshot.selected
      if (selected) {
        const epoch = this.epoch
        const selection = this.selectionEpoch
        const messages =
          (await this.crypto?.history(selected.public_conversation_id)) ?? []
        if (
          epoch === this.epoch &&
          selection === this.selectionEpoch &&
          this.snapshot.selected?.public_conversation_id ===
            selected.public_conversation_id
        )
          this.update({ messages })
      }
    }
    if (
      data.public_conversation_id !==
        this.snapshot.selected?.public_conversation_id ||
      data.user_handle === this.account
    )
      return
    if (event.type === "user.online" || event.type === "user.offline")
      this.update({ online: event.type === "user.online" })
    if (event.type === "typing.start" || event.type === "typing.stop") {
      if (this.typingTimer) clearTimeout(this.typingTimer)
      this.update({ typing: event.type === "typing.start" })
      if (event.type === "typing.start")
        this.typingTimer = setTimeout(
          () => this.update({ typing: false }),
          5000
        )
    }
  }
}
