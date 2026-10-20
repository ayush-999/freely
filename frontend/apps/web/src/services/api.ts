import { API_ENDPOINTS } from "@workspace/constants"
import axios from "axios"
import { toast } from "@workspace/ui/components/toast"

import { tokenStorage } from "@workspace/auth"
import { getApiErrorMessage } from "@workspace/utils"

import { config } from "@/config/config"

export const api = axios.create({
  baseURL: config.apiBaseUrl,
})

const mutationMethods = new Set(["post", "put", "patch", "delete"])

function isMutation(method: string | undefined): boolean {
  return method !== undefined && mutationMethods.has(method.toLowerCase())
}

function getSuccessDescription(data: unknown): string | undefined {
  if (
    data !== null &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return data.message
  }

  return undefined
}

// Attach the bearer token to every request when a session exists.
api.interceptors.request.use((requestConfig) => {
  const token = tokenStorage.get()
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`
  }
  return requestConfig
})

// On 401 the session is invalid/expired: drop it and send the user to login.
api.interceptors.response.use(
  (response) => {
    if (isMutation(response.config.method)) {
      const method = response.config.method?.toLowerCase()
      const url = response.config.url?.split("?")[0].replace(/\/$/, "")
      if (
        url === API_ENDPOINTS.identity.login ||
        url === API_ENDPOINTS.identity.register
      ) {
        return response
      }
      if (method && method !== "get") {
        const message =
          method === "post" && url === API_ENDPOINTS.identity.register
            ? "Account created successfully."
            : method === "patch" && url === API_ENDPOINTS.identity.me
              ? "Profile changes saved."
              : "Action completed"
        toast.add({
          title: message,
          description: getSuccessDescription(response.data),
          type: "success",
        })
      }
    }
    return response
  },
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      isMutation(error.config?.method) &&
      !axios.isCancel(error) &&
      error.response?.status !== 401
    ) {
      toast.add({
        title: "Action failed",
        description: getApiErrorMessage(error),
        type: "error",
      })
    }

    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      tokenStorage.get() &&
      !window.location.pathname.startsWith("/login")
    ) {
      tokenStorage.clear()
      window.location.assign("/login")
    }
    return Promise.reject(error)
  }
)
