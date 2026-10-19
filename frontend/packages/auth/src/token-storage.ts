/** localStorage-backed access-token storage shared by every app. */

const ACCESS_TOKEN_KEY = "freely.access_token"

export const tokenStorage = {
  get(): string | null {
    try {
      return window.localStorage.getItem(ACCESS_TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token: string): void {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  },
  clear(): void {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
  },
} as const

export function getAuthorizationHeader(): `Bearer ${string}` | null {
  const token = tokenStorage.get()
  return token ? `Bearer ${token}` : null
}
