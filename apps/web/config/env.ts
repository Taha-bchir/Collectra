/**
 * Web app environment configuration.
 * Required in production; in development, some keys have fallbacks if missing.
 */

const isDev = process.env.NODE_ENV === 'development'

const required = (name: string, devFallback?: string): string => {
  const value = process.env[name]
  const empty = value === undefined || value === ''
  if (empty && isDev && devFallback !== undefined) {
    return devFallback
  }
  if (empty) {
    throw new Error(
      `[config] Missing required environment variable: ${name}. ` +
        'Set it in .env.local (development) or your deployment environment.',
    )
  }
  return value
}

/** API base URL for the backend (no trailing slash). Required. */
export function getApiBaseUrl(): string {
  return required('NEXT_PUBLIC_API_URL', 'http://localhost:3000').replace(/\/$/, '')
}

/** LocalStorage key for auth state. Required. Must be unique per app/deployment. */
export function getAuthStorageKey(): string {
  return required('NEXT_PUBLIC_APP_AUTH_STORAGE_KEY', 'app.auth')
}

/** LocalStorage key for user preferences. Required. Must be unique per app/deployment. */
export function getPreferencesStorageKey(): string {
  return required('NEXT_PUBLIC_APP_PREFERENCES_STORAGE_KEY', 'app.preferences')
}

/** Default theme. Required. One of: light | dark | system */
export function getDefaultTheme(): 'light' | 'dark' | 'system' {
  const v = required('NEXT_PUBLIC_DEFAULT_THEME', 'system').toLowerCase()
  if (v !== 'light' && v !== 'dark' && v !== 'system') {
    throw new Error(
      `[config] NEXT_PUBLIC_DEFAULT_THEME must be one of: light, dark, system. Got: ${v}`,
    )
  }
  return v as 'light' | 'dark' | 'system'
}

/** Allowed sign-up roles (must match @repo/types UserRole: USER | ADMIN | DEMO). */
const SIGNUP_ROLES = ['USER', 'ADMIN', 'DEMO'] as const

/** Default role selected on sign-up. Required. Must be a valid UserRole. */
export function getDefaultSignupRole(): (typeof SIGNUP_ROLES)[number] {
  const v = required('NEXT_PUBLIC_DEFAULT_SIGNUP_ROLE', 'USER').toUpperCase()
  if (v === 'USER' || v === 'ADMIN' || v === 'DEMO') {
    return v
  }
  throw new Error(
    `[config] NEXT_PUBLIC_DEFAULT_SIGNUP_ROLE must be one of: ${SIGNUP_ROLES.join(', ')}. Got: ${v}`,
  )
}
