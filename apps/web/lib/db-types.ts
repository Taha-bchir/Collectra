/**
 * Shared DB-related types from @repo/types (Supabase-generated).
 * Re-exports and aliases for use across the web app.
 */

import type { Enums, Tables } from '@repo/types'

/** DB users table row shape. */
export type DbUser = Tables<'User'>

/** DB workspace table row shape. */
export type DbWorkspace = Tables<'Workspace'>

/** DB workspace member table row shape. */
export type DbWorkspaceMember = Tables<'WorkspaceMember'>

/** Database enum for workspace role. */
export type WorkspaceRole = Enums<'WorkspaceRole'>

/**
 * Auth profile shape used in the web app (session, store).
 * Aligns with API auth responses.
 */
export interface Profile {
  id: string
  email: string
  fullName: string | null
  emailConfirmed: boolean
  createdAt: string
  updatedAt: string
}
