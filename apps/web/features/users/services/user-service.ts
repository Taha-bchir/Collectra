/**
 * User API types and route constants. HTTP is done in user-store.
 */
export type { BackendUserProfile, UpdateMePayload } from '@repo/types'

export const USER_ROUTES = {
  me: '/api/v1/users/me',
} as const

export { ApiError } from '@/lib/api'
