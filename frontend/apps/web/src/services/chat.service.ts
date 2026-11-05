import { API_ENDPOINTS } from "@workspace/constants"
import type {
  DeviceMaterial,
  PreparedMessage,
  PublicPreKey,
} from "@/crypto/types"
import type {
  ChatConfig,
  ChatConversation,
  ChatDevice,
  ChatKeyBundle,
  MessageAccepted,
  MessagePage,
} from "@/types/chat"
import { api } from "./api"

const urls = API_ENDPOINTS.chat

export function createChatService(token?: string, signal?: AbortSignal) {
  const options = {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }
  return {
    async config() {
      return (await api.get<ChatConfig>(urls.config, options)).data
    },
    async conversations() {
      return (await api.get<ChatConversation[]>(urls.conversations, options))
        .data
    },
    async createConversation(recipient_handle: string) {
      return (
        await api.post<ChatConversation>(
          urls.conversations,
          { recipient_handle },
          options
        )
      ).data
    },
    async devices() {
      return (await api.get<ChatDevice[]>(urls.devices, options)).data
    },
    async registerDevice(material: DeviceMaterial) {
      const {
        signal_device_id,
        registration_id,
        protocol_version,
        identity_public_key,
        label,
      } = material
      return (
        await api.post<ChatDevice>(
          urls.devices,
          {
            signal_device_id,
            registration_id,
            protocol_version,
            identity_public_key,
            label,
          },
          options
        )
      ).data
    },
    async revokeDevice(id: string) {
      await api.post(urls.revoke(id), { public_device_id: id }, options)
    },
    async keys(handle: string) {
      return (await api.get<ChatKeyBundle[]>(urls.keys(handle), options)).data
    },
    async claim(handle: string, public_device_id: string) {
      return (
        await api.post<ChatKeyBundle[]>(
          urls.claim(handle),
          { public_device_id },
          options
        )
      ).data
    },
    async uploadKeys(public_device_id: string, prekeys: PublicPreKey[]) {
      for (let start = 0; start < prekeys.length; start += 100) {
        await api.post(
          urls.uploadKeys,
          { public_device_id, prekeys: prekeys.slice(start, start + 100) },
          options
        )
      }
    },
    async send(message: PreparedMessage): Promise<MessageAccepted> {
      return (
        await api.post<MessageAccepted>(
          urls.send,
          {
            public_conversation_id: message.conversation_id,
            public_device_id: message.sender_device_id,
            client_message_id: message.client_message_id,
            envelopes: message.envelopes.map(
              ({ recipient_device_id, message_type, ciphertext }) => ({
                recipient_device_id,
                message_type,
                ciphertext,
              })
            ),
          },
          options
        )
      ).data
    },
    async messages(id: string, deviceId: string, beforeId?: string) {
      return (
        await api.get<MessagePage>(urls.messages(id), {
          ...options,
          params: {
            public_device_id: deviceId,
            before_id: beforeId,
            limit: 50,
          },
        })
      ).data
    },
    async pending(deviceId: string, afterId?: string) {
      return (
        await api.get<MessagePage>(urls.pending(deviceId), {
          ...options,
          params: { limit: 100, after_id: afterId },
        })
      ).data
    },
    async receipt(
      messageId: string,
      public_device_id: string,
      status: "delivered" | "read"
    ) {
      await api.post(
        urls.receipt(messageId),
        { public_device_id, status },
        options
      )
    },
  }
}

export const chatService = createChatService()
