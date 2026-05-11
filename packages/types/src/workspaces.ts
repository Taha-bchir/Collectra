import type { Tables } from './types.js'

// Keep these role/status unions centralized for app-wide reuse.
// The generated DB type package currently does not expose all latest enum values.
export type WorkspaceRole = 'OWNER' | 'MANAGER' | 'AGENT'
export type WorkspaceMemberStatus = 'ACTIVE' | 'INACTIVE'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

export type WorkspaceSummary = Pick<Tables<'Workspace'>, 'id' | 'name' | 'website'>

export type WorkspaceListItem = WorkspaceSummary & {
  role: WorkspaceRole
}

export type CreateWorkspacePayload = {
  name: string
  website?: string
}

export type UpdateWorkspacePayload = {
  name: string
  website?: string | null
}
