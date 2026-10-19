import { API_ENDPOINTS } from "@workspace/constants"

import type { Assessment, AssessmentReviewRequest } from "@/types"

import { api } from "./api"

/** Mirrors ai_controller.py (AI assessment + human review gate). */
export const aiService = {
  async triggerAssessment(grievanceId: number): Promise<Assessment> {
    const response = await api.post<Assessment>(
      API_ENDPOINTS.ai.trigger(grievanceId)
    )
    return response.data
  },

  async listForGrievance(grievanceId: number): Promise<Assessment[]> {
    const response = await api.get<Assessment[]>(
      API_ENDPOINTS.ai.forGrievance(grievanceId)
    )
    return response.data
  },

  async review(
    assessmentId: number,
    data: AssessmentReviewRequest
  ): Promise<Assessment> {
    const response = await api.post<Assessment>(
      API_ENDPOINTS.ai.review(assessmentId),
      data
    )
    return response.data
  },
}
