/**
 * Workspace API types and route constants. HTTP is done in workspace-store.
 */
export type { CreateWorkspacePayload, WorkspaceSummary as BackendWorkspace } from '@repo/types'

export const WORKSPACE_ROUTES = {
  list: "/api/v1/workspaces",
  current: "/api/v1/workspaces/current",
  create: "/api/v1/workspaces",
  setCurrent: "/api/v1/workspaces/current",
} as const;

export { ApiError } from "@/lib/api";
