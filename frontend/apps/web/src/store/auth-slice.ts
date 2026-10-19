import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"

import { tokenStorage } from "@workspace/auth"
import { getApiErrorMessage } from "@workspace/utils"

import { identityService } from "@/services/identity.service"
import type { UserMe, UserUpdateRequest } from "@/types"

export type AuthStatus =
  "idle" | "loading" | "authenticated" | "unauthenticated"

export interface AuthState {
  user: UserMe | null
  status: AuthStatus
  error: string | null
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
}

/** Log in via the OAuth2 password flow, then load the current user. */
export const login = createAsyncThunk<
  UserMe,
  { username: string; password: string },
  { rejectValue: string }
>("auth/login", async ({ username, password }, { rejectWithValue }) => {
  try {
    const token = await identityService.login(username, password)
    tokenStorage.set(token.access_token)
    return await identityService.getMe()
  } catch (error) {
    tokenStorage.clear()
    return rejectWithValue(getApiErrorMessage(error, "Login failed"))
  }
})

/** Restore the session from the stored token on app start. */
export const bootstrapSession = createAsyncThunk<
  UserMe,
  void,
  { rejectValue: string }
>("auth/bootstrap", async (_, { rejectWithValue }) => {
  if (!tokenStorage.get()) {
    return rejectWithValue("no-stored-token")
  }
  try {
    return await identityService.getMe()
  } catch {
    tokenStorage.clear()
    return rejectWithValue("session-expired")
  }
})

export const updateProfile = createAsyncThunk<
  UserMe,
  UserUpdateRequest,
  { rejectValue: string }
>("auth/update-profile", async (data, { rejectWithValue }) => {
  try {
    return await identityService.updateMe(data)
  } catch (error) {
    return rejectWithValue(
      getApiErrorMessage(error, "Could not update profile")
    )
  }
})

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      tokenStorage.clear()
      state.user = null
      state.status = "unauthenticated"
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading"
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = "authenticated"
      })
      .addCase(login.rejected, (state, action) => {
        state.user = null
        state.status = "unauthenticated"
        state.error = action.payload ?? "Login failed"
      })
      .addCase(bootstrapSession.pending, (state) => {
        if (state.status === "idle") {
          state.status = "loading"
        }
      })
      .addCase(bootstrapSession.fulfilled, (state, action) => {
        state.user = action.payload
        state.status = "authenticated"
      })
      .addCase(bootstrapSession.rejected, (state) => {
        state.user = null
        state.status = "unauthenticated"
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.error = action.payload ?? "Could not update profile"
      })
  },
})

export const { logout } = authSlice.actions
export const authReducer = authSlice.reducer
