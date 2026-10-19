/** Shared API helpers (mirrors backend/app/schemas/common.py). */

export interface MessageResponse {
  message: string
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/** Common pagination query params used by list endpoints. */
export interface ListParams {
  limit?: number
  offset?: number
}
