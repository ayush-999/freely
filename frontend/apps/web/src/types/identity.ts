/** Identity & platform-role DTOs (mirrors backend/app/schemas/identity.py). */

export type PlatformRoleName = "platform_admin" | "moderation_admin" | "auditor"

export interface UserRegisterRequest {
  user_handle: string
  full_name: string
  password: string
  email?: string
  phone?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface HandleAvailability {
  user_handle: string
  available: boolean
}

export interface UserPublic {
  user_handle: string
  full_name: string
  bio: string | null
  avatar_storage_key: string | null
  cover_storage_key: string | null
  website_url: string | null
  is_verified: boolean
  created_at: string
}

export interface UserMe extends UserPublic {
  id: number
  email: string | null
  phone: string | null
  preferred_language: string | null
}

export interface UserUpdateRequest {
  full_name?: string
  bio?: string
  avatar_storage_key?: string
  cover_storage_key?: string
  website_url?: string
  preferred_language?: string
}

export interface PlatformRoleGrantRequest {
  role_name: PlatformRoleName
}
