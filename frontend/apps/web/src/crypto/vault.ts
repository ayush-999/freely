import { decode64, encode64 } from "./encoding"
import {
  createSecrets,
  initializeSignal,
  refreshKeys,
  SignalEngine,
} from "./signal-engine"
import { CHAT_PROTOCOL } from "./types"
import type {
  DeviceMaterial,
  HistoryMessage,
  IncomingMessage,
  PeerBundle,
  PeerTrust,
  PreparedMessage,
  PublicPreKey,
  VaultState,
} from "./types"

interface SealedRecord {
  iv: string
  ciphertext: string
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result)
    operation.onerror = () =>
      reject(new Error("The encrypted browser storage operation failed"))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = transaction.onabort = () =>
      reject(new Error("Encrypted browser storage could not be committed"))
  })
}

function material(state: VaultState): DeviceMaterial | null {
  if (!state.device) return null
  const engine = new SignalEngine(state)
  try {
    return {
      public_device_id: state.device.publicDeviceId,
      signal_device_id: state.device.signalDeviceId,
      registration_id: state.device.registrationId,
      protocol_version: CHAT_PROTOCOL,
      identity_public_key: engine.identityPublicKey(),
      label: "This browser",
      prekeys: state.device.publicKeys
        .filter((value) => {
          if (value.key_kind === "ec_one_time")
            return value.key_id in state.device!.ecPrekeys
          if (value.key_kind === "kem_one_time")
            return value.key_id in state.device!.kemPrekeys
          return true
        })
        .sort((a, b) => b.key_id - a.key_id)
        .filter((value, index, values) => {
          const limit =
            value.key_kind === "ec_one_time"
              ? 20
              : value.key_kind === "kem_one_time"
                ? 5
                : 1
          return (
            values
              .slice(0, index)
              .filter((prior) => prior.key_kind === value.key_kind).length <
            limit
          )
        }),
    }
  } finally {
    engine.close()
  }
}

function trust(state: VaultState, peerId: string): PeerTrust {
  const peer = state.peers[peerId]
  if (!peer) throw new Error("Unknown contact device")
  const engine = new SignalEngine(state)
  try {
    return {
      public_device_id: peerId,
      user_handle: peer.bundle.user_handle,
      verified: peer.verified,
      safety_number: engine.fingerprint(peer.bundle).displayable,
    }
  } finally {
    engine.close()
  }
}

function validateMessageText(text: string): void {
  if (!text.trim() || new TextEncoder().encode(text).length > 16_000)
    throw new Error("Enter a message of at most 16,000 UTF-8 bytes")
}

/**
 * Account-scoped encrypted IndexedDB vault. The nonextractable AES key is stored
 * as a CryptoKey by the browser; no private material enters localStorage.
 * Every operation loads a fresh snapshot under a cross-tab Web Lock, applies
 * protocol changes in temporary WASM stores, and commits one sealed record.
 */
export class ChatCrypto {
  private readonly account: string
  private readonly db: IDBDatabase
  private readonly lockName: string
  private closed = false

  private constructor(account: string, db: IDBDatabase) {
    this.account = account
    this.db = db
    this.lockName = `freely-chat-vault:${account}`
  }

  static async open(account: string): Promise<ChatCrypto> {
    if (
      !globalThis.isSecureContext ||
      !globalThis.crypto?.subtle ||
      !globalThis.indexedDB ||
      !navigator.locks
    ) {
      throw new Error(
        "Encrypted chat requires HTTPS and browser support for secure storage and Web Locks"
      )
    }
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(account))
      throw new Error("Invalid chat account")
    await initializeSignal()
    const opening = indexedDB.open(`freely-chat:${account}`, 1)
    opening.onupgradeneeded = () => opening.result.createObjectStore("records")
    const db = await request(opening)
    const vault = new ChatCrypto(account, db)
    await vault.mutate(() => undefined)
    return vault
  }

  private async read<T>(name: string): Promise<T | undefined> {
    const transaction = this.db.transaction("records", "readonly")
    return request(transaction.objectStore("records").get(name)) as Promise<
      T | undefined
    >
  }

  private async mutate<T>(
    operation: (state: VaultState) => T | Promise<T>,
    persist = true
  ): Promise<T> {
    if (this.closed) throw new Error("This encryption session is closed")
    return navigator.locks.request(this.lockName, async () => {
      if (this.closed) throw new Error("This encryption session is closed")
      let key = await this.read<CryptoKey>("key")
      if (!key)
        key = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        )
      const sealed = await this.read<SealedRecord>("state")
      let state: VaultState
      if (sealed) {
        try {
          const clear = await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: new Uint8Array(decode64(sealed.iv)),
              additionalData: new TextEncoder().encode(this.lockName),
            },
            key,
            new Uint8Array(decode64(sealed.ciphertext))
          )
          state = JSON.parse(new TextDecoder().decode(clear)) as VaultState
          if (state.version !== 1 || state.account !== this.account)
            throw new Error("Wrong vault")
        } catch {
          throw new Error(
            "The local encryption vault could not be opened. Do not replace its keys automatically."
          )
        }
      } else {
        state = {
          version: 1,
          account: this.account,
          device: null,
          peers: {},
          sessions: {},
          history: [],
          outbox: [],
        }
      }
      const result = await operation(state)
      if (this.closed) throw new Error("This encryption session is closed")
      if (persist || !sealed) {
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const ciphertext = await crypto.subtle.encrypt(
          {
            name: "AES-GCM",
            iv,
            additionalData: new TextEncoder().encode(this.lockName),
          },
          key,
          new TextEncoder().encode(JSON.stringify(state))
        )
        const transaction = this.db.transaction("records", "readwrite")
        const done = transactionDone(transaction)
        transaction.objectStore("records").put(key, "key")
        transaction.objectStore("records").put(
          {
            iv: encode64(iv),
            ciphertext: encode64(new Uint8Array(ciphertext)),
          },
          "state"
        )
        await done
      }
      return result
    })
  }

  getDevice(): Promise<DeviceMaterial | null> {
    return this.mutate(material, false)
  }

  provision(signalDeviceId = 1): Promise<DeviceMaterial> {
    return this.mutate(async (state) => {
      if (!state.device) {
        state.device = await createSecrets(signalDeviceId)
        await refreshKeys(state)
      }
      return material(state)!
    })
  }

  attachDevice(publicId: string): Promise<void> {
    return this.mutate((state) => {
      if (!state.device || !publicId)
        throw new Error("Missing browser encryption identity")
      if (
        state.device.publicDeviceId &&
        state.device.publicDeviceId !== publicId
      )
        throw new Error("This vault is already bound to another device")
      state.device.publicDeviceId = publicId
    })
  }

  refreshPrekeys(available?: {
    ec: number
    kem: number
  }): Promise<PublicPreKey[]> {
    return this.mutate(async (state) => {
      if (!state.device) throw new Error("Missing browser encryption identity")
      return refreshKeys(state, available)
    })
  }

  acceptPeer(bundle: PeerBundle): Promise<PeerTrust> {
    return this.mutate(async (state) => {
      const engine = new SignalEngine(state)
      try {
        await engine.hydrate()
        const validated = await engine.validatePeer(bundle)
        const verified = state.peers[bundle.public_device_id]?.verified ?? false
        state.peers[bundle.public_device_id] = {
          bundle: structuredClone(validated),
          verified,
        }
        return trust(state, bundle.public_device_id)
      } finally {
        engine.close()
      }
    })
  }

  listTrust(): Promise<PeerTrust[]> {
    return this.mutate(
      (state) => Object.keys(state.peers).map((id) => trust(state, id)),
      false
    )
  }

  getPeer(publicDeviceId: string): Promise<PeerBundle | null> {
    return this.mutate(
      (state) => state.peers[publicDeviceId]?.bundle ?? null,
      false
    )
  }

  needsSession(publicDeviceId: string): Promise<boolean> {
    return this.mutate((state) => !state.sessions[publicDeviceId], false)
  }

  fingerprint(
    peerId: string
  ): Promise<{ displayable: string; scannable: string }> {
    return this.mutate((state) => {
      const peer = state.peers[peerId]
      if (!peer) throw new Error("Unknown contact device")
      const engine = new SignalEngine(state)
      try {
        return engine.fingerprint(peer.bundle)
      } finally {
        engine.close()
      }
    }, false)
  }

  verifyPeer(peerId: string, expectedSafetyNumber: string): Promise<void> {
    return this.mutate((state) => {
      const expected = expectedSafetyNumber.replace(/\s/g, "")
      const actual = trust(state, peerId).safety_number
      if (!/^\d{60}$/.test(expected) || expected !== actual)
        throw new Error("The safety numbers do not match")
      state.peers[peerId].verified = true
    })
  }

  prepareMessage(input: {
    conversation_id: string
    client_message_id: string
    text: string
    peers: PeerBundle[]
  }): Promise<PreparedMessage> {
    return this.mutate((state) => this.prepareState(state, input))
  }

  /** Keep an outgoing message in the sealed archive until recipients are ready.
   * No destination keys are claimed and no plaintext is sent to the server. */
  queueMessage(input: {
    conversation_id: string
    client_message_id: string
    text: string
  }): Promise<HistoryMessage> {
    return this.mutate((state) => {
      const ownId = state.device?.publicDeviceId
      if (!ownId)
        throw new Error("Register this browser's encryption identity first")
      validateMessageText(input.text)
      const existing = state.history.find(
        (item) =>
          item.client_message_id === input.client_message_id &&
          item.sender_device_id === ownId
      )
      if (existing) {
        if (
          existing.conversation_id !== input.conversation_id ||
          existing.text !== input.text ||
          existing.sender_handle !== state.account
        )
          throw new Error(
            "Client message ID was already used for different content"
          )
        return existing
      }
      const message: HistoryMessage = {
        public_message_id: null,
        conversation_id: input.conversation_id,
        client_message_id: input.client_message_id,
        sender_device_id: ownId,
        sender_handle: state.account,
        text: input.text,
        created_at: new Date().toISOString(),
        status: "pending",
      }
      state.history.push(message)
      return message
    })
  }

  /** Unprepared messages are distinct from the outbox's immutable retry bytes. */
  queuedMessages(): Promise<HistoryMessage[]> {
    return this.mutate((state) => {
      const preparedIds = new Set(
        state.outbox.map((item) => item.client_message_id)
      )
      return state.history.filter(
        (item) =>
          item.sender_handle === state.account &&
          item.sender_device_id === state.device?.publicDeviceId &&
          item.status === "pending" &&
          item.public_message_id === null &&
          !preparedIds.has(item.client_message_id)
      )
    }, false)
  }

  prepareQueuedMessage(
    clientId: string,
    peers: PeerBundle[]
  ): Promise<PreparedMessage> {
    return this.mutate((state) => {
      const prepared = state.outbox.find(
        (item) => item.client_message_id === clientId
      )
      if (prepared) return prepared
      const queued = state.history.find(
        (item) =>
          item.client_message_id === clientId &&
          item.sender_handle === state.account &&
          item.sender_device_id === state.device?.publicDeviceId &&
          item.status === "pending" &&
          item.public_message_id === null
      )
      if (!queued) throw new Error("This message is not waiting to be prepared")
      return this.prepareState(state, {
        conversation_id: queued.conversation_id,
        client_message_id: queued.client_message_id,
        text: queued.text,
        peers,
      })
    })
  }

  /** Only call after the server definitively rejected the old send (HTTP 409).
   * Ambiguous network failures must retry the original outbox bytes instead. */
  repreparePending(
    clientId: string,
    peers: PeerBundle[]
  ): Promise<PreparedMessage> {
    return this.mutate(async (state) => {
      const prior = state.outbox.find(
        (item) => item.client_message_id === clientId
      )
      const archived = state.history.find(
        (item) =>
          item.client_message_id === clientId && item.status === "pending"
      )
      if (!prior || !archived)
        throw new Error("Only a rejected pending message can be prepared again")
      const prepared = await this.prepareState(state, {
        conversation_id: prior.conversation_id,
        client_message_id: crypto.randomUUID(),
        text: archived.text,
        peers,
      })
      state.outbox = state.outbox.filter(
        (item) => item.client_message_id !== clientId
      )
      state.history = state.history.filter((item) => item !== archived)
      return prepared
    })
  }

  private async prepareState(
    state: VaultState,
    input: {
      conversation_id: string
      client_message_id: string
      text: string
      peers: PeerBundle[]
    }
  ): Promise<PreparedMessage> {
    const ownId = state.device?.publicDeviceId
    if (!ownId)
      throw new Error("Register this browser's encryption identity first")
    validateMessageText(input.text)
    const archived = state.history.find(
      (item) =>
        item.client_message_id === input.client_message_id &&
        item.sender_device_id === ownId
    )
    if (
      archived &&
      (archived.conversation_id !== input.conversation_id ||
        archived.text !== input.text ||
        archived.sender_handle !== state.account)
    )
      throw new Error(
        "Client message ID was already used for different content"
      )
    const prior = state.outbox.find(
      (item) => item.client_message_id === input.client_message_id
    )
    if (prior) return prior
    if (archived && archived.status !== "pending")
      throw new Error("Only pending local messages can be prepared")
    if (
      !input.peers.length ||
      new Set(input.peers.map((peer) => peer.public_device_id)).size !==
        input.peers.length
    )
      throw new Error("Choose valid destination devices")
    const engine = new SignalEngine(state)
    try {
      await engine.hydrate()
      const prepared: PreparedMessage = {
        conversation_id: input.conversation_id,
        client_message_id: input.client_message_id,
        sender_device_id: ownId,
        envelopes: [],
      }
      for (const peer of input.peers) {
        const validated = await engine.validatePeer(peer)
        // Signed bundles establish first-use trust. Keep the identity pin for
        // future comparisons without claiming an out-of-band verification.
        state.peers[peer.public_device_id] = {
          bundle: structuredClone(validated),
          verified: state.peers[peer.public_device_id]?.verified ?? false,
        }
        const clear = JSON.stringify({
          version: 1,
          conversation_id: input.conversation_id,
          client_message_id: input.client_message_id,
          sender_device_id: ownId,
          recipient_device_id: peer.public_device_id,
          sender_handle: state.account,
          text: input.text,
        })
        const encrypted = await engine.encrypt(peer, clear)
        prepared.envelopes.push({
          recipient_device_id: peer.public_device_id,
          protocol_version: CHAT_PROTOCOL,
          ...encrypted,
        })
      }
      state.outbox.push(prepared)
      if (!archived)
        state.history.push({
          public_message_id: null,
          conversation_id: input.conversation_id,
          client_message_id: input.client_message_id,
          sender_device_id: ownId,
          sender_handle: state.account,
          text: input.text,
          created_at: new Date().toISOString(),
          status: "pending",
        })
      return prepared
    } finally {
      engine.close()
    }
  }

  receive(input: IncomingMessage): Promise<HistoryMessage> {
    return this.mutate(async (state) => {
      const existing = state.history.find(
        (item) => item.public_message_id === input.public_message_id
      )
      if (existing) {
        if (
          existing.conversation_id !== input.conversation_id ||
          existing.client_message_id !== input.client_message_id ||
          existing.sender_device_id !== input.sender.public_device_id
        )
          throw new Error("Conflicting encrypted delivery metadata")
        return existing
      }
      if (
        !state.device?.publicDeviceId ||
        input.recipient_device_id !== state.device.publicDeviceId
      )
        throw new Error("This encrypted envelope belongs to another device")
      if (!state.peers[input.sender.public_device_id])
        throw new Error(
          "Pin the sender's public identity before receiving messages"
        )
      const engine = new SignalEngine(state)
      try {
        await engine.hydrate()
        await engine.validatePeer(input.sender)
        const clear = JSON.parse(
          await engine.decrypt(
            input.sender,
            input.ciphertext,
            input.message_type
          )
        ) as Record<string, unknown>
        if (
          clear.version !== 1 ||
          clear.conversation_id !== input.conversation_id ||
          clear.client_message_id !== input.client_message_id ||
          clear.sender_device_id !== input.sender.public_device_id ||
          clear.recipient_device_id !== input.recipient_device_id ||
          clear.sender_handle !== input.sender.user_handle ||
          typeof clear.text !== "string"
        )
          throw new Error(
            "The encrypted message routing information does not match"
          )
        const history: HistoryMessage = {
          public_message_id: input.public_message_id,
          conversation_id: input.conversation_id,
          client_message_id: input.client_message_id,
          sender_device_id: input.sender.public_device_id,
          sender_handle: input.sender.user_handle,
          text: clear.text,
          created_at: input.created_at,
          status: "delivered",
        }
        state.history.push(history)
        return history
      } finally {
        engine.close()
      }
    })
  }

  history(conversationId: string): Promise<HistoryMessage[]> {
    return this.mutate(
      (state) =>
        state.history.filter((item) => item.conversation_id === conversationId),
      false
    )
  }
  outbox(): Promise<PreparedMessage[]> {
    return this.mutate((state) => state.outbox, false)
  }

  confirmSent(
    clientId: string,
    publicMessageId: string,
    createdAt: string
  ): Promise<void> {
    return this.mutate((state) => {
      const message = state.history.find(
        (item) =>
          item.client_message_id === clientId &&
          item.sender_handle === state.account
      )
      if (!message)
        throw new Error(
          "The sent message is missing from this browser's encrypted archive"
        )
      message.public_message_id = publicMessageId
      message.created_at = createdAt
      if (message.status === "pending") message.status = "sent"
      state.outbox = state.outbox.filter(
        (item) => item.client_message_id !== clientId
      )
    })
  }

  markReceipt(
    publicMessageId: string,
    status: "sent" | "delivered" | "read"
  ): Promise<void> {
    return this.mutate((state) => {
      const message = state.history.find(
        (item) => item.public_message_id === publicMessageId
      )
      const rank = { pending: 0, sent: 1, delivered: 2, read: 3 }
      if (message && rank[status] > rank[message.status])
        message.status = status
    })
  }

  close(): void {
    this.closed = true
    this.db.close()
  }
}
