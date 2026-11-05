import { chromium, expect } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"

// Every API and socket request is intercepted before navigation. This test
// exercises the real React UI and real browser crypto, without a backend/SQL.
const origin =
  process.env.CHAT_UI_TEST_URL ||
  process.env.CHAT_CRYPTO_TEST_URL ||
  "http://127.0.0.1:4187"
const browser = await chromium.launch({ channel: "chrome", headless: true })
const contexts = []
const cspViolations = []
const sockets = new Map(),
  devices = [],
  keys = new Map(),
  claims = new Set(),
  messages = [],
  requests = []
const handles = ["test_alice", "test_bob"]
let conversationExists = false
const users = Object.fromEntries(
  handles.map((handle, index) => [
    handle,
    {
      id: index + 1,
      user_handle: handle,
      full_name: index ? "Bob Test" : "Alice Test",
      bio: null,
      avatar_storage_key: null,
      cover_storage_key: null,
      website_url: null,
      is_verified: false,
      created_at: new Date().toISOString(),
      email: null,
      phone: null,
      preferred_language: null,
    },
  ])
)
const emit = (handle, type, data) => {
  for (const socket of sockets.get(handle) || [])
    socket.send(JSON.stringify({ type, data }))
}
const conversation = (handle) => ({
  public_conversation_id: "conversation-ui",
  peer: users[handles.find((item) => item !== handle)],
  created_at: new Date().toISOString(),
  updated_at: null,
})
const status = (message) =>
  message.envelopes.every((item) => item.read)
    ? "read"
    : message.envelopes.every((item) => item.delivered)
      ? "delivered"
      : "sent"
const view = (message, deviceId) => {
  const envelope = message.envelopes.find(
    (item) => item.recipient_device_id === deviceId
  )
  return {
    public_message_id: message.id,
    public_conversation_id: "conversation-ui",
    client_message_id: message.client_message_id,
    sender_handle: message.handle,
    sender_device: devices.find(
      (item) => item.public_device_id === message.public_device_id
    ),
    created_at: message.created_at,
    status: status(message),
    ciphertext: envelope?.ciphertext ?? null,
    message_type: envelope?.message_type ?? null,
    recipient_device_id: envelope?.recipient_device_id ?? null,
  }
}
const available = (deviceId, kind) =>
  [...(keys.get(deviceId)?.values() || [])].filter(
    (item) =>
      item.key_kind === kind &&
      !claims.has(`${deviceId}:${kind}:${item.key_id}`)
  ).length

async function client(handle) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  contexts.push(context)
  await context.exposeBinding("__chatTestReportCsp", (_, violation) =>
    cspViolations.push({ handle, ...violation })
  )
  await context.addInitScript((token) => {
    localStorage.setItem("freely.access_token", token)
    document.addEventListener("securitypolicyviolation", (event) => {
      void globalThis.__chatTestReportCsp({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
      })
    })
  }, handle)
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method(),
      path = url.pathname.replace(/^\/api(?:\/v1)?/, "")
    const auth = request.headers().authorization?.replace(/^Bearer /, "")
    if (auth && auth !== handle) throw Error("Cross-account authorization")
    const body = method === "GET" ? null : request.postDataJSON()
    requests.push({ handle, method, path, body })
    const reply = (data, code = 200) =>
      route.fulfill({
        status: code,
        contentType: "application/json",
        body: JSON.stringify(data),
      })
    if (path === "/users/me") return reply(users[handle])
    if (path === "/health") return reply({ status: "ok" })
    if (path === "/users/search")
      return reply(
        Object.values(users).filter((user) =>
          user.user_handle.includes(url.searchParams.get("q") || "")
        )
      )
    if (path === "/chat/config")
      return reply({
        enabled: true,
        protocol_version: "signal-pqxdh-v1",
        max_ciphertext_bytes: 65536,
      })
    if (path === "/chat/devices" && method === "GET")
      return reply(
        devices
          .filter((item) => item.user_handle === handle)
          .map((device) => ({
            ...device,
            available_ec_one_time: available(
              device.public_device_id,
              "ec_one_time"
            ),
            available_kem_one_time: available(
              device.public_device_id,
              "kem_one_time"
            ),
          }))
      )
    if (path === "/chat/devices" && method === "POST") {
      const existing = devices.find(
        (item) =>
          item.user_handle === handle &&
          item.signal_device_id === body.signal_device_id
      )
      if (existing) return reply(existing)
      const device = {
        ...body,
        public_device_id: `device-${handle}`,
        user_handle: handle,
        created_at: new Date().toISOString(),
        revoked_at: null,
      }
      devices.push(device)
      return reply(device, 201)
    }
    if (path === "/chat/keys/upload") {
      const store = keys.get(body.public_device_id) || new Map()
      for (const key of body.prekeys)
        store.set(`${key.key_kind}:${key.key_id}`, key)
      keys.set(body.public_device_id, store)
      return reply({ message: "Uploaded" })
    }
    const directory = path.match(/^\/chat\/keys\/([^/]+)(\/claim)?$/)
    if (directory) {
      const found = devices
        .filter((item) => item.user_handle === directory[1] && !item.revoked_at)
        .map((device) => {
          const published = [
            ...(keys.get(device.public_device_id)?.values() || []),
          ]
          const selected = []
          for (const kind of ["ec_signed", "kem_last_resort"]) {
            const value = published
              .filter((item) => item.key_kind === kind)
              .sort((a, b) => b.key_id - a.key_id)[0]
            if (value) selected.push(value)
          }
          if (directory[2])
            for (const kind of ["ec_one_time", "kem_one_time"]) {
              const value = published.find(
                (item) =>
                  item.key_kind === kind &&
                  !claims.has(
                    `${device.public_device_id}:${kind}:${item.key_id}`
                  )
              )
              if (value) {
                selected.push(value)
                claims.add(`${device.public_device_id}:${kind}:${value.key_id}`)
              }
            }
          return { device, prekeys: selected }
        })
      return reply(found)
    }
    if (path === "/chat/conversations") {
      if (method === "POST") conversationExists = true
      return reply(
        method === "POST"
          ? conversation(handle)
          : conversationExists
            ? [conversation(handle)]
            : []
      )
    }
    if (path === "/chat/messages" && method === "POST") {
      let message = messages.find(
        (item) =>
          item.client_message_id === body.client_message_id &&
          item.public_device_id === body.public_device_id
      )
      const duplicate = !!message
      if (!message) {
        message = {
          ...body,
          handle,
          id: `message-${messages.length + 1}`,
          created_at: new Date().toISOString(),
          envelopes: body.envelopes.map((item) => ({
            ...item,
            delivered: false,
            read: false,
          })),
        }
        messages.push(message)
        for (const peer of handles)
          emit(peer, "message.receive", {
            public_conversation_id: "conversation-ui",
            public_message_id: message.id,
          })
      }
      return reply({
        public_message_id: message.id,
        client_message_id: message.client_message_id,
        created_at: message.created_at,
        duplicate,
      })
    }
    const receipt = path.match(/^\/chat\/messages\/([^/]+)\/receipts$/)
    if (receipt) {
      const message = messages.find((item) => item.id === receipt[1]),
        envelope = message?.envelopes.find(
          (item) => item.recipient_device_id === body.public_device_id
        )
      if (!message || !envelope)
        return reply({ detail: "Unknown envelope" }, 404)
      envelope.delivered = true
      if (body.status === "read") envelope.read = true
      emit(message.handle, `message.${body.status}`, {
        public_message_id: message.id,
        public_conversation_id: "conversation-ui",
        user_handle: handle,
      })
      return reply({ message: "Acknowledged" })
    }
    const pending = path.match(/^\/chat\/devices\/([^/]+)\/pending$/)
    if (pending)
      return reply({
        items: messages
          .filter((message) =>
            message.envelopes.some(
              (item) =>
                item.recipient_device_id === pending[1] && !item.delivered
            )
          )
          .map((message) => view(message, pending[1])),
        next_before_id: null,
        next_after_id: null,
      })
    if (/^\/chat\/conversations\/[^/]+\/messages$/.test(path))
      return reply({
        items: [...messages]
          .reverse()
          .map((message) =>
            view(message, url.searchParams.get("public_device_id"))
          ),
        next_before_id: null,
      })
    // Unknown APIs remain intercepted; never fall through to a real backend.
    return reply({ detail: `Unmocked endpoint ${method} ${path}` }, 404)
  })
  await context.routeWebSocket("**/chat/ws", (socket) => {
    socket.onMessage((raw) => {
      const frame = JSON.parse(String(raw))
      if (frame.type === "auth") {
        assert.equal(frame.token, handle)
        assert.equal(new URL(socket.url()).search, "")
        const own = sockets.get(handle) || new Set()
        own.add(socket)
        sockets.set(handle, own)
        socket.onClose(() => own.delete(socket))
        socket.send(JSON.stringify({ type: "auth.ok", data: {} }))
      } else if (frame.type === "presence.subscribe") {
        for (const peer of handles)
          emit(peer, "user.online", {
            public_conversation_id: "conversation-ui",
            user_handle: handles.find((item) => item !== peer),
          })
      } else if (frame.type.startsWith("typing.")) {
        emit(
          handles.find((item) => item !== handle),
          frame.type,
          { ...frame.data, user_handle: handle }
        )
      }
    })
  })
  const page = await context.newPage()
  page.on("pageerror", (error) =>
    process.stderr.write(`UI ${handle}: ${error.message}\n`)
  )
  await page.goto(`${origin}/messages`)
  await expect(
    page.getByRole("heading", { name: "Messaging", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Connected", { exact: true })).toBeVisible()
  return page
}

try {
  const alice = await client("test_alice"),
    bob = await client("test_bob")
  await alice.getByLabel("Find people").fill("bob")
  await alice.getByRole("button", { name: /Bob Test/ }).click()
  await bob.reload()
  await bob.getByRole("button", { name: /Alice Test/ }).click()
  const aSafety = await alice
    .getByLabel("Safety number for test_bob")
    .innerText()
  const bSafety = await bob
    .getByLabel("Safety number for test_alice")
    .innerText()
  assert.equal(aSafety, bSafety)
  await expect(alice.getByLabel("Message", { exact: true })).toBeDisabled()
  await alice.getByLabel("Matching safety number").fill(bSafety)
  await alice
    .getByRole("button", { name: "Verify device", exact: true })
    .click()
  await bob.getByLabel("Matching safety number").fill(aSafety)
  await bob.getByRole("button", { name: "Verify device", exact: true }).click()
  await expect(alice.getByLabel("Message", { exact: true })).toBeEnabled()
  const text = "Private UI message 👋 <script>window.insecure=true</script>"
  await alice.getByLabel("Message", { exact: true }).fill(text)
  await alice.getByRole("button", { name: "Add emoji", exact: true }).click()
  await alice
    .getByRole("dialog", { name: "Emoji picker" })
    .getByRole("button")
    .first()
    .click()
  const fullText = await alice
    .getByLabel("Message", { exact: true })
    .inputValue()
  assert.ok(fullText.length > text.length)
  await alice.getByRole("button", { name: "Send", exact: true }).click()
  await expect(
    bob.getByRole("log").getByText(fullText, { exact: true })
  ).toBeVisible({ timeout: 15000 })
  assert.equal(await bob.evaluate(() => window.insecure), undefined)
  assert.equal(messages.length, 1)
  assert.ok(!JSON.stringify(messages).includes(text))
  assert.ok(
    !JSON.stringify(
      requests.filter((item) => item.path.startsWith("/chat"))
    ).includes(text)
  )
  await bob.bringToFront()
  await bob.getByRole("log").click()
  await expect(alice.getByLabel("read", { exact: true })).toBeVisible({
    timeout: 15000,
  })
  const bobSocket = [...sockets.get("test_bob")][0]
  bobSocket.close({ code: 1012, reason: "Test reconnect" })
  await expect(bob.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 15000,
  })
  await bob.reload()
  await bob.getByRole("button", { name: /Alice Test/ }).click()
  await expect(
    bob.getByRole("log").getByText(fullText, { exact: true })
  ).toBeVisible()
  await expect(bob.getByLabel("Message", { exact: true })).toBeEnabled()
  await bob
    .getByLabel("Message", { exact: true })
    .fill("Reply after reconnect 🔐")
  await bob.getByRole("button", { name: "Send", exact: true }).click()
  await expect(
    alice
      .getByRole("log")
      .getByText("Reply after reconnect 🔐", { exact: true })
  ).toBeVisible({ timeout: 15000 })
  await mkdir("../../../.tools/chat-ui", { recursive: true })
  await alice.screenshot({
    path: "../../../.tools/chat-ui/desktop.png",
    fullPage: true,
  })
  await bob.setViewportSize({ width: 390, height: 844 })
  await bob.screenshot({
    path: "../../../.tools/chat-ui/mobile.png",
    fullPage: true,
  })
  assert.equal(
    await bob.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false
  )
  assert.deepEqual(
    cspViolations,
    [],
    "The real chat flow must not violate the document CSP"
  )
  console.log(
    "Real React UI + real browser Signal + intercepted REST/WebSockets: PASS"
  )
  console.log(
    "Verified device matching, emoji composition, safe rendering, ciphertext-only relay, realtime reception, read receipt, reconnect/history persistence, responsive width."
  )
} finally {
  for (const context of contexts) await context.close()
  await browser.close()
}
