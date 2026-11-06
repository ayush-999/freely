import { chromium, expect } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"

// Real production React UI, with every API/socket intercepted before navigation.
// This harness never calls a backend or executes SQL.
const origin = process.env.PROFILE_UI_TEST_URL || "http://127.0.0.1:4188"
const browser = await chromium.launch({ channel: "chrome", headless: true })
const context = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
})
const pageErrors = [],
  cspViolations = [],
  requests = [],
  unexpected = []
const users = Object.fromEntries(
  ["alice", "bob", "carol"].map((handle, index) => [
    handle,
    {
      user_handle: handle,
      full_name: ["Alice Test", "Bob Test", "Carol Test"][index],
      bio: "Building useful things with the Freely community.",
      avatar_storage_key: null,
      cover_storage_key: null,
      website_url: "https://example.com",
      is_verified: index === 1,
      created_at: "2026-01-01T00:00:00Z",
    },
  ])
)
let me = {
  ...users.alice,
  id: 1,
  email: "alice@example.com",
  phone: null,
  preferred_language: "en",
}
const edges = new Set(["bob:alice", "alice:carol", "carol:bob"])
const summary = (handle) => ({
  user_handle: handle,
  followers_count: [...edges].filter((edge) => edge.endsWith(`:${handle}`))
    .length,
  following_count: [...edges].filter((edge) => edge.startsWith(`${handle}:`))
    .length,
  is_following: edges.has(`alice:${handle}`),
  follows_you: edges.has(`${handle}:alice`),
  is_self: handle === "alice",
})

await context.exposeBinding("__profileTestCsp", (_, violation) =>
  cspViolations.push(violation)
)
await context.addInitScript(() => {
  localStorage.setItem("freely.access_token", "alice")
  document.addEventListener("securitypolicyviolation", (event) => {
    void globalThis.__profileTestCsp({
      directive: event.effectiveDirective,
      blocked: event.blockedURI,
    })
  })
})
await context.route("**/api/**", async (route) => {
  const request = route.request(),
    url = new URL(request.url()),
    method = request.method()
  const path = url.pathname.replace(/^\/api(?:\/v1)?/, "")
  const body =
    method === "GET" || !request.postData() ? null : request.postDataJSON()
  requests.push({ method, path, body })
  const reply = (data, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    })
  if (path === "/health") return reply({ status: "ok" })
  if (path === "/users/me") {
    if (method === "PATCH") {
      me = { ...me, ...body }
      users.alice = { ...users.alice, ...body }
    }
    return reply(me)
  }
  if (path === "/users/search") return reply([users.bob])
  if (path === "/jobs" || path === "/notifications") return reply([])
  if (path === "/chat/config")
    return reply({
      enabled: false,
      protocol_version: "signal-pqxdh-v1",
      max_ciphertext_bytes: 65536,
    })
  const mutation = path.match(/^\/users\/(\w+)\/relationships\/follow$/)
  if (mutation) {
    assert.ok(["PUT", "DELETE"].includes(method))
    if (method === "PUT") edges.add(`alice:${mutation[1]}`)
    else edges.delete(`alice:${mutation[1]}`)
    return reply(summary(mutation[1]))
  }
  const network = path.match(/^\/users\/(\w+)\/relationships$/)
  if (network) return reply(summary(network[1]))
  const people = path.match(/^\/users\/(\w+)\/(followers|following)$/)
  if (people) {
    const handles = [...edges]
      .filter((edge) =>
        people[2] === "followers"
          ? edge.endsWith(`:${people[1]}`)
          : edge.startsWith(`${people[1]}:`)
      )
      .map((edge) => edge.split(":")[people[2] === "followers" ? 0 : 1])
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 20)
    return reply({
      items: handles
        .slice(offset, offset + limit)
        .map((handle) => ({ ...users[handle], ...summary(handle) })),
      total: handles.length,
      offset,
      limit,
    })
  }
  if (/^\/users\/\w+\/posts$/.test(path)) return reply([])
  const profile = path.match(/^\/users\/(\w+)$/)
  if (profile && users[profile[1]]) return reply(users[profile[1]])
  unexpected.push(`${method} ${path}`)
  return reply({ detail: `Unmocked endpoint ${method} ${path}` }, 404)
})
await context.routeWebSocket("**/*", (socket) => socket.close())
const page = await context.newPage()
page.on("pageerror", (error) => pageErrors.push(error.message))
const noOverflow = async () =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth
    ),
    false
  )
const screenshot = async (name) => {
  await mkdir("../../../.tools/profile-ui", { recursive: true })
  await page.screenshot({
    path: `../../../.tools/profile-ui/${name}.png`,
    fullPage: true,
  })
}

try {
  await page.goto(`${origin}/profile`)
  await expect(
    page.getByRole("heading", { name: "Alice Test", exact: true })
  ).toBeVisible()
  const edit = page.getByRole("button", { name: "Edit profile", exact: true })
  const publicProfile = page.getByRole("link", { name: "View public profile" })
  assert.equal(
    await edit.evaluate((element) =>
      element.parentElement.contains(
        element.parentElement.querySelector('a[href="/u/alice"]')
      )
    ),
    true
  )
  await expect(publicProfile).toBeVisible()
  await expect(
    page.getByRole("button", { name: "1 Followers", exact: true })
  ).toBeEnabled()
  await edit.click()
  const editor = page.getByRole("dialog", { name: "Edit Profile Details" })
  await expect(editor).toBeVisible()
  assert.ok((await editor.boundingBox()).y > (await edit.boundingBox()).y)
  await expect(editor.getByLabel("Full name")).toBeFocused()
  await screenshot("own-profile-edit-desktop")
  await editor.getByLabel("Full name").fill("Alice Updated")
  await editor.getByLabel("Bio", { exact: true }).fill("")
  await editor.getByLabel("Website URL").fill("")
  await editor.getByLabel("Preferred language").fill("")
  await editor.getByRole("button", { name: "Save changes" }).click()
  await expect(editor).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Alice Updated", exact: true })
  ).toBeVisible()
  assert.deepEqual(
    requests.find((request) => request.method === "PATCH").body,
    {
      full_name: "Alice Updated",
      bio: null,
      website_url: null,
      preferred_language: null,
    }
  )
  await edit.click()
  await expect(editor.getByLabel("Full name")).toHaveValue("Alice Updated")
  await page.keyboard.press("Escape")
  await expect(editor).toHaveCount(0)
  await expect(edit).toBeFocused()
  await page.getByRole("button", { name: "1 Followers", exact: true }).click()
  const followers = page.getByRole("dialog", { name: "Followers", exact: true })
  await expect(followers.getByRole("link", { name: /Bob Test/ })).toBeVisible()
  await expect(
    followers.getByRole("button", { name: "Follow @bob", exact: true })
  ).toBeEnabled()
  await page.keyboard.press("Escape")
  await expect(followers).toHaveCount(0)
  await page.getByRole("button", { name: "1 Following", exact: true }).click()
  const following = page.getByRole("dialog", { name: "Following", exact: true })
  await expect(
    following.getByRole("link", { name: /Carol Test/ })
  ).toBeVisible()
  await expect(
    following.getByRole("button", { name: "Unfollow @carol", exact: true })
  ).toBeVisible()
  await following.getByRole("button", { name: "Close people list" }).click()

  await page.goto(`${origin}/u/bob`)
  await expect(
    page.getByRole("heading", { name: "Bob Test", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Follows you", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Follow @bob", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Unfollow @bob", exact: true })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByRole("button", { name: "2 Followers", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Unfollow @bob", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Follow @bob", exact: true })
  ).toHaveAttribute("aria-pressed", "false")
  await expect(
    page.getByRole("button", { name: "1 Followers", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Follow @bob", exact: true })
  ).toBeEnabled()
  await noOverflow()
  await screenshot("public-profile-desktop")
  await page.setViewportSize({ width: 390, height: 844 })
  await noOverflow()
  await screenshot("public-profile-mobile")
  await page.getByRole("button", { name: "1 Followers", exact: true }).click()
  await expect(followers).toBeVisible()
  await expect(
    followers.getByRole("link", { name: /Carol Test/ })
  ).toBeVisible()
  await expect(
    followers.getByRole("button", { name: "Unfollow @carol", exact: true })
  ).toBeEnabled()
  assert.ok(
    (await followers.getByRole("link", { name: /Carol Test/ }).boundingBox())
      .width > 200
  )
  await noOverflow()
  await screenshot("followers-mobile")
  await followers.getByRole("button", { name: "Close people list" }).click()
  const message = page.getByRole("link", { name: "Message @bob", exact: true })
  await expect(message).toHaveAttribute("href", "/messages?to=bob")
  await message.click()
  await expect(page).toHaveURL(`${origin}/messages?to=bob`)
  await expect(
    page.getByRole("heading", { name: "Messaging", exact: true })
  ).toBeVisible()

  await page.goto(`${origin}/search?tab=people`)
  await page.getByRole("textbox", { name: "Search", exact: true }).fill("bob")
  await expect(
    page.getByRole("button", { name: "Follow @bob", exact: true })
  ).toBeEnabled()
  await expect(
    page.getByRole("link", { name: "Message @bob", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Follow @bob", exact: true }).click()
  await expect(page).toHaveURL(`${origin}/search?tab=people`)
  await expect(
    page.getByRole("button", { name: "Unfollow @bob", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Unfollow @bob", exact: true })
  ).toBeEnabled()
  assert.ok(
    (await page.getByRole("link", { name: /Bob Test/ }).boundingBox()).width >
      250
  )
  await noOverflow()
  await screenshot("search-mobile")
  await page.goto(`${origin}/profile?edit=1`)
  await expect(editor).toBeVisible()
  await noOverflow()
  await screenshot("own-profile-edit-mobile")
  await editor.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page).toHaveURL(`${origin}/profile`)
  assert.deepEqual(unexpected, [])
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(cspViolations, [])
  console.log(
    "Profile UI PASS: edit/save/clear/cancel/focus, relationship counts/lists, follow/unfollow, message route, search actions, desktop/mobile width, production CSP. All APIs and sockets intercepted; no backend/SQL."
  )
} finally {
  await context.close()
  await browser.close()
}
