import type { Tables } from './types.js';
export type WorkspaceRole = 'OWNER' | 'MANAGER' | 'AGENT';
export type WorkspaceMemberStatus = 'ACTIVE' | 'INACTIVE';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
export type WorkspaceSummary = Pick<Tables<'Workspace'>, 'id' | 'name'>;
export type CreateWorkspacePayload = {
    name: string;
    website?: string;
};
//# sourceMappingURL=workspaces.d.ts.map