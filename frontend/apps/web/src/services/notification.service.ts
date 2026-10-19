import { API_ENDPOINTS } from "@workspace/constants"

import type {
  AuditLog,
  Feedback,
  FeedbackCreateRequest,
  ListParams,
  Notification,
} from "@/types"

import { api } from "./api"

export interface NotificationFilter extends ListParams {
  channel?: string
}

export interface AuditLogFilter extends ListParams {
  entity_type?: string
  entity_id?: number
  grievance_id?: number
}

/** Mirrors notification_controller.py (notifications, feedback, audit trail). */
export const notificationService = {
  async listMine(filter?: NotificationFilter): Promise<Notification[]> {
    const response = await api.get<Notification[]>(
      API_ENDPOINTS.notifications.list,
      { params: filter }
    )
    return response.data
  },

  async markRead(notificationId: number): Promise<Notification> {
    const response = await api.post<Notification>(
      API_ENDPOINTS.notifications.markRead(notificationId)
    )
    return response.data
  },

  async submitFeedback(
    grievanceId: number,
    data: FeedbackCreateRequest
  ): Promise<Feedback> {
    const response = await api.post<Feedback>(
      API_ENDPOINTS.notifications.feedback(grievanceId),
      data
    )
    return response.data
  },

  async searchAuditLogs(filter?: AuditLogFilter): Promise<AuditLog[]> {
    const response = await api.get<AuditLog[]>(
      API_ENDPOINTS.notifications.auditLogs,
      { params: filter }
    )
    return response.data
  },
}
