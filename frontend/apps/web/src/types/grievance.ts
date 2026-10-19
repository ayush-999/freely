/** Grievance DTOs (mirrors backend/app/schemas/grievance.py). */

export type GrievanceStatus =
  | "submitted"
  | "acknowledged"
  | "under_review"
  | "assigned"
  | "in_progress"
  | "awaiting_citizen"
  | "resolved"
  | "closed"
  | "rejected"
  | "reopened"

export type Priority = "low" | "medium" | "high" | "critical"

export type LinkType = "discussion" | "official_update" | "evidence_context"

export interface AttachmentIn {
  file_name: string
  storage_key: string
  mime_type?: string
  file_size_bytes?: number
  checksum?: string
  is_evidence?: boolean
}

export interface GrievanceCreateRequest {
  category_id: number
  title: string
  description: string
  priority?: Priority
  is_anonymous?: boolean
  location_text?: string
  address?: string
  district?: string
  state?: string
  postal_code?: string
  latitude?: number
  longitude?: number
  attachments?: AttachmentIn[]
}

export interface Grievance {
  id: number
  tracking_number: string
  user_id: number
  category_id: number
  title: string
  description: string
  status: string
  priority: string
  is_anonymous: boolean
  district: string | null
  state: string | null
  submitted_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  closed_at: string | null
}

export interface GrievanceTrackingView {
  tracking_number: string
  title: string
  status: string
  priority: string
  district: string | null
  state: string | null
  submitted_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  closed_at: string | null
}

export interface StatusTransitionRequest {
  new_status: GrievanceStatus
  change_reason?: string
  is_public?: boolean
}

export interface GrievanceLinkRequest {
  post_id: number
  link_type?: LinkType
}

export interface CategoryCreateRequest {
  name: string
  code: string
  description?: string
  parent_category_id?: number
  default_department_id?: number
}

export interface Category {
  id: number
  name: string
  code: string
  description: string | null
  parent_category_id: number | null
  default_department_id: number | null
  is_active: boolean
}
