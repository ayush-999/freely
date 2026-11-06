import { chromium, expect } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"

// This run performs REAL HTTP and native browser WebSocket requests against
// tests/browser_relay.py. No request or socket interception is installed.
// The dedicated relay explicitly forbids every SQL connection.
const origin = process.env.CHAT_RELAY_UI_URL || "http://127.0.0.1:15173"
const relay = process.env.CHAT_REAL_RELAY_URL || "http://127.0.0.1:18081"
const hostname = new URL(relay).hostname
assert.ok(
  ["127.0.0.1", "localhost"].includes(hostname),
  "Test relay must be loopback"
)
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(origin).hostname),
  "Test UI must be loopback"
)
const initial = await fetch(`${relay}/__test__/state`).then((response) =>
  response.json()
)
assert.equal(initial.test_only, true, "Refusing to use a non-test backend")
assert.equal(initial.database_connection_attempts, 0)

const browser = await chromium.launch({ channel: "chrome", headless: true })
const contexts = []
const requests = []
const apiFailures = []
const pageErrors = []

async function client(handle) {
  const tokenResponse = await fetch(`${relay}/__test__/token/${handle}`)
  assert.equal(tokenResponse.status, 200)
  const token = (await tokenResponse.json()).access_token
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  contexts.push(context)
  await context.addInitScript((credential) => {
    localStorage.setItem("freely.access_token", credential)
    const NativeWebSocket = window.WebSocket
    window.__relayChatSockets = []
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args)
        if (String(args[0]).includes("/chat/ws"))
          window.__relayChatSockets.push(this)
      }
    }
  }, token)
  const page = await context.newPage()
  page.on("pageerror", (error) =>
    pageErrors.push(`${handle}: ${error.message}`)
  )
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/chat/"))
      requests.push({
        path: new URL(request.url()).pathname,
        body: request.postData(),
      })
  })
  page.on("response", async (response) => {
    if (
      new URL(response.url()).pathname.startsWith("/api/") &&
      response.status() >= 400
    )
      apiFailures.push(
        `${handle}: ${response.status()} ${new URL(response.url()).pathname} ${await response.text()}`
      )
  })
  await page.goto(`${origin}/messages`)
  await expect(
    page.getByRole("heading", { name: "Messaging", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 30000,
  })
  return page
}

try {
  const alice = await client("alice")
  const bob = await client("bob")
  await alice.getByLabel("Find people").fill("bob")
  await alice.getByRole("button", { name: /Bob/ }).click()
  await bob.reload()
  await expect(bob.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 30000,
  })
  await bob.getByRole("button", { name: /Alice/ }).click()
  await expect(alice.getByLabel("Message", { exact: true })).toBeEnabled()
  await expect(bob.getByLabel("Message", { exact: true })).toBeEnabled()
  for (const page of [alice, bob]) {
    await expect(page.getByLabel("Matching safety number")).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Verify device", exact: true })
    ).toHaveCount(0)
    await expect(page.getByText(/Verify.*devices?.*delivery/)).toHaveCount(0)
  }

  const text =
    "Real relay private message 👋 <script>window.relayInsecure=true</script>"
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
  ).toBeVisible({ timeout: 20000 })
  await expect(
    bob.getByLabel("1 messages received in this conversation")
  ).toBeVisible()
  await expect(bob.getByLabel("1 total messages received")).toBeVisible()
  assert.equal(await bob.evaluate(() => window.relayInsecure), undefined)
  assert.ok(
    !JSON.stringify(requests).includes(text),
    "Plaintext appeared in a chat HTTP request"
  )
  await bob.bringToFront()
  await bob.getByRole("log").click()
  await expect(alice.getByLabel("read", { exact: true })).toBeVisible({
    timeout: 20000,
  })
  await expect(
    bob.getByRole("link", { name: "Messaging", exact: true }).first()
  ).toBeVisible()

  await bob.evaluate(() => {
    for (const socket of window.__relayChatSockets) {
      if (socket.readyState === WebSocket.OPEN)
        socket.close(4000, "Isolated relay reconnect test")
    }
  })
  await expect(bob.getByText("Reconnecting…", { exact: true })).toBeVisible()
  await expect(bob.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 20000,
  })
  await bob.reload()
  await expect(bob.getByText("Connected", { exact: true })).toBeVisible({
    timeout: 30000,
  })
  await bob.getByRole("button", { name: /Alice/ }).click()
  await expect(
    bob.getByRole("log").getByText(fullText, { exact: true })
  ).toBeVisible()
  await expect(bob.getByLabel("Message", { exact: true })).toBeEnabled()
  const reply = "Reply through real FastAPI after reload 🔐"
  await bob.getByLabel("Message", { exact: true }).fill(reply)
  await bob.getByRole("button", { name: "Send", exact: true }).click()
  await expect(
    alice.getByRole("log").getByText(reply, { exact: true })
  ).toBeVisible({ timeout: 20000 })
  assert.ok(!JSON.stringify(requests).includes(reply))
  const state = await fetch(`${relay}/__test__/state`).then((response) =>
    response.json()
  )
  assert.equal(state.messages - initial.messages, 2)
  assert.equal(state.envelopes - initial.envelopes, 2)
  assert.equal(state.database_connection_attempts, 0)
  assert.deepEqual(apiFailures, [])
  assert.deepEqual(pageErrors, [])
  const socketURLs = await bob.evaluate(() =>
    window.__relayChatSockets.map((socket) => socket.url)
  )
  assert.ok(
    socketURLs.length > 0 &&
      socketURLs.every((url) => new URL(url).search === "")
  )
  await mkdir("../../../.tools/chat-ui-relay", { recursive: true })
  await alice.screenshot({
    path: "../../../.tools/chat-ui-relay/desktop.png",
    fullPage: true,
  })
  await bob.setViewportSize({ width: 390, height: 844 })
  assert.equal(
    await bob.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false
  )
  await bob.screenshot({
    path: "../../../.tools/chat-ui-relay/mobile.png",
    fullPage: true,
  })
  console.log(
    "Real React + browser Signal + FastAPI HTTP/native WebSockets: PASS"
  )
  console.log(
    "Verified automatic first-use encrypted delivery without verification controls, real DTO/key upload/claim, emoji, safe rendering, ciphertext-only requests, received counts, realtime receipt, reconnect and persisted history; zero database connections."
  )
} catch (error) {
  if (apiFailures.length) console.error("Relay API failures:", apiFailures)
  if (pageErrors.length) console.error("Browser failures:", pageErrors)
  throw error
} finally {
  for (const context of contexts) await context.close()
  await browser.close()
}
