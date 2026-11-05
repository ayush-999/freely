import { API_ENDPOINTS } from "@workspace/constants"
import { tokenStorage } from "@workspace/auth"
import { config } from "@/config/config"
import type { ChatEvent } from "@/types/chat"

export type ConnectionState =
  "connecting" | "online" | "reconnecting" | "offline"

export function chatSocketUrl(
  base: string,
  location: Pick<Location, "href" | "protocol"> = window.location
): string {
  const url = new URL(
    `${base.replace(/\/$/, "")}${API_ENDPOINTS.chat.socket}`,
    location.href
  )
  if (location.protocol === "https:" && url.protocol !== "https:")
    throw new Error("Messaging requires a secure connection.")
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  url.search = ""
  url.hash = ""
  return url.href
}

/** JWTs travel only in the timed authentication frame, never in the URL. */
export class ChatRealtime {
  private socket: WebSocket | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = true
  private attempts = 0
  private credential = tokenStorage.get()
  private deviceId: string
  private onEvent: (event: ChatEvent) => void
  private onState: (state: ConnectionState) => void
  private socketFactory: (url: string) => WebSocket
  constructor(
    deviceId: string,
    onEvent: (event: ChatEvent) => void,
    onState: (state: ConnectionState) => void,
    socketFactory: (url: string) => WebSocket = (url) => new WebSocket(url)
  ) {
    this.deviceId = deviceId
    this.onEvent = onEvent
    this.onState = onState
    this.socketFactory = socketFactory
  }

  start() {
    this.stopped = false
    this.connect()
  }
  stop() {
    this.stopped = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
    this.socket?.close(1000)
    this.socket = null
  }
  send(type: string, data: Record<string, unknown>) {
    if (!this.stopped && this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify({ type, data }))
  }
  private connect() {
    if (this.stopped) return
    const token = this.credential
    if (!token || token !== tokenStorage.get()) {
      this.onState("offline")
      return
    }
    this.onState(this.attempts ? "reconnecting" : "connecting")
    let socket: WebSocket
    try {
      socket = this.socketFactory(chatSocketUrl(config.apiBaseUrl))
    } catch {
      this.onState("offline")
      return
    }
    this.socket = socket
    socket.onopen = () => {
      if (this.stopped || this.socket !== socket) {
        socket.close()
        return
      }
      socket.send(
        JSON.stringify({ type: "auth", token, public_device_id: this.deviceId })
      )
    }
    socket.onmessage = (event) => {
      if (
        this.stopped ||
        this.socket !== socket ||
        typeof event.data !== "string" ||
        event.data.length > 1500000
      )
        return
      let message: ChatEvent
      try {
        message = JSON.parse(event.data) as ChatEvent
      } catch {
        socket.close(1008)
        return
      }
      if (typeof message.type !== "string") return
      if (message.type === "auth.ok") {
        this.attempts = 0
        this.onState("online")
      }
      this.onEvent(message)
    }
    socket.onclose = (event) => {
      if (this.stopped || this.socket !== socket) return
      this.socket = null
      if (
        [1008, 4001, 4003, 4401, 4403].includes(event.code) ||
        !tokenStorage.get()
      ) {
        this.onState("offline")
        return
      }
      this.onState("reconnecting")
      const delay =
        Math.min(30000, 1000 * 2 ** Math.min(this.attempts++, 5)) +
        Math.random() * 500
      this.retryTimer = setTimeout(() => this.connect(), delay)
    }
    socket.onerror = () => socket.close()
  }
}
