/**
 * Notification, feedback and audit DTOs
 * (mirrors backend/app/schemas/notification.py).
 */

export type FeedbackType = "satisfaction" | "complaint_reopened" | "appeal"

export interface Notification {
  id: number
  grievance_id: number | null
  post_id: number | null
  channel: string
  status: string
  template_key: string | null
  subject: string | null
  message: string
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  created_at: string
}

export interface FeedbackCreateRequest {
  feedback_type: FeedbackType
  rating?: number
  comments?: string
  response_id?: number
}

export interface Feedback {
  id: number
  grievance_id: number
  user_id: number
  response_id: number | null
  feedback_type: string
  rating: number | null
  comments: string | null
  created_at: string
}

export interface AuditLog {
  id: number
  grievance_id: number | null
  actor_user_id: number | null
  action: string
  entity_type: string
  entity_id: number | null
  old_values: string | null
  new_values: string | null
  ip_address: string | null
  created_at: string
}
