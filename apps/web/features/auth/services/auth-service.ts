import type { Profile } from '@/lib/db-types'

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
  workspaceName: string
  website?: string
}

export interface RegisterResult {
  userId: string
  email: string
  requiresEmailVerification: boolean
}

export interface LoginResponseUser {
  id: string
  email: string
  emailConfirmed?: boolean
  profile: { fullName?: string | null }
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
    fullName: payload.profile.fullName ?? null,
    emailConfirmed: Boolean(payload.emailConfirmed),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export { ApiError } from '@/lib/api'
