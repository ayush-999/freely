import { API_ENDPOINTS } from "@workspace/constants"

import type {
  AttachmentIn,
  Grievance,
  GrievanceCreateRequest,
  GrievanceLinkRequest,
  GrievanceTrackingView,
  ListParams,
  MessageResponse,
  StatusTransitionRequest,
} from "@/types"

import { api } from "./api"

export interface DepartmentQueueParams extends ListParams {
  status?: string
  priority?: string
}

/** Mirrors grievance_controller.py. */
export const grievanceService = {
  async submit(data: GrievanceCreateRequest): Promise<Grievance> {
    const response = await api.post<Grievance>(
      API_ENDPOINTS.grievances.submit,
      data
    )
    return response.data
  },

  /** Public tracking — safe fields only, no auth required. */
  async track(trackingNumber: string): Promise<GrievanceTrackingView> {
    const response = await api.get<GrievanceTrackingView>(
      API_ENDPOINTS.grievances.track(trackingNumber)
    )
    return response.data
  },

  async listMine(params?: ListParams): Promise<Grievance[]> {
    const response = await api.get<Grievance[]>(API_ENDPOINTS.grievances.mine, {
      params,
    })
    return response.data
  },

  async departmentQueue(
    departmentId: number,
    params?: DepartmentQueueParams
  ): Promise<Grievance[]> {
    const response = await api.get<Grievance[]>(
      API_ENDPOINTS.grievances.departmentQueue(departmentId),
      { params }
    )
    return response.data
  },

  async transitionStatus(
    grievanceId: number,
    data: StatusTransitionRequest
  ): Promise<Grievance> {
    const response = await api.post<Grievance>(
      API_ENDPOINTS.grievances.transitionStatus(grievanceId),
      data
    )
    return response.data
  },

  async addAttachment(
    grievanceId: number,
    data: AttachmentIn
  ): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.grievances.attachments(grievanceId),
      data
    )
    return response.data
  },

  async linkPost(
    grievanceId: number,
    data: GrievanceLinkRequest
  ): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(
      API_ENDPOINTS.grievances.links(grievanceId),
      data
    )
    return response.data
  },

  async unlinkPost(
    grievanceId: number,
    postId: number
  ): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(
      API_ENDPOINTS.grievances.unlink(grievanceId, postId)
    )
    return response.data
  },
}
