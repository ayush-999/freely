import { login, logout, updateProfile } from "@/store/auth-slice"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import type { UserUpdateRequest } from "@/types"

/** Convenience wrapper around the auth slice. */
export function useAuth() {
  const dispatch = useAppDispatch()
  const { user, status, error } = useAppSelector((state) => state.auth)

  return {
    user,
    status,
    error,
    isAuthenticated: status === "authenticated",
    login: (username: string, password: string) =>
      dispatch(login({ username, password })).unwrap(),
    logout: () => dispatch(logout()),
    updateProfile: (data: UserUpdateRequest) =>
      dispatch(updateProfile(data)).unwrap(),
  }
}
