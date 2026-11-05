import type { PeerBundle, PublicPreKey } from "@/crypto/types"

export interface ChatConfig {
  enabled: boolean
  protocol_version: string
  max_ciphertext_bytes: number
}

export interface ChatDevice extends Omit<PeerBundle, "prekeys"> {
  label: string | null
  created_at: string
  revoked_at: string | null
  available_ec_one_time?: number | null
  available_kem_one_time?: number | null
}

export interface ChatConversation {
  public_conversation_id: string
  peer: {
    user_handle: string
    full_name: string
    avatar_storage_key: string | null
  }
  created_at: string
  updated_at: string | null
}

export interface ChatKeyBundle {
  device: ChatDevice
  prekeys: PublicPreKey[]
}

export interface ServerMessage {
  public_message_id: string
  public_conversation_id: string
  client_message_id: string
  sender_handle: string
  sender_device: ChatDevice
  created_at: string
  status: "sent" | "delivered" | "read"
  ciphertext: string | null
  message_type: 2 | 3 | null
  recipient_device_id: string | null
}

export interface MessagePage {
  items: ServerMessage[]
  next_before_id: string | null
  next_after_id?: string | null
}
export interface MessageAccepted {
  public_message_id: string
  client_message_id: string
  created_at: string
  duplicate: boolean
}

export interface ChatEvent {
  type: string
  data?: Record<string, unknown>
}

export function peerBundle(bundle: ChatKeyBundle): PeerBundle {
  return { ...bundle.device, prekeys: bundle.prekeys }
}
