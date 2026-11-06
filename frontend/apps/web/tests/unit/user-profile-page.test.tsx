import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { UserProfilePage } from "@/pages/users/user-profile-page"
import type { UserPublic } from "@/types"

const mocked = vi.hoisted(() => ({
  getPublicProfile: vi.fn(),
  user: null as { user_handle: string } | null,
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: mocked.user, isAuthenticated: !!mocked.user }),
}))
vi.mock("@/services/identity.service", () => ({
  identityService: { getPublicProfile: mocked.getPublicProfile },
}))
vi.mock("@/components/profile-posts", () => ({
  ProfilePosts: ({ handle }: { handle: string }) => (
    <div data-testid="profile-posts">Posts for {handle}</div>
  ),
}))
vi.mock("@/components/people/profile-network", () => ({
  ProfileNetwork: ({
    handle,
    actions,
  }: {
    handle: string
    actions?: boolean
  }) => (
    <div data-testid="profile-network" data-actions={!!actions}>
      Network for {handle}
    </div>
  ),
}))

const alice: UserPublic = {
  user_handle: "alice",
  full_name: "Alice Example",
  bio: "A public biography",
  avatar_storage_key: null,
  cover_storage_key: null,
  website_url: "https://example.com/alice",
  is_verified: true,
  created_at: "2026-10-01T00:00:00",
}
const bob: UserPublic = {
  ...alice,
  user_handle: "bob",
  full_name: "Bob Example",
  bio: "Bob's biography",
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

function renderProfile(handle = "alice") {
  return render(
    <MemoryRouter initialEntries={[`/u/${handle}`]}>
      <Link to="/u/bob">Go to Bob</Link>
      <Routes>
        <Route path="/u/:handle" element={<UserProfilePage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  mocked.user = { user_handle: "viewer" }
  mocked.getPublicProfile.mockReset()
})

describe("public profile integration", () => {
  it("renders the existing public fields, network controls and profile posts", async () => {
    mocked.getPublicProfile.mockResolvedValue(alice)
    renderProfile()
    expect(
      await screen.findByRole("heading", { name: "Alice Example" })
    ).toBeVisible()
    expect(screen.getByText("A public biography")).toBeVisible()
    expect(
      screen.getByRole("link", { name: /example.com\/alice/ })
    ).toHaveAttribute("href", "https://example.com/alice")
    expect(screen.getByTestId("profile-network")).toHaveAttribute(
      "data-actions",
      "true"
    )
    expect(screen.getByTestId("profile-posts")).toHaveTextContent(
      "Posts for alice"
    )
  })

  it("offers the existing edit route on your own public profile", async () => {
    mocked.user = { user_handle: "alice" }
    mocked.getPublicProfile.mockResolvedValue(alice)
    renderProfile()
    await screen.findByRole("heading", { name: "Alice Example" })
    expect(screen.getByRole("link", { name: /edit profile/i })).toHaveAttribute(
      "href",
      "/profile?edit=1"
    )
    expect(screen.getByTestId("profile-network")).toHaveAttribute(
      "data-actions",
      "false"
    )
  })

  it("hides the old profile while a different handle is loading", async () => {
    const pending = deferred<UserPublic>()
    mocked.getPublicProfile.mockImplementation((handle: string) =>
      handle === "alice" ? Promise.resolve(alice) : pending.promise
    )
    renderProfile()
    await screen.findByRole("heading", { name: "Alice Example" })
    await userEvent.click(screen.getByRole("link", { name: "Go to Bob" }))
    expect(
      screen.queryByRole("heading", { name: "Alice Example" })
    ).not.toBeInTheDocument()
    await act(async () => {
      pending.resolve(bob)
    })
    expect(
      await screen.findByRole("heading", { name: "Bob Example" })
    ).toBeVisible()
  })

  it("ignores a previous handle's response that arrives after navigation", async () => {
    const pending = deferred<UserPublic>()
    mocked.getPublicProfile.mockImplementation((handle: string) =>
      handle === "alice" ? pending.promise : Promise.resolve(bob)
    )
    renderProfile()
    await userEvent.click(screen.getByRole("link", { name: "Go to Bob" }))
    await screen.findByRole("heading", { name: "Bob Example" })
    await act(async () => {
      pending.resolve(alice)
    })
    expect(screen.getByRole("heading", { name: "Bob Example" })).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Alice Example" })
    ).not.toBeInTheDocument()
  })

  it("does not carry an earlier profile error into the next profile", async () => {
    mocked.getPublicProfile
      .mockRejectedValueOnce(new Error("Previous profile failed"))
      .mockResolvedValueOnce(bob)
    renderProfile()
    await screen.findByText(/previous profile failed/i)
    await userEvent.click(screen.getByRole("link", { name: "Go to Bob" }))
    expect(
      await screen.findByRole("heading", { name: "Bob Example" })
    ).toBeVisible()
    expect(
      screen.queryByText(/previous profile failed/i)
    ).not.toBeInTheDocument()
  })

  it("does not render an unsafe website scheme as a clickable link", async () => {
    mocked.getPublicProfile.mockResolvedValue({
      ...alice,
      website_url: "javascript:alert(1)",
    })
    renderProfile()
    await screen.findByRole("heading", { name: "Alice Example" })
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: /javascript:alert/ })
      ).not.toBeInTheDocument()
    )
  })
})
