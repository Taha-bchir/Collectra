import axios from 'axios'
import { createCookieAuthApiClient, ApiError } from '@/lib/api-client'
import { getApiBaseUrl } from '@/config/env'
import { AUTH_ROUTES } from '@/features/auth/services/auth-service'

export type TeamRole = 'OWNER' | 'MANAGER' | 'AGENT'
export type TeamMemberStatus = 'ACTIVE' | 'INACTIVE'

export type TeamMember = {
  id: string
  email: string
  fullName: string | null
  role: TeamRole
  status: TeamMemberStatus
  joinedAt: string
}

export type TeamPermissions = {
  canManageMembers: boolean
  currentUserRole: TeamRole
}

export type InviteMemberPayload = {
  email: string
  role: Exclude<TeamRole, 'OWNER'>
}

export type InviteMemberResult = {
  id: string
  email: string
  role: Exclude<TeamRole, 'OWNER'>
  token: string
  inviteLink: string | null
  expiresAt: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  message: string
}

export type AcceptInvitationResult = {
  workspace: {
    id: string
    name: string
  }
  role: Exclude<TeamRole, 'OWNER'>
  message: string
}

export const TEAM_ROUTES = {
  listMembers: '/api/v1/internal-users',
  updateRole: (memberId: string) => `/api/v1/internal-users/${memberId}/role`,
  updateStatus: (memberId: string) => `/api/v1/internal-users/${memberId}/status`,
  invite: '/api/v1/invitations',
  acceptInvite: '/api/v1/invitations/accept',
} as const

const baseURL = getApiBaseUrl()

let teamClient: ReturnType<typeof createCookieAuthApiClient> | null = null

function getTeamClient() {
  if (teamClient) return teamClient

  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })

  teamClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {})
    },
  })

  return teamClient
}

export async function listTeamMembers(): Promise<{ members: TeamMember[]; permissions: TeamPermissions }> {
  const client = getTeamClient()
  const { data } = await client.get<{
    data: TeamMember[]
    permissions: TeamPermissions
  }>(TEAM_ROUTES.listMembers)

  return {
    members: data.data,
    permissions: data.permissions,
  }
}

export async function inviteTeamMember(payload: InviteMemberPayload): Promise<InviteMemberResult> {
  const client = getTeamClient()
  const { data } = await client.post<{
    data: Omit<InviteMemberResult, 'message'>
    message: string
  }>(TEAM_ROUTES.invite, payload)

  return {
    ...data.data,
    message: data.message,
  }
}

export async function updateTeamMemberRole(memberId: string, role: Exclude<TeamRole, 'OWNER'>): Promise<TeamMember> {
  const client = getTeamClient()
  const { data } = await client.patch<{ data: TeamMember }>(TEAM_ROUTES.updateRole(memberId), { role })
  return data.data
}

export async function updateTeamMemberStatus(memberId: string, status: TeamMemberStatus): Promise<TeamMember> {
  const client = getTeamClient()
  const { data } = await client.patch<{ data: TeamMember }>(TEAM_ROUTES.updateStatus(memberId), { status })
  return data.data
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResult> {
  const client = getTeamClient()
  const { data } = await client.post<{
    data: {
      workspace: {
        id: string
        name: string
      }
      role: Exclude<TeamRole, 'OWNER'>
    }
    message: string
  }>(TEAM_ROUTES.acceptInvite, { token })

  return {
    workspace: data.data.workspace,
    role: data.data.role,
    message: data.message,
  }
}

export { ApiError }
