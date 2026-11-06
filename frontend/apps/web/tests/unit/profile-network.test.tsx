import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PersonRow } from "@/components/people/person-row"
import { ProfileNetwork } from "@/components/people/profile-network"
import { UserActions } from "@/components/people/user-actions"
import { useRelationship } from "@/hooks/use-relationship"
import type { PeoplePage, RelationshipSummary } from "@/types/relationship"

const mocked = vi.hoisted(() => ({
  user: { user_handle: "viewer" } as { user_handle: string } | null,
  summary: vi.fn(),
  people: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}))
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: mocked.user, isAuthenticated: !!mocked.user }),
}))
vi.mock("@/services/relationship.service", () => ({
  relationshipService: mocked,
}))

const summary: RelationshipSummary = {
  user_handle: "alice",
  followers_count: 2,
  following_count: 1,
  is_following: false,
  follows_you: true,
  is_self: false,
}
const alice = {
  user_handle: "alice",
  full_name: "Alice Example",
  bio: "Community member",
  avatar_storage_key: null,
  cover_storage_key: null,
  website_url: null,
  is_verified: true,
  created_at: "2026-10-01T00:00:00",
  is_following: false,
  follows_you: true,
  is_self: false,
}
const emptyPage: PeoplePage = { items: [], total: 0, limit: 20, offset: 0 }

function Location() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {JSON.stringify({
        pathname: location.pathname,
        search: location.search,
        state: location.state,
      })}
    </output>
  )
}
function renderUI(element: React.ReactNode) {
  return render(
    <MemoryRouter>
      {element}
      <Location />
    </MemoryRouter>
  )
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  mocked.user = { user_handle: "viewer" }
  mocked.summary.mockReset().mockResolvedValue(summary)
  mocked.people.mockReset().mockResolvedValue(emptyPage)
  mocked.follow.mockReset()
  mocked.unfollow.mockReset()
  localStorage.clear()
})

describe("profile network controls", () => {
  it("opens both network lists, shows their empty states and restores focus on Escape", async () => {
    renderUI(<ProfileNetwork handle="alice" />)
    const followers = await screen.findByRole("button", { name: "2 Followers" })
    await waitFor(() => expect(followers).toBeEnabled())
    expect(screen.getByText("Follows you")).toBeVisible()
    await userEvent.click(followers)
    expect(await screen.findByText("No followers yet.")).toBeVisible()
    expect(mocked.people).toHaveBeenCalledWith(
      "alice",
      "followers",
      0,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(screen.getByRole("dialog", { name: "Followers" })).toBeVisible()
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(followers).toHaveFocus()
    await userEvent.click(screen.getByRole("button", { name: "1 Following" }))
    expect(await screen.findByText("Not following anyone yet.")).toBeVisible()
    expect(mocked.people).toHaveBeenLastCalledWith(
      "alice",
      "following",
      0,
      expect.any(Object)
    )
  })

  it("paginates people and keeps profile links separate from follow and message controls", async () => {
    mocked.people.mockImplementation(
      (_handle: string, _list: string, offset: number) =>
        Promise.resolve({
          items: offset ? [] : [alice],
          total: 21,
          limit: 20,
          offset,
        })
    )
    renderUI(<ProfileNetwork handle="alice" />)
    await userEvent.click(
      await screen.findByRole("button", { name: "2 Followers" })
    )
    const dialog = screen.getByRole("dialog")
    const profile = await within(dialog).findByRole("link", {
      name: /Alice Example/,
    })
    expect(profile).toHaveAttribute("href", "/u/alice")
    expect(profile.querySelector("button, a")).toBeNull()
    expect(
      within(dialog).getByRole("link", { name: "Message @alice" })
    ).toHaveAttribute("href", "/messages?to=alice")
    expect(
      within(dialog).getByRole("button", { name: "Previous" })
    ).toBeDisabled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Next" }))
    expect(
      await within(dialog).findByText("No more people on this page.")
    ).toBeVisible()
    expect(mocked.people).toHaveBeenLastCalledWith(
      "alice",
      "followers",
      20,
      expect.any(Object)
    )
    expect(within(dialog).getByRole("button", { name: "Next" })).toBeDisabled()
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Previous" })
    )
    expect(
      await within(dialog).findByRole("link", { name: /Alice Example/ })
    ).toBeVisible()
  })

  it("recovers from failed summary and people requests through Retry", async () => {
    mocked.summary.mockRejectedValueOnce(new Error("Network unavailable"))
    mocked.people.mockRejectedValueOnce(new Error("People unavailable"))
    renderUI(<ProfileNetwork handle="alice" />)
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Network unavailable"
    )
    expect(screen.getByRole("button", { name: "0 Followers" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    await userEvent.click(
      await screen.findByRole("button", { name: "2 Followers" })
    )
    const dialog = screen.getByRole("dialog")
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "People unavailable"
    )
    await userEvent.click(within(dialog).getByRole("button", { name: "Retry" }))
    expect(await within(dialog).findByText("No followers yet.")).toBeVisible()
  })
})

describe("follow and message actions", () => {
  it("prevents duplicate follows, updates Following and then unfollows", async () => {
    const pending = deferred<RelationshipSummary>()
    let following = false
    mocked.summary.mockImplementation(() =>
      Promise.resolve({
        ...summary,
        is_following: following,
        followers_count: following ? 3 : 2,
      })
    )
    mocked.follow.mockImplementation(() => pending.promise)
    mocked.unfollow.mockImplementation(() => {
      following = false
      return Promise.resolve(summary)
    })
    renderUI(
      <>
        <ProfileNetwork handle="alice" />
        <UserActions handle="alice" />
      </>
    )
    const follow = await screen.findByRole("button", { name: "Follow @alice" })
    await waitFor(() => expect(follow).toBeEnabled())
    await userEvent.dblClick(follow)
    expect(mocked.follow).toHaveBeenCalledTimes(1)
    expect(follow).toBeDisabled()
    await act(async () => {
      following = true
      pending.resolve({ ...summary, followers_count: 3, is_following: true })
    })
    const unfollow = await screen.findByRole("button", {
      name: "Unfollow @alice",
    })
    expect(unfollow).toHaveAttribute("aria-pressed", "true")
    expect(
      await screen.findByRole("button", { name: "3 Followers" })
    ).toBeEnabled()
    await userEvent.click(unfollow)
    expect(mocked.unfollow).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole("button", { name: "Follow @alice" })
    ).toHaveAttribute("aria-pressed", "false")
    expect(
      await screen.findByRole("button", { name: "2 Followers" })
    ).toBeEnabled()
  })

  it("retains the current relationship after a failed mutation and permits recovery", async () => {
    mocked.summary.mockResolvedValue({ ...summary, is_following: true })
    mocked.unfollow.mockRejectedValueOnce(new Error("Unfollow unavailable"))
    renderUI(<UserActions handle="alice" />)
    const unfollow = await screen.findByRole("button", {
      name: "Unfollow @alice",
    })
    await userEvent.click(unfollow)
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unfollow unavailable"
    )
    expect(unfollow).toHaveAttribute("aria-pressed", "true")
    expect(unfollow).toBeEnabled()
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("button", { name: "Unfollow @alice" })
    ).toBeEnabled()
    expect(
      screen.getByRole("link", { name: "Message @alice" })
    ).toHaveAttribute("href", "/messages?to=alice")
  })

  it.each([
    ["Follow @alice", "/u/alice"],
    ["Message @alice", "/messages?to=alice"],
  ])(
    "takes a guest through login and preserves the %s destination",
    async (label, destination) => {
      mocked.user = null
      renderUI(<UserActions handle="alice" />)
      const link = screen.getByRole("link", { name: label })
      expect(link).toHaveAttribute("href", "/login")
      await userEvent.click(link)
      expect(JSON.parse(screen.getByTestId("location").textContent!)).toEqual({
        pathname: "/login",
        search: "",
        state: { from: destination },
      })
      expect(mocked.follow).not.toHaveBeenCalled()
    }
  )

  it("hides follow and message controls for your own handle regardless of case", () => {
    mocked.user = { user_handle: "Alice" }
    renderUI(<PersonRow person={alice} />)
    expect(screen.getByRole("link", { name: /Alice Example/ })).toBeVisible()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /Message/ })
    ).not.toBeInTheDocument()
    expect(mocked.summary).not.toHaveBeenCalled()
  })
})

describe("relationship request scope", () => {
  it("ignores a stale response after the viewed handle changes", async () => {
    const pending = deferred<RelationshipSummary>()
    mocked.summary.mockImplementation((handle: string) =>
      handle === "alice"
        ? pending.promise
        : Promise.resolve({
            ...summary,
            user_handle: handle,
            followers_count: 9,
          })
    )
    const { result, rerender } = renderHook(
      ({ handle }) => useRelationship(handle),
      { initialProps: { handle: "alice" } }
    )
    const firstSignal = mocked.summary.mock.calls[0][1].signal as AbortSignal
    rerender({ handle: "bob" })
    expect(firstSignal.aborted).toBe(true)
    await waitFor(() => expect(result.current.summary?.user_handle).toBe("bob"))
    await act(async () => {
      pending.resolve(summary)
    })
    expect(result.current.summary?.followers_count).toBe(9)
    expect(result.current.summary?.user_handle).toBe("bob")
  })

  it("pins mutations to the viewer token and ignores completion after an account change", async () => {
    const pending = deferred<RelationshipSummary>()
    localStorage.setItem("freely.access_token", "viewer-token")
    mocked.follow.mockImplementation(() => pending.promise)
    const { result, rerender } = renderHook(() => useRelationship("alice"))
    await waitFor(() => expect(result.current.summary).not.toBeNull())
    act(() => {
      void result.current.toggle()
    })
    expect(mocked.follow).toHaveBeenCalledWith(
      "alice",
      expect.objectContaining({ token: "viewer-token" })
    )
    const mutationSignal = mocked.follow.mock.calls[0][1].signal as AbortSignal
    mocked.user = { user_handle: "other" }
    localStorage.setItem("freely.access_token", "other-token")
    mocked.summary.mockResolvedValue({ ...summary, followers_count: 8 })
    rerender()
    expect(mutationSignal.aborted).toBe(true)
    await waitFor(() => expect(result.current.summary?.followers_count).toBe(8))
    await act(async () => {
      pending.resolve({ ...summary, is_following: true })
    })
    expect(result.current.summary?.followers_count).toBe(8)
    expect(result.current.summary?.is_following).toBe(false)
    expect(result.current.busy).toBe(false)
  })
})
