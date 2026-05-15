import type { InvitationStatus, WorkspaceMemberStatus, WorkspaceRole, WorkspaceSummary } from './workspaces.js';
export type TeamRole = WorkspaceRole;
export type TeamManageableRole = Exclude<TeamRole, 'OWNER'>;
export type TeamMemberStatus = WorkspaceMemberStatus;
export type TeamMember = {
    id: string;
    email: string;
    fullName: string | null;
    role: TeamRole;
    status: TeamMemberStatus;
    joinedAt: string;
    lastLogin?: string | null;
};
export type TeamPermissions = {
    canManageMembers: boolean;
    currentUserRole: TeamRole;
};
export type InviteMemberPayload = {
    email: string;
    role: TeamManageableRole;
};
export type InviteMemberResult = {
    id: string;
    email: string;
    role: TeamManageableRole;
    token: string;
    inviteLink: string | null;
    expiresAt: string;
    status: InvitationStatus;
    /** True when the invite link was sent successfully through Brevo. */
    invitationEmailSent: boolean;
    message: string;
};
export type AcceptInvitationResult = {
    workspace: WorkspaceSummary;
    role: TeamManageableRole;
    message: string;
};
//# sourceMappingURL=team.d.ts.map