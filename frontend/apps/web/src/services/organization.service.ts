import { API_ENDPOINTS } from "@workspace/constants"

import type {
  Department,
  DepartmentCreateRequest,
  DepartmentMembership,
  DepartmentMembershipUpdateRequest,
  MemberAddRequest,
  Membership,
  Organization,
  OrganizationCreateRequest,
  OrganizationUpdateRequest,
} from "@/types"

import { api } from "./api"

/** Mirrors organization_controller.py. */
export const organizationService = {
  async create(data: OrganizationCreateRequest): Promise<Organization> {
    const response = await api.post<Organization>(
      API_ENDPOINTS.organizations.create,
      data
    )
    return response.data
  },

  async getBySlug(slug: string): Promise<Organization> {
    const response = await api.get<Organization>(
      API_ENDPOINTS.organizations.bySlug(slug)
    )
    return response.data
  },

  async update(
    organizationId: number,
    data: OrganizationUpdateRequest
  ): Promise<Organization> {
    const response = await api.patch<Organization>(
      API_ENDPOINTS.organizations.update(organizationId),
      data
    )
    return response.data
  },

  async addDepartment(
    organizationId: number,
    data: DepartmentCreateRequest
  ): Promise<Department> {
    const response = await api.post<Department>(
      API_ENDPOINTS.organizations.departments(organizationId),
      data
    )
    return response.data
  },

  async addMember(
    organizationId: number,
    data: MemberAddRequest
  ): Promise<Membership> {
    const response = await api.post<Membership>(
      API_ENDPOINTS.organizations.members(organizationId),
      data
    )
    return response.data
  },

  async updateDepartmentMembership(
    membershipId: number,
    data: DepartmentMembershipUpdateRequest
  ): Promise<DepartmentMembership> {
    const response = await api.patch<DepartmentMembership>(
      API_ENDPOINTS.organizations.departmentMembership(membershipId),
      data
    )
    return response.data
  },
}
