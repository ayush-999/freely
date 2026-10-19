/**
 * Organization / department DTOs
 * (mirrors backend/app/schemas/organization.py).
 */

export type OrganizationType =
  | "school"
  | "university"
  | "private_organization"
  | "government_organization"
  | "ngo"
  | "other"

export type MembershipStatus = "active" | "invited" | "suspended" | "ended"

export interface OrganizationCreateRequest {
  name: string
  slug?: string
  organization_type: OrganizationType
  description?: string
  website_url?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
}

export interface OrganizationUpdateRequest {
  name?: string
  description?: string
  website_url?: string
  contact_email?: string
  contact_phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
}

export interface Organization {
  id: number
  name: string
  slug: string
  organization_type: string
  description: string | null
  website_url: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  verification_status: string
  is_active: boolean
  created_at: string
}

export interface DepartmentCreateRequest {
  name: string
  code: string
  description?: string
  parent_department_id?: number
  contact_email?: string
  contact_phone?: string
}

export interface Department {
  id: number
  organization_id: number
  parent_department_id: number | null
  name: string
  code: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface MemberAddRequest {
  user_id: number
  role_code: string
  is_primary?: boolean
  start_date?: string
}

export interface Membership {
  id: number
  organization_id: number
  user_id: number
  organization_role_id: number
  membership_status: string
  is_primary: boolean
  created_at: string
}

export interface DepartmentMembershipUpdateRequest {
  department_role_id?: number
  manager_user_id?: number
  membership_status?: MembershipStatus
  job_title?: string
}

export interface DepartmentMembership {
  id: number
  user_id: number
  department_id: number
  department_role_id: number
  manager_user_id: number | null
  job_title: string | null
  membership_status: string
  is_primary: boolean
  created_at: string
}
