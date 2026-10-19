/** Extract a human-readable message from FastAPI / axios style errors. */

interface FastApiErrorShape {
  response?: {
    data?: {
      detail?: unknown
    }
  }
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong"
): string {
  if (typeof error === "object" && error !== null) {
    const detail = (error as FastApiErrorShape).response?.data?.detail
    if (typeof detail === "string" && detail.length > 0) {
      return detail
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown }
      if (first && typeof first.msg === "string" && first.msg.length > 0) {
        return first.msg
      }
    }
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }
  return fallback
}
