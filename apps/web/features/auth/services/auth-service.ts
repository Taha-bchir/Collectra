import type { Profile, UserRole } from '@/lib/db-types'

/** Backend/API role (same as DB enum from @repo/types). */
export type BackendUserRole = UserRole

export const AUTH_ROUTES = {
  base: '/api/v1/authentication',
  login: '/api/v1/authentication/login',
  register: '/api/v1/authentication/register',
  forgotPassword: '/api/v1/authentication/forgot-password',
  refresh: '/api/v1/authentication/refresh',
  resetPassword: '/api/v1/authentication/reset-password',
  logout: '/api/v1/authentication/logout',
  googleOAuthUrl: '/api/v1/authentication/google/url',
  googleOAuthCallback: '/api/v1/authentication/google/callback',
  googleOAuthTokens: '/api/v1/authentication/google/tokens',
} as const

export const mapBackendRoleToFrontend = (role: BackendUserRole): UserRole => role

export const mapFrontendRoleToBackend = (role: UserRole): BackendUserRole => role

export interface AuthSession {
  accessToken: string
  refreshToken: string | null
  profile: Profile
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  fullName: string
  phone?: string
  streetAddress?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  role: UserRole
}

export interface RegisterResult {
  userId: string
  email: string
  role: UserRole
  requiresEmailVerification: boolean
}

export interface LoginResponseUser {
  id: string
  email: string
  role: BackendUserRole
  emailConfirmed?: boolean
  profile: { fullName?: string | null; phone?: string | null }
}

export interface LoginResponseData {
  accessToken: string
  refreshToken?: string | null
  user: LoginResponseUser
}

export interface RefreshResponseData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: LoginResponseUser
}

export function normalizeProfile(payload: LoginResponseUser): Profile {
  return {
    id: payload.id,
    email: payload.email,
    full_name: payload.profile.fullName ?? null,
    phone: payload.profile.phone ?? null,
    role: mapBackendRoleToFrontend(payload.role),
    avatar_url: null,
    is_verified: Boolean(payload.emailConfirmed),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export { ApiError } from '@/lib/api'
