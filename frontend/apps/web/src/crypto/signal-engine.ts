import init, * as signal from "@getmaapp/signal-wasm"
import wasmUrl from "@getmaapp/signal-wasm/signal_wasm_bg.wasm?url"

import { decode64, encode64, equalBytes } from "./encoding"
import { CHAT_PROTOCOL } from "./types"
import type {
  DeviceSecrets,
  PeerBundle,
  PublicPreKey,
  VaultState,
} from "./types"

let initialized: Promise<unknown> | undefined

export function initializeSignal(): Promise<unknown> {
  initialized ??= init({ module_or_path: wasmUrl })
  return initialized
}

function key(
  bundle: PeerBundle,
  kind: PublicPreKey["key_kind"]
): PublicPreKey | undefined {
  return bundle.prekeys
    .filter((value) => value.key_kind === kind)
    .sort((a, b) => b.key_id - a.key_id)[0]
}

/** Thin persistence adapter: all protocol operations and key validation are libsignal. */
export class SignalEngine {
  readonly state: VaultState
  private readonly objects: { free(): void }[] = []
  readonly pair: signal.WasmIdentityKeyPair
  readonly address: signal.WasmProtocolAddress
  readonly identities: signal.WasmInMemIdentityKeyStore
  readonly sessions: signal.WasmInMemSessionStore
  readonly prekeys: signal.WasmInMemPreKeyStore
  readonly signed: signal.WasmInMemSignedPreKeyStore
  readonly kem: signal.WasmInMemKyberPreKeyStore

  private keep<T extends { free(): void }>(value: T): T {
    this.objects.push(value)
    return value
  }

  constructor(state: VaultState) {
    this.state = state
    const device = state.device
    if (!device)
      throw new Error("Create this browser's encryption identity first")
    this.pair = this.keep(
      signal.WasmIdentityKeyPair.deserialize(decode64(device.identity))
    )
    this.address = this.keep(
      new signal.WasmProtocolAddress(state.account, device.signalDeviceId)
    )
    this.identities = this.keep(
      new signal.WasmInMemIdentityKeyStore(this.pair, device.registrationId)
    )
    this.sessions = this.keep(new signal.WasmInMemSessionStore())
    this.prekeys = this.keep(new signal.WasmInMemPreKeyStore())
    this.signed = this.keep(new signal.WasmInMemSignedPreKeyStore())
    this.kem = this.keep(new signal.WasmInMemKyberPreKeyStore())
  }

  peerAddress(peer: PeerBundle): signal.WasmProtocolAddress {
    return this.keep(
      new signal.WasmProtocolAddress(peer.user_handle, peer.signal_device_id)
    )
  }

  async hydrate(): Promise<void> {
    const device = this.state.device!
    for (const [id, record] of Object.entries(device.ecPrekeys))
      await this.prekeys.import_pre_key(Number(id), decode64(record))
    for (const [id, record] of Object.entries(device.signedPrekeys))
      await this.signed.import_signed_pre_key(Number(id), decode64(record))
    for (const [id, record] of Object.entries(device.kemPrekeys))
      await this.kem.import_kyber_pre_key(Number(id), decode64(record))
    if (device.kemUsage) this.kem.import_kyber_usage(decode64(device.kemUsage))
    // The bridge cannot import its identity map. Let libsignal validate each
    // persisted signed bundle and pin its identity in a disposable session store.
    // No generated session is transmitted, persisted, or used for real messages.
    for (const { bundle } of Object.values(this.state.peers)) {
      const temporary = new signal.WasmInMemSessionStore()
      try {
        await this.processBundle(bundle, temporary, false)
      } finally {
        temporary.free()
      }
    }
    for (const [peerId, record] of Object.entries(this.state.sessions)) {
      const peer = this.state.peers[peerId]?.bundle
      if (!peer) throw new Error("A saved session has no pinned identity")
      await this.sessions.import_session(
        this.peerAddress(peer),
        decode64(record)
      )
    }
  }

  async processBundle(
    bundle: PeerBundle,
    store = this.sessions,
    useOneTime = true
  ): Promise<void> {
    if (bundle.protocol_version !== CHAT_PROTOCOL)
      throw new Error("Unsupported encryption protocol")
    const ec = key(bundle, "ec_signed")
    const oneTime = useOneTime ? key(bundle, "ec_one_time") : undefined
    const kem = key(bundle, "kem_one_time") ?? key(bundle, "kem_last_resort")
    if (!ec?.signature || !kem?.signature)
      throw new Error("A valid signed EC and KEM bundle is required")
    await signal.processPreKeyBundle(
      this.peerAddress(bundle),
      this.address,
      bundle.registration_id,
      this.keep(
        signal.WasmPublicKey.deserialize(decode64(bundle.identity_public_key))
      ),
      ec.key_id,
      this.keep(signal.WasmPublicKey.deserialize(decode64(ec.public_key))),
      decode64(ec.signature),
      oneTime?.key_id,
      oneTime ? decode64(oneTime.public_key) : undefined,
      kem.key_id,
      decode64(kem.public_key),
      decode64(kem.signature),
      store,
      this.identities
    )
  }

  async validatePeer(bundle: PeerBundle): Promise<PeerBundle> {
    if (bundle.protocol_version !== CHAT_PROTOCOL)
      throw new Error("Unsupported encryption protocol")
    const previous = this.state.peers[bundle.public_device_id]
    if (
      previous &&
      (!equalBytes(
        previous.bundle.identity_public_key,
        bundle.identity_public_key
      ) ||
        previous.bundle.user_handle !== bundle.user_handle ||
        previous.bundle.signal_device_id !== bundle.signal_device_id ||
        previous.bundle.registration_id !== bundle.registration_id)
    ) {
      throw new Error(
        "This device's encryption identity changed unexpectedly. Delivery is paused for this device."
      )
    }
    const hasEc = key(bundle, "ec_signed")
    const hasKem = key(bundle, "kem_one_time") ?? key(bundle, "kem_last_resort")
    // An established ratchet does not need unexpired directory prekeys. Keep
    // its already pinned signed public bundle for local identity-map hydration
    // when an offline peer's published prekeys have expired. Never bootstrap a
    // new real session from this fallback, or hide invalid supplied signatures.
    const validated =
      (!hasEc || !hasKem) &&
      previous &&
      this.state.sessions[bundle.public_device_id]
        ? { ...bundle, prekeys: previous.bundle.prekeys }
        : bundle
    if (validated !== bundle) {
      const identity = this.keep(
        signal.WasmPublicKey.deserialize(decode64(bundle.identity_public_key))
      )
      for (const provided of bundle.prekeys) {
        if (provided.key_kind === "ec_one_time") continue
        if (
          !provided.signature ||
          !signal.verifyIdentitySignature(
            identity,
            decode64(provided.public_key),
            decode64(provided.signature)
          )
        )
          throw new Error("The directory contains an invalid signed public key")
      }
    }
    const temporary = new signal.WasmInMemSessionStore()
    try {
      await this.processBundle(validated, temporary, false)
    } finally {
      temporary.free()
    }
    return validated
  }

  fingerprint(peer: PeerBundle): { displayable: string; scannable: string } {
    const value = this.keep(
      signal.generateSafetyNumber(
        this.state.account,
        this.keep(this.pair.public_key),
        peer.user_handle,
        this.keep(
          signal.WasmPublicKey.deserialize(decode64(peer.identity_public_key))
        )
      )
    )
    return {
      displayable: value.displayable,
      scannable: encode64(value.scannable),
    }
  }

  identityPublicKey(): string {
    return encode64(this.keep(this.pair.public_key).serialize())
  }

  async encrypt(
    peer: PeerBundle,
    plaintext: string
  ): Promise<{ message_type: number; ciphertext: string }> {
    const address = this.peerAddress(peer)
    if (!(await this.sessions.has_session(address)))
      await this.processBundle(peer)
    const encrypted = this.keep(
      await signal.encryptMessage(
        new TextEncoder().encode(plaintext),
        address,
        this.address,
        this.sessions,
        this.identities
      )
    )
    const record = await this.sessions.export_session(address)
    if (!record)
      throw new Error("The updated encryption session could not be saved")
    this.state.sessions[peer.public_device_id] = encode64(record)
    return {
      message_type: encrypted.message_type,
      ciphertext: encode64(encrypted.body),
    }
  }

  async decrypt(
    peer: PeerBundle,
    ciphertext: string,
    type: number
  ): Promise<string> {
    if (![2, 3].includes(type) || ciphertext.length > 90_000)
      throw new Error("Invalid encrypted envelope")
    const address = this.peerAddress(peer)
    const result = this.keep(
      await signal.decryptMessage(
        decode64(ciphertext),
        type,
        address,
        this.address,
        this.sessions,
        this.identities,
        this.prekeys,
        this.signed,
        this.kem
      )
    )
    const device = this.state.device!
    if (result.oneTimePreKeyId !== undefined)
      delete device.ecPrekeys[result.oneTimePreKeyId]
    if (
      result.kyberPreKeyId !== undefined &&
      device.kemOneTime.includes(result.kyberPreKeyId)
    ) {
      delete device.kemPrekeys[result.kyberPreKeyId]
      device.kemOneTime = device.kemOneTime.filter(
        (id) => id !== result.kyberPreKeyId
      )
    }
    device.kemUsage = encode64(this.kem.export_kyber_usage())
    const record = await this.sessions.export_session(address)
    if (!record)
      throw new Error("The updated decryption session could not be saved")
    this.state.sessions[peer.public_device_id] = encode64(record)
    return new TextDecoder("utf-8", { fatal: true }).decode(result.plaintext)
  }

  close(): void {
    for (const object of this.objects.reverse()) object.free()
    this.objects.length = 0
  }
}

export async function createSecrets(
  signalDeviceId: number
): Promise<DeviceSecrets> {
  await initializeSignal()
  if (
    !Number.isInteger(signalDeviceId) ||
    signalDeviceId < 1 ||
    signalDeviceId > 127
  )
    throw new Error("Invalid device number")
  const privateKey = signal.WasmPrivateKey.generate()
  const publicKey = privateKey.getPublicKey()
  const pair = new signal.WasmIdentityKeyPair(publicKey, privateKey)
  try {
    return {
      identity: encode64(pair.serialize()),
      registrationId: signal.generateRegistrationId(),
      signalDeviceId,
      publicDeviceId: null,
      ecPrekeys: {},
      signedPrekeys: {},
      kemPrekeys: {},
      kemOneTime: [],
      kemUsage: null,
      publicKeys: [],
      nextKeyId: 1,
      rotatedAt: 0,
    }
  } finally {
    pair.free()
    publicKey.free()
    privateKey.free()
  }
}

export async function refreshKeys(
  state: VaultState,
  available?: { ec: number; kem: number }
): Promise<PublicPreKey[]> {
  const device = state.device!
  const engine = new SignalEngine(state)
  const added: PublicPreKey[] = []
  const nextId = () => {
    if (device.nextKeyId > 0x00ff_ffff)
      throw new Error(
        "Replace this device before its encryption key identifiers are exhausted"
      )
    return device.nextKeyId++
  }
  try {
    for (const value of device.publicKeys) {
      if (
        value.expires_at &&
        new Date(value.expires_at).getTime() < Date.now()
      ) {
        if (value.key_kind === "ec_signed")
          delete device.signedPrekeys[value.key_id]
        if (value.key_kind === "ec_one_time")
          delete device.ecPrekeys[value.key_id]
        if (
          value.key_kind === "kem_last_resort" ||
          value.key_kind === "kem_one_time"
        )
          delete device.kemPrekeys[value.key_id]
        device.kemOneTime = device.kemOneTime.filter(
          (id) => id !== value.key_id
        )
      }
    }
    if (
      Object.keys(device.ecPrekeys).length > 4096 ||
      Object.keys(device.kemPrekeys).length > 4096
    )
      throw new Error(
        "This device has too many pending session keys. Resolve pending deliveries before replenishing."
      )
    if (Date.now() - device.rotatedAt > 7 * 86_400_000) {
      const ec = await signal.generateSignedPreKey(
        nextId(),
        engine.pair,
        engine.signed
      )
      const kem = await signal.generateKyberPreKey(
        nextId(),
        engine.pair,
        engine.kem
      )
      const expires = new Date(Date.now() + 30 * 86_400_000).toISOString()
      device.signedPrekeys[ec.id] = encode64(ec.record)
      device.kemPrekeys[kem.id] = encode64(kem.record)
      added.push({
        key_kind: "ec_signed",
        key_id: ec.id,
        public_key: encode64(ec.public_key),
        signature: encode64(ec.signature),
        expires_at: expires,
      })
      added.push({
        key_kind: "kem_last_resort",
        key_id: kem.id,
        public_key: encode64(kem.public_key),
        signature: encode64(kem.signature),
        expires_at: expires,
      })
      ec.free()
      kem.free()
      device.rotatedAt = Date.now()
    }
    const needed = Math.max(
      0,
      20 - Math.max(0, available?.ec ?? Object.keys(device.ecPrekeys).length)
    )
    if (needed) {
      const start = device.nextKeyId
      for (let index = 0; index < needed; index++) nextId()
      for (const value of await signal.generatePreKeys(
        start,
        needed,
        engine.prekeys
      )) {
        device.ecPrekeys[value.id] = encode64(value.record)
        added.push({
          key_kind: "ec_one_time",
          key_id: value.id,
          public_key: encode64(value.public_key),
          expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        })
        value.free()
      }
    }
    for (
      let count = Math.max(
        0,
        available?.kem ??
          Object.keys(device.kemPrekeys).filter((id) =>
            device.kemOneTime.includes(Number(id))
          ).length
      );
      count < 5;
      count++
    ) {
      const value = await signal.generateKyberPreKey(
        nextId(),
        engine.pair,
        engine.kem
      )
      device.kemPrekeys[value.id] = encode64(value.record)
      device.kemOneTime.push(value.id)
      added.push({
        key_kind: "kem_one_time",
        key_id: value.id,
        public_key: encode64(value.public_key),
        signature: encode64(value.signature),
        expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      value.free()
    }
    // Retain rotated private prekeys only through the documented delayed-message
    // overlap. Consumed one-time keys are deleted during successful decrypt.
    for (const value of device.publicKeys) {
      if (
        value.expires_at &&
        new Date(value.expires_at).getTime() < Date.now()
      ) {
        if (value.key_kind === "ec_signed")
          delete device.signedPrekeys[value.key_id]
        if (value.key_kind === "kem_last_resort")
          delete device.kemPrekeys[value.key_id]
      }
    }
    device.publicKeys = [
      ...device.publicKeys.filter(
        (value) =>
          !value.expires_at ||
          new Date(value.expires_at).getTime() >= Date.now()
      ),
      ...added,
    ]
    return added
  } finally {
    engine.close()
  }
}
