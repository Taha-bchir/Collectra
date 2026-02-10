/**
 * Shared DB-related types from @repo/types (Supabase-generated).
 * Re-exports and aliases for use across the web app.
 */

import type { Enums, Tables } from '@repo/types'

/** Database enum for user role (must match API/DB). */
export type UserRole = Enums<'UserRole'>

/** DB users table row shape. */
export type DbUser = Tables<'users'>

/**
 * Auth profile shape used in the web app (session, store).
 * Aligns with API auth responses and normalizeProfile output.
 */
export interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}
