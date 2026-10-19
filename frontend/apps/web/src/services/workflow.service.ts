import { API_ENDPOINTS } from "@workspace/constants"

import type {
  Assignment,
  AssignmentCreateRequest,
  AssignmentTransferRequest,
  GrievanceResponseDto,
  ResponseCreateRequest,
  StatusHistoryEntry,
} from "@/types"

import { api } from "./api"

/** Mirrors workflow_controller.py (assignments, transfers, responses, history). */
export const workflowService = {
  async assign(
    grievanceId: number,
    data: AssignmentCreateRequest
  ): Promise<Assignment> {
    const response = await api.post<Assignment>(
      API_ENDPOINTS.workflow.assignments(grievanceId),
      data
    )
    return response.data
  },

  async listAssignments(grievanceId: number): Promise<Assignment[]> {
    const response = await api.get<Assignment[]>(
      API_ENDPOINTS.workflow.assignments(grievanceId)
    )
    return response.data
  },

  async accept(assignmentId: number): Promise<Assignment> {
    const response = await api.post<Assignment>(
      API_ENDPOINTS.workflow.accept(assignmentId)
    )
    return response.data
  },

  async transfer(
    assignmentId: number,
    data: AssignmentTransferRequest
  ): Promise<Assignment> {
    const response = await api.post<Assignment>(
      API_ENDPOINTS.workflow.transfer(assignmentId),
      data
    )
    return response.data
  },

  async addResponse(
    grievanceId: number,
    data: ResponseCreateRequest
  ): Promise<GrievanceResponseDto> {
    const response = await api.post<GrievanceResponseDto>(
      API_ENDPOINTS.workflow.responses(grievanceId),
      data
    )
    return response.data
  },

  async listResponses(grievanceId: number): Promise<GrievanceResponseDto[]> {
    const response = await api.get<GrievanceResponseDto[]>(
      API_ENDPOINTS.workflow.responses(grievanceId)
    )
    return response.data
  },

  async getHistory(grievanceId: number): Promise<StatusHistoryEntry[]> {
    const response = await api.get<StatusHistoryEntry[]>(
      API_ENDPOINTS.workflow.history(grievanceId)
    )
    return response.data
  },
}
