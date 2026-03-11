import type { Profile } from '@/lib/db-types'
import type {
  LoginPayload,
  LoginResponseData,
  LoginResponseUser,
  RefreshResponseData,
  RegisterPayload,
  RegisterResult,
} from '@repo/types'

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

export type {
  LoginPayload,
  LoginResponseData,
  LoginResponseUser,
  RefreshResponseData,
  RegisterPayload,
  RegisterResult,
} from '@repo/types'

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
