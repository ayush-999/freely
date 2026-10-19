import { API_ENDPOINTS } from "@workspace/constants"

import type {
  Escalation,
  EscalationResolveRequest,
  ListParams,
  MessageResponse,
  SlaClock,
  SlaPolicy,
  SlaPolicyCreateRequest,
} from "@/types"

import { api } from "./api"

export interface SlaPolicyFilter {
  department_id?: number
  category_id?: number
}

export interface EscalationFilter extends ListParams {
  status?: string
  department_id?: number
}

/** Mirrors sla_controller.py (SLA clocks, policies, escalations). */
export const slaService = {
  async listPolicies(filter?: SlaPolicyFilter): Promise<SlaPolicy[]> {
    const response = await api.get<SlaPolicy[]>(API_ENDPOINTS.sla.policies, {
      params: filter,
    })
    return response.data
  },

  async createPolicy(data: SlaPolicyCreateRequest): Promise<SlaPolicy> {
    const response = await api.post<SlaPolicy>(API_ENDPOINTS.sla.policies, data)
    return response.data
  },

  async getClock(grievanceId: number): Promise<SlaClock> {
    const response = await api.get<SlaClock>(
      API_ENDPOINTS.sla.clock(grievanceId)
    )
    return response.data
  },

  async pauseClock(grievanceId: number): Promise<SlaClock> {
    const response = await api.post<SlaClock>(
      API_ENDPOINTS.sla.pause(grievanceId)
    )
    return response.data
  },

  async resumeClock(grievanceId: number): Promise<SlaClock> {
    const response = await api.post<SlaClock>(
      API_ENDPOINTS.sla.resume(grievanceId)
    )
    return response.data
  },

  async listEscalations(filter?: EscalationFilter): Promise<Escalation[]> {
    const response = await api.get<Escalation[]>(
      API_ENDPOINTS.sla.escalations,
      { params: filter }
    )
    return response.data
  },

  async acknowledgeEscalation(escalationId: number): Promise<Escalation> {
    const response = await api.post<Escalation>(
      API_ENDPOINTS.sla.acknowledge(escalationId)
    )
    return response.data
  },

  async resolveEscalation(
    escalationId: number,
    data: EscalationResolveRequest
  ): Promise<Escalation> {
    const response = await api.post<Escalation>(
      API_ENDPOINTS.sla.resolve(escalationId),
      data
    )
    return response.data
  },

  async dismissEscalation(
    escalationId: number,
    data: EscalationResolveRequest
  ): Promise<Escalation> {
    const response = await api.post<Escalation>(
      API_ENDPOINTS.sla.dismiss(escalationId),
      data
    )
    return response.data
  },

  /** Worker/manual trigger for the SLA breach scanner. */
  async scanBreaches(): Promise<MessageResponse> {
    const response = await api.post<MessageResponse>(API_ENDPOINTS.sla.scan)
    return response.data
  },
}
