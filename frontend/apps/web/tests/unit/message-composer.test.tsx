import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageComposer } from "@/components/chat/message-composer"

describe("message composition", () => {
  it("sends Unicode text and clears only after the encrypted queue accepts it", async () => {
    const onSend = vi.fn().mockResolvedValue(true)
    const onTyping = vi.fn()
    render(<MessageComposer disabled={false} busy={false} onSend={onSend} onTyping={onTyping} />)
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello 👋 नमस्ते" } })
    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(onSend).toHaveBeenCalledWith("Hello 👋 नमस्ते")
    await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""))
    expect(onTyping).toHaveBeenCalledWith(true)
  })
  it("retains the draft when encryption or verification rejects sending", async () => {
    render(<MessageComposer disabled={false} busy={false} onSend={vi.fn().mockResolvedValue(false)} onTyping={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Keep this draft" } })
    await userEvent.click(screen.getByRole("button", { name: "Send" }))
    expect(screen.getByLabelText("Message")).toHaveValue("Keep this draft")
  })
  it("reuses the emoji picker and blocks sending before devices are verified", async () => {
    const view = render(<MessageComposer disabled={false} busy={false} onSend={vi.fn()} onTyping={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Add emoji" }))
    await userEvent.click(screen.getByRole("button", { name: "😀" }))
    expect(screen.getByLabelText("Message")).toHaveValue("😀")
    view.rerender(<MessageComposer disabled busy={false} onSend={vi.fn()} onTyping={vi.fn()} />)
    expect(screen.getByLabelText("Message")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })
  it("renders markup as text in the draft", () => {
    render(<MessageComposer disabled={false} busy={false} onSend={vi.fn()} onTyping={vi.fn()} />)
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: '<img src=x onerror="alert(1)">' } })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Message")).toHaveValue('<img src=x onerror="alert(1)">')
  })
})
