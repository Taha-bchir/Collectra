import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import axios from 'axios'
import type { Profile } from '@/lib/db-types'
import { getAuthStorageKey, getApiBaseUrl } from '@/config/env'
import { createCookieAuthApiClient, ApiError } from '@/lib/api-client'
import type { AxiosInstance } from 'axios'
import {
  AUTH_ROUTES,
  normalizeProfile,
  type LoginPayload,
  type RegisterPayload,
  type RegisterResult,
  type LoginResponseData,
} from '@/features/auth/services/auth-service'
import { USER_ROUTES } from '@/features/users/services/user-service'

export interface AuthState {
  profile: Profile | null
  hasHydrated: boolean
  authLoading: boolean
  authError: string | null
  setSession: (session: { profile: Profile }) => void
  clearSession: () => void
  setHasHydrated: (value: boolean) => void
  /** Revalidate profile from server (GET /users/me). Role comes from JWT; keeps UI in sync with token. */
  revalidateSession: () => Promise<void>
  signIn: (payload: LoginPayload) => Promise<void>
  signUp: (payload: RegisterPayload) => Promise<RegisterResult>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (params: { newPassword: string; accessToken: string }) => Promise<void>
  getGoogleOAuthUrl: (redirectTo?: string) => Promise<string>
  handleGoogleCallback: (code: string, state?: string) => Promise<void>
  handleGoogleTokens: (accessToken: string, refreshToken?: string) => Promise<void>
}

const STORAGE_KEY = getAuthStorageKey()
const baseURL = getApiBaseUrl()

type PersistedAuthState = Pick<AuthState, 'profile'>

const storage =
  typeof window !== 'undefined'
    ? createJSONStorage<PersistedAuthState>(() => localStorage)
    : undefined

let authClient: AxiosInstance | null = null

function getAuthClient(): AxiosInstance {
  if (authClient) return authClient
  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })
  authClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {})
    },
  })
  return authClient
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => {
      const setAuthLoading = (loading: boolean) => set({ authLoading: loading })
      const setAuthError = (error: string | null) => set({ authError: error })
      const clearAuthError = () => set({ authError: null })

      return {
        profile: null,
        hasHydrated: false,
        authLoading: false,
        authError: null,
        setSession: ({ profile }) =>
          set({ profile, hasHydrated: true }),
        clearSession: () =>
          set({ profile: null, hasHydrated: true }),
        setHasHydrated: (value: boolean) => set({ hasHydrated: value }),

        revalidateSession: async () => {
          try {
            const client = getAuthClient()
            const { data } = await client.get<{ data: { id: string; email: string; profile: { fullName?: string | null } } }>(USER_ROUTES.me)
            const d = data.data
            set({
              profile: {
                id: d.id,
                email: d.email,
                fullName: d.profile?.fullName ?? null,
                emailConfirmed: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            })
          } catch {
            get().clearSession()
          }
        },

        signIn: async (payload: LoginPayload) => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const client = getAuthClient()
            const { data } = await client.post<{ data: LoginResponseData }>(AUTH_ROUTES.login, payload)
            const session = data.data
            const profile = normalizeProfile(session.user)
            set({
              profile,
              hasHydrated: true,
              authLoading: false,
              authError: null,
            })
            const workspaceStore = (await import('@/store/workspace-store')).useWorkspaceStore.getState()
            workspaceStore.invalidateWorkspace()
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Sign in failed. Please try again.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },

        signUp: async (payload: RegisterPayload): Promise<RegisterResult> => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const client = getAuthClient()
            const { data } = await client.post<{
              data: {
                id: string
                email: string
                profile: { fullName?: string | null }
                requiresEmailVerification: boolean
              }
            }>(AUTH_ROUTES.register, payload)
            const result = data.data
            if (!result.requiresEmailVerification) {
              set({
                profile: {
                  id: result.id,
                  email: result.email,
                  fullName: result.profile?.fullName ?? null,
                  emailConfirmed: true,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
                hasHydrated: true,
                authLoading: false,
                authError: null,
              })
              const workspaceStore = (await import('@/store/workspace-store')).useWorkspaceStore.getState()
              workspaceStore.invalidateWorkspace()
            } else {
              set({ authLoading: false, authError: null })
            }
            return {
              userId: result.id,
              email: result.email,
              requiresEmailVerification: result.requiresEmailVerification,
            }
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Registration failed. Please try again.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },

        signOut: async () => {
          try {
            const client = getAuthClient()
            await client.post(AUTH_ROUTES.logout, {})
          } finally {
            get().clearSession()
            const workspaceStore = (await import('@/store/workspace-store')).useWorkspaceStore.getState()
            workspaceStore.invalidateWorkspace()
            setAuthError(null)
          }
        },

        requestPasswordReset: async (email: string) => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const client = getAuthClient()
            await client.post(AUTH_ROUTES.forgotPassword, { email })
            set({ authLoading: false, authError: null })
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Request failed. Please try again.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },

        resetPassword: async ({ newPassword, accessToken }) => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const oneOff = axios.create({
              baseURL: baseURL.replace(/\/$/, ''),
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              withCredentials: true,
            })
            await oneOff.post(AUTH_ROUTES.resetPassword, {
              newPassword,
              confirmPassword: newPassword,
            })
            set({ authLoading: false, authError: null })
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Password reset failed. Please try again.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },

        getGoogleOAuthUrl: async (redirectTo?: string): Promise<string> => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const client = getAuthClient()
            const { data } = await client.post<{ data: { url: string } }>(AUTH_ROUTES.googleOAuthUrl, {
              redirectTo,
            })
            set({ authLoading: false, authError: null })
            return data.data.url
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Could not get Google sign-in URL.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },

        handleGoogleCallback: async (code: string, state?: string) => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const client = getAuthClient()
            const { data } = await client.post<{ data: LoginResponseData }>(
              AUTH_ROUTES.googleOAuthCallback,
              { code, state },
            )
            const session = data.data
            const profile = normalizeProfile(session.user)
            set({
              profile,
              hasHydrated: true,
              authLoading: false,
              authError: null,
            })
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },

        handleGoogleTokens: async (accessToken: string, refreshToken?: string) => {
          setAuthLoading(true)
          clearAuthError()
          try {
            const client = getAuthClient()
            const { data } = await client.post<{ data: LoginResponseData }>(
              AUTH_ROUTES.googleOAuthTokens,
              { accessToken, refreshToken },
            )
            const session = data.data
            const profile = normalizeProfile(session.user)
            set({
              profile,
              hasHydrated: true,
              authLoading: false,
              authError: null,
            })
          } catch (err) {
            const message =
              err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.'
            set({ authLoading: false, authError: message })
            throw err
          }
        },
      }
    },
    {
      name: STORAGE_KEY,
      storage,
      partialize: (state: AuthState): PersistedAuthState => ({
        profile: state.profile,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        if (state?.profile) state?.revalidateSession()
      },
    },
  ),
)
