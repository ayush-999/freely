/** AI assessment DTOs (mirrors backend/app/schemas/ai.py). */

import type { Priority } from "./grievance"

export interface Assessment {
  id: number
  grievance_id: number
  model_name: string
  model_version: string | null
  predicted_category_id: number | null
  predicted_priority: string | null
  sentiment_label: string | null
  urgency_score: number | null
  confidence_score: number | null
  duplicate_of_grievance_id: number | null
  summary: string | null
  recommended_department_id: number | null
  recommendation_reason: string | null
  human_review_required: boolean
  reviewed_by_user_id: number | null
  reviewed_at: string | null
  created_at: string
}

export interface AssessmentReviewRequest {
  approved: boolean
  override_category_id?: number
  override_priority?: Priority
  override_department_id?: number
  review_note?: string
}
