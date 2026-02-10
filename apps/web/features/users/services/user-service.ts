import type { UserRole } from '@/lib/db-types'

/**
 * User API types and route constants. HTTP is done in user-store.
 * Role comes from the JWT (token) via the server; /me returns it for session revalidation.
 */
export type BackendUserProfile = {
  id: string
  email: string
  role: UserRole
  profile: {
    fullName?: string | null
    phone?: string | null
  }
}

export type UpdateMePayload = {
  fullName?: string
  phone?: string
}

export const USER_ROUTES = {
  me: '/api/v1/users/me',
} as const

export { ApiError } from '@/lib/api'
