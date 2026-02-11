import { create } from 'zustand'
import { createCookieAuthApiClient, ApiError } from '@/lib/api-client'
import { getApiBaseUrl } from '@/config/env'
import {
  USER_ROUTES,
  type BackendUserProfile,
  type UpdateMePayload,
} from '@/features/users/services/user-service'
import { AUTH_ROUTES } from '@/features/auth/services/auth-service'
import axios from 'axios'

export interface UserState {
  user: BackendUserProfile | null
  loading: boolean
  error: string | null
  fetchCurrentUser: () => Promise<void>
  updateProfile: (payload: UpdateMePayload) => Promise<void>
  changePassword: (newPassword: string) => Promise<void>
  deleteAccount: () => Promise<void>
  invalidateUser: () => void
}

const baseURL = getApiBaseUrl()

let userClient: ReturnType<typeof createCookieAuthApiClient> | null = null

function getUserClient() {
  if (userClient) return userClient
  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })
  userClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {})
    },
  })
  return userClient
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  fetchCurrentUser: async () => {
    if (get().user !== null) return
    set({ loading: true, error: null })
    try {
      const client = getUserClient()
      const { data } = await client.get<{ data: BackendUserProfile }>(USER_ROUTES.me)
      set({ user: data.data, loading: false, error: null })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to load profile. Please try again.'
      set({ error: message, loading: false })
    }
  },

  updateProfile: async (payload: UpdateMePayload) => {
    set({ loading: true, error: null })
    try {
      const client = getUserClient()
      const { data } = await client.put<{ data: BackendUserProfile }>(USER_ROUTES.me, payload)
      set({ user: data.data, loading: false, error: null })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to update profile. Please try again.'
      set({ error: message, loading: false })
    }
  },

  changePassword: async (newPassword: string) => {
    set({ loading: true, error: null })
    try {
      const client = getUserClient()
      await client.post('/api/v1/authentication/reset-password', {
        newPassword,
        confirmPassword: newPassword,
      })
      set({ loading: false, error: null })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to change password. Please try again.'
      set({ error: message, loading: false })
      throw err
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null })
    try {
      const client = getUserClient()
      await client.delete(USER_ROUTES.me)
      const auth = (await import('@/store/auth-store')).useAuthStore.getState()
      await auth.signOut()
      set({ user: null, loading: false, error: null })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Failed to delete account. Please try again.'
      set({ error: message, loading: false })
      throw err
    }
  },

  invalidateUser: () => set({ user: null }),
}))
