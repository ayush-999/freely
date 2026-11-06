import { API_ENDPOINTS } from "@workspace/constants"
import type {
  NetworkList,
  PeoplePage,
  RelationshipSummary,
} from "@/types/relationship"
import { api } from "./api"

export interface RelationshipRequest {
  signal?: AbortSignal
  token?: string | null
}
function options(request: RelationshipRequest = {}) {
  return {
    signal: request.signal,
    headers: request.token
      ? { Authorization: `Bearer ${request.token}` }
      : undefined,
  }
}

export const relationshipService = {
  async summary(handle: string, request?: RelationshipRequest) {
    return (
      await api.get<RelationshipSummary>(
        API_ENDPOINTS.identity.relationships(handle),
        options(request)
      )
    ).data
  },
  async people(
    handle: string,
    list: NetworkList,
    offset = 0,
    request?: RelationshipRequest
  ) {
    return (
      await api.get<PeoplePage>(API_ENDPOINTS.identity[list](handle), {
        ...options(request),
        params: { limit: 20, offset },
      })
    ).data
  },
  async follow(handle: string, request?: RelationshipRequest) {
    return (
      await api.put<RelationshipSummary>(
        API_ENDPOINTS.identity.followByHandle(handle),
        undefined,
        options(request)
      )
    ).data
  },
  async unfollow(handle: string, request?: RelationshipRequest) {
    return (
      await api.delete<RelationshipSummary>(
        API_ENDPOINTS.identity.followByHandle(handle),
        options(request)
      )
    ).data
  },
}
