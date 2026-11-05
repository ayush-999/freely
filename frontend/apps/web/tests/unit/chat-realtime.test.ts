import { afterEach, describe, expect, it, vi } from "vitest"
import { tokenStorage } from "@workspace/auth"
import { ChatRealtime, chatSocketUrl } from "@/services/chat-realtime"

class FakeSocket {
  readyState = WebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
}

afterEach(() => { tokenStorage.clear(); vi.useRealTimers() })

describe("authenticated chat connection", () => {
  it("uses WSS and never puts reusable credentials into the URL", () => {
    expect(chatSocketUrl("/api/v1", { href: "https://freely.example/messages", protocol: "https:" })).toBe("wss://freely.example/api/v1/chat/ws")
    expect(() => chatSocketUrl("http://other.example/api/v1", { href: "https://freely.example/messages", protocol: "https:" })).toThrow("secure connection")
  })
  it("authenticates in the first frame, receives events, and reconnects after interruption", async () => {
    vi.useFakeTimers()
    tokenStorage.set("jwt-for-testing-only")
    const sockets: FakeSocket[] = []
    const factory = vi.fn(() => { const socket = new FakeSocket(); sockets.push(socket); return socket as unknown as WebSocket })
    const events = vi.fn()
    const state = vi.fn()
    const connection = new ChatRealtime("device-00000001", events, state, factory)
    connection.start()
    sockets[0].onopen?.()
    expect(JSON.parse(sockets[0].send.mock.calls[0][0])).toEqual({ type: "auth", token: "jwt-for-testing-only", public_device_id: "device-00000001" })
    expect(factory.mock.calls[0]).toHaveLength(1)
    sockets[0].onmessage?.({ data: JSON.stringify({ type: "auth.ok", data: {} }) })
    expect(state).toHaveBeenLastCalledWith("online")
    sockets[0].onmessage?.({ data: JSON.stringify({ type: "message.receive", data: { public_message_id: "message-123" } }) })
    expect(events).toHaveBeenLastCalledWith({ type: "message.receive", data: { public_message_id: "message-123" } })
    sockets[0].onclose?.({ code: 1006 })
    await vi.advanceTimersByTimeAsync(1600)
    expect(factory).toHaveBeenCalledTimes(2)
    connection.stop()
    sockets[1].onclose?.({ code: 1006 })
    await vi.advanceTimersByTimeAsync(60000)
    expect(factory).toHaveBeenCalledTimes(2)
  })
  it("does not reconnect rejected or revoked sessions", async () => {
    vi.useFakeTimers()
    tokenStorage.set("jwt-for-testing-only")
    const socket = new FakeSocket()
    const factory = vi.fn(() => socket as unknown as WebSocket)
    const state = vi.fn()
    const connection = new ChatRealtime("device-00000001", vi.fn(), state, factory)
    connection.start()
    socket.onclose?.({ code: 4403 })
    await vi.advanceTimersByTimeAsync(60000)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(state).toHaveBeenLastCalledWith("offline")
    connection.stop()
  })
})
