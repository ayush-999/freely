import axios from "axios"

import { tokenStorage } from "@workspace/auth"

import { config } from "@/config/config"

export const api = axios.create({
  baseURL: config.apiBaseUrl,
})

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
  (response) => response,
  (error: unknown) => {
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
