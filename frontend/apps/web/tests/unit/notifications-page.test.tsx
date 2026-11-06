import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationsPage } from "@/pages/notifications/notifications-page"
import type { Notification } from "@/types"

const mocked = vi.hoisted(() => ({ listMine: vi.fn(), markRead: vi.fn() }))
vi.mock("@/services/notification.service", () => ({
  notificationService: mocked,
}))

const notice: Notification = {
  id: 1,
  grievance_id: 7,
  post_id: null,
  channel: "in_app",
  status: "sent",
  template_key: null,
  subject: "Grievance update",
  message: "Your grievance has been assigned.",
  sent_at: "2026-11-05T00:00:00",
  delivered_at: null,
  read_at: null,
  created_at: "2026-11-05T00:00:00",
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mocked.listMine.mockReset().mockResolvedValue([notice])
  mocked.markRead.mockReset()
})

describe("notification actions", () => {
  it("links existing grievance notifications to their authorized detail route", async () => {
    renderPage()
    expect(
      await screen.findByRole("link", { name: "View grievance" })
    ).toHaveAttribute("href", "/grievances/7")
    expect(screen.getByText(notice.message)).toBeVisible()
  })

  it("does not invent a public post route from a numeric notification post ID", async () => {
    mocked.listMine.mockResolvedValue([
      { ...notice, grievance_id: null, post_id: 123 },
    ])
    renderPage()
    await screen.findByText(notice.message)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("disables duplicate mark-read actions until the update is committed", async () => {
    const request = deferred<Notification>()
    mocked.markRead.mockReturnValue(request.promise)
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", { name: "Mark read" })
    )
    expect(screen.getByRole("button", { name: "Marking read…" })).toBeDisabled()
    expect(mocked.markRead).toHaveBeenCalledExactlyOnceWith(1)
    await act(async () => {
      request.resolve({ ...notice, read_at: "2026-11-05T01:00:00" })
    })
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /mark.*read/i })
      ).not.toBeInTheDocument()
    )
  })

  it("preserves unread state after a failed action and supports retry", async () => {
    mocked.markRead
      .mockRejectedValueOnce(new Error("Read update failed"))
      .mockResolvedValueOnce({ ...notice, read_at: "2026-11-05T01:00:00" })
    renderPage()
    await userEvent.click(
      await screen.findByRole("button", { name: "Mark read" })
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Read update failed"
    )
    await userEvent.click(screen.getByRole("button", { name: "Mark read" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Mark read" })
      ).not.toBeInTheDocument()
    )
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mocked.markRead).toHaveBeenCalledTimes(2)
  })

  it("retries a failed notification list without showing a false empty state", async () => {
    mocked.listMine
      .mockRejectedValueOnce(new Error("Notifications unavailable"))
      .mockResolvedValueOnce([notice])
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Notifications unavailable"
    )
    expect(
      screen.queryByText("You have no notifications.")
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText(notice.message)).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mocked.listMine).toHaveBeenCalledTimes(2)
  })
})
