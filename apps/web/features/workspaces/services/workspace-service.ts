/**
 * Workspace API types and route constants. HTTP is done in workspace-store.
 */
export type {
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  WorkspaceSummary as BackendWorkspace,
  WorkspaceListItem as BackendWorkspaceListItem,
} from '@repo/types'

export const WORKSPACE_ROUTES = {
  list: "/api/v1/workspaces",
  current: "/api/v1/workspaces/current",
  create: "/api/v1/workspaces",
  setCurrent: "/api/v1/workspaces/current",
  update: (workspaceId: string) => `/api/v1/workspaces/${workspaceId}`,
  delete: (workspaceId: string) => `/api/v1/workspaces/${workspaceId}`,
} as const;

export { ApiError } from "@/lib/api";
