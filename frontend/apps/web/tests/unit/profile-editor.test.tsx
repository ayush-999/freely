import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"

import { ProfileEditor } from "@/components/profile-editor"
import { ProfilePage } from "@/pages/profile/profile-page"
import type { UserMe } from "@/types/identity"

const mocked = vi.hoisted(() => ({
  user: null as UserMe | null,
  updateProfile: vi.fn(),
  setUser: vi.fn(),
}))
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => mocked }))
vi.mock("@/components/profile-posts", () => ({
  ProfilePosts: () => <div>Existing profile posts</div>,
}))
vi.mock("@/components/people/profile-network", () => ({
  ProfileNetwork: () => <div>Existing profile network</div>,
}))
vi.mock("@/services/identity.service", () => ({ identityService: {} }))

const user: UserMe = {
  id: 1,
  user_handle: "alice",
  full_name: "Alice Example",
  bio: "Original bio",
  website_url: "https://example.com",
  preferred_language: "en",
  avatar_storage_key: null,
  cover_storage_key: null,
  is_verified: true,
  created_at: "2026-10-01T12:00:00Z",
  email: "alice@example.com",
  phone: null,
}

beforeEach(() => {
  mocked.user = { ...user }
  mocked.updateProfile.mockReset()
  mocked.setUser.mockReset()
})

describe("profile editing", () => {
  it("opens the self-profile edit shortcut and removes only its query flag on close", async () => {
    function Location() {
      return (
        <output aria-label="Current location">{useLocation().search}</output>
      )
    }
    render(
      <MemoryRouter initialEntries={["/profile?edit=1&tab=posts"]}>
        <ProfilePage />
        <Location />
      </MemoryRouter>
    )
    expect(
      screen.getByRole("dialog", { name: "Edit Profile Details" })
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?tab=posts"
    )
  })

  it("opens the profile editor in a modal and restores focus on cancel", async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )
    const edit = screen.getByRole("button", { name: "Edit profile" })
    const publicLink = screen.getByRole("link", { name: "View public profile" })
    expect(edit.parentElement).toBe(publicLink.parentElement)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await userEvent.click(edit)
    expect(edit).toHaveAttribute("aria-expanded", "true")
    const panel = screen.getByRole("dialog", { name: "Edit Profile Details" })
    expect(panel).toHaveAttribute("aria-modal", "true")
    expect(panel.parentElement?.parentElement).toBe(document.body)
    expect(screen.getByText("Existing profile posts")).toBeInTheDocument()
    expect(screen.getByLabelText("Full name")).toHaveFocus()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(edit).toHaveFocus()
    expect(mocked.updateProfile).not.toHaveBeenCalled()
  })

  it("discards cancelled drafts and reopens with the latest account details", async () => {
    const view = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Unsaved draft" },
    })
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    mocked.user = { ...user, full_name: "Latest saved name" }
    view.rerender(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    )
    await userEvent.click(screen.getByRole("button", { name: "Edit profile" }))
    expect(screen.getByLabelText("Full name")).toHaveValue("Latest saved name")
  })

  it("clears optional values explicitly and closes after a successful save", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const close = vi.fn()
    render(<ProfileEditor user={user} onSave={save} onClose={close} />)
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "  Alice Updated  " },
    })
    for (const field of ["Bio", "Website URL", "Preferred language"])
      fireEvent.change(screen.getByLabelText(field), { target: { value: "" } })
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        full_name: "Alice Updated",
        bio: null,
        website_url: null,
        preferred_language: null,
      })
    )
    expect(close).toHaveBeenCalledOnce()
  })

  it("keeps draft changes visible when the existing update API fails", async () => {
    const save = vi
      .fn()
      .mockRejectedValue("The profile update could not be saved")
    const close = vi.fn()
    render(<ProfileEditor user={user} onSave={save} onClose={close} />)
    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "Keep this draft" },
    })
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The profile update could not be saved"
    )
    expect(screen.getByLabelText("Bio")).toHaveValue("Keep this draft")
    expect(close).not.toHaveBeenCalled()
  })

  it("rejects blank names and non-web URL schemes before sending", async () => {
    const save = vi.fn()
    render(<ProfileEditor user={user} onSave={save} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "   " },
    })
    fireEvent.change(screen.getByLabelText("Website URL"), {
      target: { value: "javascript:alert(1)" },
    })
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(await screen.findByText("Full name is required")).toBeInTheDocument()
    expect(
      screen.getByText("Enter a valid http or https website URL")
    ).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it("normalizes a bare website and prevents closing or duplicate saves while saving", async () => {
    let finish!: () => void
    const save = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
    const close = vi.fn()
    render(<ProfileEditor user={user} onSave={save} onClose={close} />)
    fireEvent.change(screen.getByLabelText("Website URL"), {
      target: { value: "example.org/about" },
    })
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ website_url: "https://example.org/about" })
    )
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
    await userEvent.keyboard("{Escape}")
    expect(close).not.toHaveBeenCalled()
    finish()
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
  })
})
