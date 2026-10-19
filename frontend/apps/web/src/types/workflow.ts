/**
 * Workflow DTOs — assignments, status history, responses
 * (mirrors backend/app/schemas/workflow.py).
 */

export type ResponseType =
  | "acknowledgement"
  | "clarification_request"
  | "progress_update"
  | "resolution"
  | "rejection"

export interface AssignmentCreateRequest {
  department_id: number
  assigned_to_user_id?: number
  assignment_reason?: string
}

export interface AssignmentTransferRequest {
  to_department_id: number
  assigned_to_user_id?: number
  assignment_reason?: string
}

export interface Assignment {
  id: number
  grievance_id: number
  department_id: number
  assigned_to_user_id: number | null
  assigned_by_user_id: number | null
  assignment_status: string
  assignment_reason: string | null
  assigned_at: string
  accepted_at: string | null
  completed_at: string | null
  transfer_from_assignment_id: number | null
}

export interface StatusHistoryEntry {
  id: number
  grievance_id: number
  previous_status: string | null
  new_status: string
  changed_by_user_id: number | null
  change_reason: string | null
  is_public: boolean
  created_at: string
}

export interface ResponseCreateRequest {
  response_type: ResponseType
  message: string
  assignment_id?: number
  is_public?: boolean
  is_final_response?: boolean
  related_post_id?: number
}

export interface GrievanceResponseDto {
  id: number
  grievance_id: number
  assignment_id: number | null
  user_id: number | null
  response_type: string
  message: string
  is_public: boolean
  is_final_response: boolean
  related_post_id: number | null
  created_at: string
}
