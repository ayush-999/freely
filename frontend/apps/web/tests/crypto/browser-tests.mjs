import { chromium, firefox, webkit } from "@playwright/test"
import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"
import { resolve } from "node:path"

const base = process.env.CHAT_CRYPTO_TEST_URL || "http://127.0.0.1:4187"
const selected = process.env.CHAT_CRYPTO_BROWSER || "chromium"
const launcher = { chromium, firefox, webkit }[selected]
const browser = await launcher.launch(
  selected === "chromium"
    ? { channel: "chrome", headless: true }
    : { headless: true }
)
const context = await browser.newContext()
const page = await context.newPage()
page.on("pageerror", (error) => process.stderr.write(`${error.message}\n`))

try {
  await page.goto(`${base}/tests/crypto/harness.html`)
  await page.waitForFunction(() => window.harness)
  const vaultResults = await page.evaluate(async () => {
    const { ChatCrypto } = window.harness
    const suffix = String(Date.now())
    const ah = `alice_${suffix}`,
      bh = `bob_${suffix}`
    let a = await ChatCrypto.open(ah),
      b = await ChatCrypto.open(bh)
    await a.provision(1)
    await b.provision(1)
    await a.attachDevice("alice-browser")
    await b.attachDevice("bob-browser")
    const clientId = crypto.randomUUID(),
      text = "Hello 👋🏽 🧑‍💻 <script>text only</script>"
    const draft = {
      conversation_id: "conversation",
      client_message_id: clientId,
      text,
    }
    const [queued, repeatedQueue] = await Promise.all([
      a.queueMessage(draft),
      a.queueMessage(draft),
    ])
    if (
      queued.status !== "pending" ||
      queued.public_message_id !== null ||
      queued.created_at !== repeatedQueue.created_at ||
      (await a.history("conversation")).length !== 1 ||
      (await a.outbox()).length !== 0
    )
      throw Error("Queue did not preserve one local pending message")
    let conflictBlocked = false
    try {
      await a.queueMessage({ ...draft, text: "different content" })
    } catch {
      conflictBlocked = true
    }
    if (!conflictBlocked) throw Error("Queue allowed a conflicting message ID")
    a.close()
    a = await ChatCrypto.open(ah)
    const restoredQueue = await a.queuedMessages()
    if (
      restoredQueue.length !== 1 ||
      restoredQueue[0].text !== text ||
      restoredQueue[0].sender_device_id !== "alice-browser" ||
      restoredQueue[0].created_at !== queued.created_at
    )
      throw Error("Queued message did not survive reopening encrypted storage")
    const queuedRaw = await new Promise((resolve, reject) => {
      const opening = indexedDB.open(`freely-chat:${ah}`, 1)
      opening.onsuccess = () => {
        const db = opening.result
        const request = db
          .transaction("records")
          .objectStore("records")
          .get("state")
        request.onsuccess = () => {
          resolve(request.result)
          db.close()
        }
        request.onerror = () => reject(Error("Cannot read queued test storage"))
      }
    })
    if (JSON.stringify(queuedRaw).includes(text))
      throw Error("Queued plaintext persisted outside the sealed archive")
    const am = await a.getDevice(),
      bm = await b.getDevice()
    const ab = { ...am, user_handle: ah },
      bb = { ...bm, user_handle: bh }

    // A valid signed directory bundle is enough for first-use delivery. It
    // pins the identity, but must not masquerade as manual verification.
    let fresh = await ChatCrypto.open(`fresh_${suffix}`)
    await fresh.provision(1)
    await fresh.attachDevice("fresh-browser")
    const invalidFirstUse = structuredClone(bb)
    const signedFirstUse = invalidFirstUse.prekeys.find(
      (item) => item.key_kind === "ec_signed"
    )
    const invalidSignature = window.harness.decode64(signedFirstUse.signature)
    invalidSignature[0] ^= 1
    signedFirstUse.signature = window.harness.encode64(invalidSignature)
    let firstUseSignatureBlocked = false
    try {
      await fresh.prepareMessage({
        conversation_id: "first-use",
        client_message_id: crypto.randomUUID(),
        text: "must reject invalid first-use signatures",
        peers: [invalidFirstUse],
      })
    } catch {
      firstUseSignatureBlocked = true
    }
    if (
      !firstUseSignatureBlocked ||
      (await fresh.getPeer("bob-browser")) !== null ||
      (await fresh.outbox()).length
    )
      throw Error("Invalid first-use signature was accepted or persisted")
    await fresh.prepareMessage({
      conversation_id: "first-use",
      client_message_id: crypto.randomUUID(),
      text: "send directly without a manual step",
      peers: [bb],
    })
    if (
      (await fresh.listTrust())[0].verified ||
      (await fresh.getPeer("bob-browser")).identity_public_key !==
        bb.identity_public_key
    )
      throw Error(
        "Automatic first use lost the identity pin or claimed manual verification"
      )
    fresh.close()
    fresh = await ChatCrypto.open(`fresh_${suffix}`)
    await fresh.prepareMessage({
      conversation_id: "first-use",
      client_message_id: crypto.randomUUID(),
      text: "direct delivery after reloading an unverified pin",
      peers: [bb],
    })
    if (
      (await fresh.listTrust())[0].verified ||
      (await fresh.history("first-use")).length !== 2
    )
      throw Error("Unverified first-use identity could not send after reload")
    fresh.close()

    await a.acceptPeer(bb)
    await b.acceptPeer(ab)
    if ((await a.listTrust())[0].verified || (await b.listTrust())[0].verified)
      throw Error(
        "Accepting a directory bundle falsely marked manual verification"
      )
    // Legacy archives already have unverified pins and locally queued messages.
    // Reopening must resume them without resetting history or asking for codes.
    a.close()
    a = await ChatCrypto.open(ah)
    const af = await a.fingerprint("bob-browser"),
      bf = await b.fingerprint("alice-browser")
    if (af.displayable !== bf.displayable) throw Error("Safety numbers differ")
    const prepared = await a.prepareQueuedMessage(clientId, [bb])
    const preparedAgain = await a.prepareQueuedMessage(clientId, [bb])
    const retry = await a.prepareMessage({
      conversation_id: "conversation",
      client_message_id: clientId,
      text,
      peers: [bb],
    })
    if (JSON.stringify(prepared) !== JSON.stringify(retry))
      throw Error("Retry encrypted twice")
    if (
      JSON.stringify(prepared) !== JSON.stringify(preparedAgain) ||
      (await a.queuedMessages()).length !== 0 ||
      (await a.history("conversation")).length !== 1 ||
      (await a.history("conversation"))[0].created_at !== queued.created_at
    )
      throw Error("Queued preparation changed identity, timestamp or history")
    const envelope = {
      ...prepared.envelopes[0],
      public_message_id: "message",
      conversation_id: "conversation",
      client_message_id: clientId,
      sender: ab,
      created_at: new Date().toISOString(),
    }
    const received = await b.receive(envelope)
    if (received.text !== text)
      throw Error("Unicode or text rendering payload changed")
    await a.confirmSent(clientId, "message", envelope.created_at)
    a.close()
    b.close()
    a = await ChatCrypto.open(ah)
    b = await ChatCrypto.open(bh)
    if (
      (await a.listTrust())[0].verified ||
      (await b.listTrust())[0].verified ||
      (await a.getPeer("bob-browser")).identity_public_key !==
        bb.identity_public_key ||
      (await b.getPeer("alice-browser")).identity_public_key !==
        ab.identity_public_key
    )
      throw Error(
        "Automatic identity pins or manual verification state changed on reload"
      )
    if ((await b.history("conversation"))[0].text !== text)
      throw Error("Encrypted history did not survive reload")
    await b.receive(envelope)
    let replayBlocked = false
    try {
      await b.receive({ ...envelope, public_message_id: "replay" })
    } catch {
      replayBlocked = true
    }
    if (!replayBlocked) throw Error("Replayed ciphertext accepted after reload")
    const forged = await ChatCrypto.open(`forged_${suffix}`)
    await forged.provision(1)
    await forged.attachDevice("forged")
    const fm = await forged.getDevice()
    let identityBlocked = false
    try {
      await b.acceptPeer({
        ...ab,
        identity_public_key: fm.identity_public_key,
        prekeys: fm.prekeys,
      })
    } catch {
      identityBlocked = true
    }
    if (!identityBlocked) throw Error("Changed identity accepted after reload")
    const offlineBob = { ...bb, prekeys: [] }
    const offlineAlice = { ...ab, prekeys: [] }
    await a.acceptPeer(offlineBob)
    await b.acceptPeer(offlineAlice)
    if (!(await a.getPeer("bob-browser")).prekeys.length)
      throw Error("Expired directory erased locally pinned signed bundle")
    a.close()
    a = await ChatCrypto.open(ah)
    const offlineId = crypto.randomUUID()
    const offlineMessage = await a.prepareMessage({
      conversation_id: "conversation",
      client_message_id: offlineId,
      text: "existing session after directory expiry",
      peers: [offlineBob],
    })
    const offlineReceived = await b.receive({
      ...offlineMessage.envelopes[0],
      public_message_id: "offline-directory",
      conversation_id: "conversation",
      client_message_id: offlineId,
      sender: offlineAlice,
      created_at: new Date().toISOString(),
    })
    if (offlineReceived.text !== "existing session after directory expiry")
      throw Error(
        "Established session could not survive expired directory prekeys"
      )
    await forged.acceptPeer(bb)
    let newSessionBlocked = false
    try {
      await forged.acceptPeer(offlineBob)
    } catch {
      newSessionBlocked = true
    }
    if (!newSessionBlocked)
      throw Error("Expired cached prekeys were allowed for a new session")
    let changedEmptyDirectoryBlocked = false
    try {
      await a.acceptPeer({
        ...offlineBob,
        identity_public_key: fm.identity_public_key,
      })
    } catch {
      changedEmptyDirectoryBlocked = true
    }
    if (!changedEmptyDirectoryBlocked)
      throw Error("Empty directory bypassed changed-identity rejection")
    const partial = structuredClone(bb)
    partial.prekeys = partial.prekeys.filter(
      (item) => item.key_kind === "ec_signed"
    )
    const damagedPartialSignature = window.harness.decode64(
      partial.prekeys[0].signature
    )
    damagedPartialSignature[0] ^= 1
    partial.prekeys[0].signature = window.harness.encode64(
      damagedPartialSignature
    )
    let partialSignatureBlocked = false
    try {
      await a.acceptPeer(partial)
    } catch {
      partialSignatureBlocked = true
    }
    if (!partialSignatureBlocked)
      throw Error(
        "Cached fallback ignored an invalid partial directory signature"
      )
    const secondId = crypto.randomUUID()
    const second = await a.prepareMessage({
      conversation_id: "conversation",
      client_message_id: secondId,
      text: "bound routing",
      peers: [bb],
    })
    const secondEnvelope = {
      ...second.envelopes[0],
      public_message_id: "message2",
      conversation_id: "conversation",
      client_message_id: secondId,
      sender: ab,
      created_at: new Date().toISOString(),
    }
    let routingBlocked = false
    try {
      await b.receive({
        ...secondEnvelope,
        conversation_id: "attacker-conversation",
      })
    } catch {
      routingBlocked = true
    }
    if (!routingBlocked) throw Error("Server context substitution accepted")
    // A failed metadata check must not persist consumed ratchet state.
    if ((await b.receive(secondEnvelope)).text !== "bound routing")
      throw Error("Failed decrypt could not be retried safely")
    const failedId = crypto.randomUUID(),
      originalPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "state")
        throw new DOMException("Simulated full disk", "QuotaExceededError")
      return originalPut.call(this, value, key)
    }
    let failedSaveBlocked = false
    try {
      await a.prepareMessage({
        conversation_id: "conversation",
        client_message_id: failedId,
        text: "storage-safe",
        peers: [bb],
      })
    } catch {
      failedSaveBlocked = true
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }
    if (
      !failedSaveBlocked ||
      (await a.outbox()).some((item) => item.client_message_id === failedId)
    )
      throw Error("Failed durable write returned a sendable envelope")
    const recovered = await a.prepareMessage({
      conversation_id: "conversation",
      client_message_id: failedId,
      text: "storage-safe",
      peers: [bb],
    })
    const recoveredEnvelope = {
      ...recovered.envelopes[0],
      public_message_id: "recovered",
      conversation_id: "conversation",
      client_message_id: failedId,
      sender: ab,
      created_at: new Date().toISOString(),
    }
    if ((await b.receive(recoveredEnvelope)).text !== "storage-safe")
      throw Error("Storage failure corrupted ratchet")
    const replaced = await a.repreparePending(failedId, [bb])
    if (
      replaced.client_message_id === failedId ||
      (await a.history("conversation")).filter(
        (item) => item.text === "storage-safe"
      ).length !== 1
    )
      throw Error(
        "Explicit rejected-send replacement lost or duplicated local history"
      )
    const raw = await new Promise((resolve, reject) => {
      const opening = indexedDB.open(`freely-chat:${bh}`, 1)
      opening.onsuccess = () => {
        const db = opening.result
        const request = db
          .transaction("records")
          .objectStore("records")
          .get("state")
        request.onsuccess = () => {
          resolve(request.result)
          db.close()
        }
        request.onerror = () => reject(Error("Cannot read test storage"))
      }
    })
    if (
      JSON.stringify(raw).includes(text) ||
      JSON.stringify(raw).includes("identity")
    )
      throw Error("Plaintext vault persisted")
    await a.markReceipt("message", "read")
    await a.markReceipt("message", "delivered")
    if ((await a.history("conversation"))[0].status !== "read")
      throw Error("Receipt regressed")
    if ((await a.outbox()).some((item) => item.client_message_id === clientId))
      throw Error("Committed message still pending")
    a.close()
    b.close()
    forged.close()
    let closedBlocked = false
    try {
      await a.outbox()
    } catch {
      closedBlocked = true
    }
    if (!closedBlocked) throw Error("Closed account vault remained usable")
    return {
      unicode: true,
      automaticFirstUse: true,
      firstUseSignatureValidation: true,
      honestManualVerificationState: true,
      legacyUnverifiedReload: true,
      identityReload: true,
      replayReload: true,
      historyReload: true,
      encryptedStorage: true,
      encryptedQueueReload: true,
      queuedMessageIdempotency: true,
      queuedAutomaticPreparation: true,
      outboxIdempotency: true,
      metadataBindingAndRollback: true,
      storageFailureRollback: true,
      explicitRejectedSendReplacement: true,
      monotonicReceipts: true,
      accountClose: true,
      expiredDirectoryEstablishedSession: true,
      expiredDirectoryNewSessionBlocked: true,
    }
  })
  console.log(`${selected} encrypted vault:`, vaultResults)

  const ratchetResults = await page.evaluate(async () => {
    const h = window.harness
    const create = async (account, publicId) => {
      const state = {
        version: 1,
        account,
        device: await h.createSecrets(1),
        peers: {},
        sessions: {},
        history: [],
        outbox: [],
      }
      state.device.publicDeviceId = publicId
      await h.refreshKeys(state)
      const engine = new h.SignalEngine(state)
      try {
        return {
          state,
          bundle: {
            public_device_id: publicId,
            user_handle: account,
            signal_device_id: 1,
            registration_id: state.device.registrationId,
            protocol_version: "signal-pqxdh-v1",
            identity_public_key: engine.identityPublicKey(),
            prekeys: state.device.publicKeys,
          },
        }
      } finally {
        engine.close()
      }
    }
    const a = await create("ratchet_alice", "ratchet-a"),
      b = await create("ratchet_bob", "ratchet-b")
    a.state.peers[b.bundle.public_device_id] = {
      bundle: b.bundle,
      verified: true,
    }
    b.state.peers[a.bundle.public_device_id] = {
      bundle: a.bundle,
      verified: true,
    }
    const encrypt = async (sender, peer, text) => {
      const draft = structuredClone(sender.state),
        engine = new h.SignalEngine(draft)
      try {
        await engine.hydrate()
        const result = await engine.encrypt(peer.bundle, text)
        sender.state = draft
        return result
      } finally {
        engine.close()
      }
    }
    const decrypt = async (receiver, peer, message) => {
      const draft = structuredClone(receiver.state),
        engine = new h.SignalEngine(draft)
      try {
        await engine.hydrate()
        const text = await engine.decrypt(
          peer.bundle,
          message.ciphertext,
          message.message_type
        )
        receiver.state = draft
        return text
      } finally {
        engine.close()
      }
    }
    const messages = []
    for (let index = 0; index < 3; index++)
      messages.push(await encrypt(a, b, `out-of-order-${index}`))
    for (const index of [2, 0, 1])
      if ((await decrypt(b, a, messages[index])) !== `out-of-order-${index}`)
        throw Error("Out-of-order message failed")
    let oldRejected = false
    try {
      await decrypt(b, a, messages[0])
    } catch {
      oldRejected = true
    }
    if (!oldRejected)
      throw Error("Current ratchet state decrypted a consumed past message")
    await decrypt(a, b, await encrypt(b, a, "complete-session-establishment"))
    const message = await encrypt(a, b, "tamper-test"),
      damaged = h.decode64(message.ciphertext)
    damaged[damaged.length - 1] ^= 1
    let tamperRejected = false
    try {
      await decrypt(b, a, { ...message, ciphertext: h.encode64(damaged) })
    } catch {
      tamperRejected = true
    }
    if (!tamperRejected || (await decrypt(b, a, message)) !== "tamper-test")
      throw Error("Tamper rejection or rollback failed")
    const compromised = { state: structuredClone(b.state), bundle: b.bundle }
    await decrypt(a, b, await encrypt(b, a, "honest-ratchet-b0"))
    await decrypt(b, a, await encrypt(a, b, "honest-ratchet-a1"))
    await decrypt(a, b, await encrypt(b, a, "fresh-private-b1"))
    const recovered = await encrypt(a, b, "post-compromise-recovery")
    if ((await decrypt(b, a, recovered)) !== "post-compromise-recovery")
      throw Error("Honest receiver failed after ratchet")
    let compromiseRejected = false
    try {
      await decrypt(compromised, a, recovered)
    } catch {
      compromiseRejected = true
    }
    if (!compromiseRejected)
      throw Error(
        "Captured old session state decrypted after fresh honest ratchets"
      )
    const invalid = structuredClone(b.bundle),
      ec = invalid.prekeys.find((item) => item.key_kind === "ec_signed"),
      badSignature = h.decode64(ec.signature)
    badSignature[0] ^= 1
    ec.signature = h.encode64(badSignature)
    const engine = new h.SignalEngine(a.state)
    let signatureRejected = false
    try {
      await engine.hydrate()
      await engine.validatePeer(invalid)
    } catch {
      signatureRejected = true
    } finally {
      engine.close()
    }
    if (!signatureRejected) throw Error("Invalid signed prekey accepted")
    const previousSigned = b.state.device.publicKeys.find(
      (item) => item.key_kind === "ec_signed"
    ).key_id
    b.state.device.rotatedAt = Date.now() - 8 * 86_400_000
    const rotation = await h.refreshKeys(b.state, { ec: 0, kem: 0 })
    if (
      !rotation.some(
        (item) =>
          item.key_kind === "ec_signed" && item.key_id !== previousSigned
      ) ||
      rotation.filter((item) => item.key_kind === "ec_one_time").length !==
        20 ||
      rotation.filter((item) => item.key_kind === "kem_one_time").length !==
        5 ||
      !(previousSigned in b.state.device.signedPrekeys)
    )
      throw Error("Key rotation/replenishment overlap failed")
    return {
      outOfOrder: true,
      consumedPastKeysRejected: true,
      tamperAndRollback: true,
      signedPrekeyValidation: true,
      capturedSessionCannotDecryptAfterHonestRatchets: true,
      rotationAndClaimedPoolReplenishment: true,
    }
  })
  console.log(`${selected} protocol security:`, ratchetResults)

  // This peer is the official native libsignal build, not a second copy of the
  // browser wrapper. No application backend or SQL is involved.
  const nativePath =
    process.env.CHAT_NATIVE_MODULE ||
    resolve(
      "../../../.tools/chat-crypto/node_modules/@signalapp/libsignal-client/dist/index.js"
    )
  const native = await import(pathToFileURL(nativePath).href)
  const nativePair = native.IdentityKeyPair.generate()
  const ecPrivate = native.PrivateKey.generate(),
    signedPrivate = native.PrivateKey.generate(),
    kemPair = native.KEMKeyPair.generate()
  const ec = native.PreKeyRecord.new(1, ecPrivate.getPublicKey(), ecPrivate)
  const signed = native.SignedPreKeyRecord.new(
    2,
    Date.now(),
    signedPrivate.getPublicKey(),
    signedPrivate,
    nativePair.privateKey.sign(signedPrivate.getPublicKey().serialize())
  )
  const kem = native.KyberPreKeyRecord.new(
    3,
    Date.now(),
    kemPair,
    nativePair.privateKey.sign(kemPair.getPublicKey().serialize())
  )
  const sessions = new Map(),
    identities = new Map(),
    prekeys = new Map([[1, ec]])
  const sessionsStore = {
    saveSession: async (address, record) => {
      sessions.set(address.toString(), record)
    },
    getSession: async (address) => sessions.get(address.toString()) ?? null,
    getExistingSessions: async (addresses) =>
      addresses
        .map((address) => sessions.get(address.toString()))
        .filter(Boolean),
  }
  const identityStore = {
    getIdentityKeyPair: async () => nativePair,
    getIdentityKey: async () => nativePair.privateKey,
    getLocalRegistrationId: async () => 77,
    saveIdentity: async (address, key) => {
      identities.set(address.toString(), key)
      return native.IdentityChange.NewOrUnchanged
    },
    isTrustedIdentity: async (address, key) =>
      !identities.has(address.toString()) ||
      identities.get(address.toString()).equals(key),
    getIdentity: async (address) => identities.get(address.toString()) ?? null,
  }
  const prekeyStore = {
    savePreKey: async (id, record) => {
      prekeys.set(id, record)
    },
    getPreKey: async (id) => prekeys.get(id),
    removePreKey: async (id) => {
      prekeys.delete(id)
    },
  }
  const signedStore = {
    getSignedPreKey: async () => signed,
    saveSignedPreKey: async () => {},
  }
  const kemStore = {
    getKyberPreKey: async () => kem,
    saveKyberPreKey: async () => {},
    markKyberPreKeyUsed: async () => {},
  }
  const b64 = (bytes) => Buffer.from(bytes).toString("base64")
  const nativeBundle = {
    public_device_id: "native-bob",
    user_handle: "native_bob",
    signal_device_id: 1,
    registration_id: 77,
    protocol_version: "signal-pqxdh-v1",
    identity_public_key: b64(nativePair.publicKey.serialize()),
    prekeys: [
      {
        key_kind: "ec_one_time",
        key_id: 1,
        public_key: b64(ec.publicKey().serialize()),
      },
      {
        key_kind: "ec_signed",
        key_id: 2,
        public_key: b64(signed.publicKey().serialize()),
        signature: b64(signed.signature()),
      },
      {
        key_kind: "kem_last_resort",
        key_id: 3,
        public_key: b64(kem.publicKey().serialize()),
        signature: b64(kem.signature()),
      },
    ],
  }
  const browserInitial = await page.evaluate(async (bundle) => {
    const h = window.harness
    await h.initializeSignal()
    const state = {
      version: 1,
      account: "browser_alice",
      device: await h.createSecrets(1),
      peers: { [bundle.public_device_id]: { bundle, verified: true } },
      sessions: {},
      history: [],
      outbox: [],
    }
    await h.refreshKeys(state)
    const engine = new h.SignalEngine(state)
    try {
      await engine.hydrate()
      const encrypted = await engine.encrypt(
        bundle,
        "browser to official native 👋"
      )
      window.interop = { state, bundle }
      return { ...encrypted, identity: engine.identityPublicKey() }
    } finally {
      engine.close()
    }
  }, nativeBundle)
  const aliceAddress = native.ProtocolAddress.new("browser_alice", 1),
    bobAddress = native.ProtocolAddress.new("native_bob", 1)
  const nativeReceived = await native.signalDecryptPreKey(
    native.PreKeySignalMessage.deserialize(
      Buffer.from(browserInitial.ciphertext, "base64")
    ),
    aliceAddress,
    bobAddress,
    sessionsStore,
    identityStore,
    prekeyStore,
    signedStore,
    kemStore
  )
  assert.equal(
    new TextDecoder().decode(nativeReceived),
    "browser to official native 👋"
  )
  const nativeReply = await native.signalEncrypt(
    new TextEncoder().encode("official native to browser 🔐"),
    aliceAddress,
    bobAddress,
    sessionsStore,
    identityStore
  )
  const browserReceived = await page.evaluate(
    async ({ ciphertext, type }) => {
      const h = window.harness,
        { state, bundle } = window.interop,
        engine = new h.SignalEngine(state)
      try {
        await engine.hydrate()
        return await engine.decrypt(bundle, ciphertext, type)
      } finally {
        engine.close()
      }
    },
    { ciphertext: b64(nativeReply.serialize()), type: nativeReply.type() }
  )
  assert.equal(browserReceived, "official native to browser 🔐")
  console.log(
    `${selected} official native bidirectional interoperability: PASS`
  )
} finally {
  await context.close()
  await browser.close()
}
