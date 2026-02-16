/**
 * Workspace API types and route constants. HTTP is done in workspace-store.
 */
export type BackendWorkspace = {
  id: string;
  name: string;
};

export type CreateWorkspacePayload = {
  name: string;
  website?: string;
};

export const WORKSPACE_ROUTES = {
  list: "/api/v1/workspaces",
  current: "/api/v1/workspaces/current",
  create: "/api/v1/workspaces",
  setCurrent: "/api/v1/workspaces/current",
} as const;

export { ApiError } from "@/lib/api";
