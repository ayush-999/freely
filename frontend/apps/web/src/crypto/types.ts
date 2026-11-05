export const CHAT_PROTOCOL = "signal-pqxdh-v1" as const

export type KeyKind =
  "ec_signed" | "ec_one_time" | "kem_one_time" | "kem_last_resort"

export interface PublicPreKey {
  key_kind: KeyKind
  key_id: number
  public_key: string
  signature?: string | null
  expires_at?: string | null
}

export interface PeerBundle {
  public_device_id: string
  user_handle: string
  signal_device_id: number
  registration_id: number
  protocol_version: string
  identity_public_key: string
  prekeys: PublicPreKey[]
}

export interface DeviceMaterial {
  public_device_id: string | null
  signal_device_id: number
  registration_id: number
  protocol_version: typeof CHAT_PROTOCOL
  identity_public_key: string
  label: string
  prekeys: PublicPreKey[]
}

export interface PeerTrust {
  public_device_id: string
  user_handle: string
  verified: boolean
  safety_number: string
}

export interface EncryptedEnvelope {
  recipient_device_id: string
  protocol_version: typeof CHAT_PROTOCOL
  message_type: number
  ciphertext: string
}

export interface PreparedMessage {
  conversation_id: string
  client_message_id: string
  sender_device_id: string
  envelopes: EncryptedEnvelope[]
}

export interface HistoryMessage {
  public_message_id: string | null
  conversation_id: string
  client_message_id: string
  sender_device_id: string
  sender_handle: string
  text: string
  created_at: string
  status: "pending" | "sent" | "delivered" | "read"
}

export interface IncomingMessage {
  public_message_id: string
  conversation_id: string
  client_message_id: string
  sender: PeerBundle
  recipient_device_id: string
  message_type: number
  ciphertext: string
  created_at: string
}

export interface DeviceSecrets {
  identity: string
  registrationId: number
  signalDeviceId: number
  publicDeviceId: string | null
  ecPrekeys: Record<string, string>
  signedPrekeys: Record<string, string>
  kemPrekeys: Record<string, string>
  kemOneTime: number[]
  kemUsage: string | null
  publicKeys: PublicPreKey[]
  nextKeyId: number
  rotatedAt: number
}

export interface StoredPeer {
  bundle: PeerBundle
  verified: boolean
}

export interface VaultState {
  version: 1
  account: string
  device: DeviceSecrets | null
  peers: Record<string, StoredPeer>
  sessions: Record<string, string>
  history: HistoryMessage[]
  outbox: PreparedMessage[]
}
