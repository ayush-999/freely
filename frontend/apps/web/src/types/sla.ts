/** SLA & escalation DTOs (mirrors backend/app/schemas/sla.py). */

import type { Priority } from "./grievance"

export type EscalationLevel = "level_1" | "level_2" | "level_3"

export interface SlaPolicyCreateRequest {
  category_id?: number
  department_id?: number
  priority: Priority
  acknowledgement_minutes: number
  response_minutes: number
  resolution_minutes: number
  working_hours_only?: boolean
  escalation_after_minutes?: number
  effective_from: string
  effective_until?: string
}

export interface SlaPolicy {
  id: number
  category_id: number | null
  department_id: number | null
  priority: string
  acknowledgement_minutes: number
  response_minutes: number
  resolution_minutes: number
  working_hours_only: boolean
  escalation_after_minutes: number | null
  effective_from: string
  effective_until: string | null
  is_active: boolean
}

export interface SlaClock {
  id: number
  grievance_id: number
  sla_policy_id: number
  acknowledgement_due_at: string | null
  first_response_due_at: string | null
  resolution_due_at: string | null
  first_responded_at: string | null
  actual_resolved_at: string | null
  clock_status: string
  paused_at: string | null
  total_paused_minutes: number
  breached_at: string | null
  breach_reason: string | null
}

export interface Escalation {
  id: number
  grievance_id: number
  sla_id: number | null
  from_department_id: number | null
  to_department_id: number | null
  assigned_to_user_id: number | null
  level: string
  reason: string
  status: string
  triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  resolution_note: string | null
}

export interface EscalationResolveRequest {
  resolution_note?: string
}
