import { API_ENDPOINTS } from "@workspace/constants"

import type {
  HandleAvailability,
  PlatformRoleName,
  TokenResponse,
  UserMe,
  UserPublic,
  UserRegisterRequest,
  UserUpdateRequest,
} from "@/types"

import { api } from "./api"

/** Mirrors identity_controller.py (registration, login, profiles, roles). */
export const identityService = {
  async register(data: UserRegisterRequest): Promise<UserMe> {
    const response = await api.post<UserMe>(
      API_ENDPOINTS.identity.register,
      data
    )
    return response.data
  },

  /** OAuth2 password flow — the backend expects form-encoded fields. */
  async login(username: string, password: string): Promise<TokenResponse> {
    const body = new URLSearchParams({ username, password })
    const response = await api.post<TokenResponse>(
      API_ENDPOINTS.identity.login,
      body,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )
    return response.data
  },

  async getMe(): Promise<UserMe> {
    const response = await api.get<UserMe>(API_ENDPOINTS.identity.me)
    return response.data
  },

  async updateMe(data: UserUpdateRequest): Promise<UserMe> {
    const response = await api.patch<UserMe>(API_ENDPOINTS.identity.me, data)
    return response.data
  },

  async uploadAvatar(file: File): Promise<UserMe> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await api.post<UserMe>(
      API_ENDPOINTS.identity.avatar,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    )
    return response.data
  },

  async deleteAvatar(): Promise<UserMe> {
    const response = await api.delete<UserMe>(API_ENDPOINTS.identity.avatar)
    return response.data
  },

  async uploadCover(file: File): Promise<UserMe> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await api.post<UserMe>(
      API_ENDPOINTS.identity.cover,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    )
    return response.data
  },

  async deleteCover(): Promise<UserMe> {
    const response = await api.delete<UserMe>(API_ENDPOINTS.identity.cover)
    return response.data
  },

  async getPublicProfile(handle: string): Promise<UserPublic> {
    const response = await api.get<UserPublic>(
      API_ENDPOINTS.identity.publicProfile(handle)
    )
    return response.data
  },

  async searchUsers(q: string): Promise<UserPublic[]> {
    const response = await api.get<UserPublic[]>(
      API_ENDPOINTS.identity.searchUsers,
      { params: { q } }
    )
    return response.data
  },

  async checkHandleAvailability(handle: string): Promise<HandleAvailability> {
    const response = await api.get<HandleAvailability>(
      API_ENDPOINTS.identity.handleAvailability(handle)
    )
    return response.data
  },

  async grantPlatformRole(
    userId: number,
    roleName: PlatformRoleName
  ): Promise<string> {
    const response = await api.post<{ message: string }>(
      API_ENDPOINTS.identity.grantPlatformRole(userId),
      { role_name: roleName }
    )
    return response.data.message
  },
}
