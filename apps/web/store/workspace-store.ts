import { create } from "zustand";
import axios from "axios";
import { createCookieAuthApiClient, ApiError } from "@/lib/api-client";
import { getApiBaseUrl } from "@/config/env";
import { AUTH_ROUTES } from "@/features/auth/services/auth-service";
import {
  WORKSPACE_ROUTES,
  type BackendWorkspace,
  type CreateWorkspacePayload,
} from "@/features/workspaces/services/workspace-service";

export interface WorkspaceState {
  workspace: BackendWorkspace | null;
  workspaces: BackendWorkspace[];
  loading: boolean;
  error: string | null;
  fetchCurrentWorkspace: () => Promise<void>;
  fetchWorkspaces: () => Promise<void>;
  createWorkspace: (payload: CreateWorkspacePayload) => Promise<BackendWorkspace>;
  setCurrentWorkspace: (workspaceId: string) => Promise<BackendWorkspace>;
  invalidateWorkspace: () => void;
  ensureWorkspaceSelected: () => Promise<void>;
}

const baseURL = getApiBaseUrl();

let workspaceClient: ReturnType<typeof createCookieAuthApiClient> | null = null;

function getWorkspaceClient() {
  if (workspaceClient) return workspaceClient;
  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ""),
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
  });
  workspaceClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {});
    },
  });
  return workspaceClient;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  workspaces: [],
  loading: false,
  error: null,

  fetchCurrentWorkspace: async () => {
    set({ loading: true, error: null });
    try {
      const client = getWorkspaceClient();
      const { data } = await client.get<{ data: BackendWorkspace | null }>(
        WORKSPACE_ROUTES.current
      );
      set({ workspace: data.data ?? null, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load workspace. Please try again.";
      const status = err instanceof ApiError ? err.status : 'unknown';
      console.error('[workspace-store] fetchCurrentWorkspace error:', message, { status, statusCode: err instanceof ApiError ? err.status : undefined });
      set({ error: message, loading: false });
    }
  },

  fetchWorkspaces: async () => {
    if (get().workspaces.length > 0) return;
    set({ loading: true, error: null });
    try {
      const client = getWorkspaceClient();
      const { data } = await client.get<{ data: BackendWorkspace[] }>(
        WORKSPACE_ROUTES.list
      );
      console.log('[workspace-store] fetchWorkspaces success:', { count: data.data.length, data });
      set({ workspaces: data.data, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load workspaces. Please try again.";
      const status = err instanceof ApiError ? err.status : 'unknown';
      console.error('[workspace-store] fetchWorkspaces error:', message, { status, statusCode: err instanceof ApiError ? err.status : undefined });
      set({ error: message, loading: false });
    }
  },

  createWorkspace: async (payload: CreateWorkspacePayload) => {
    set({ loading: true, error: null });
    try {
      const client = getWorkspaceClient();
      const { data } = await client.post<{ data: BackendWorkspace }>(
        WORKSPACE_ROUTES.create,
        payload
      );
      const existing = get().workspaces;
      const next = existing.some((item) => item.id === data.data.id)
        ? existing
        : [data.data, ...existing];
      set({ workspace: data.data, workspaces: next, loading: false, error: null });
      return data.data;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to create workspace. Please try again.";
      set({ error: message, loading: false });
      throw err;
    }
  },

  setCurrentWorkspace: async (workspaceId: string) => {
    set({ loading: true, error: null });
    try {
      const client = getWorkspaceClient();
      const { data } = await client.post<{ data: BackendWorkspace }>(
        WORKSPACE_ROUTES.setCurrent,
        { workspaceId }
      );
      set({ workspace: data.data, loading: false, error: null });
      return data.data;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to switch workspace. Please try again.";
      set({ error: message, loading: false });
      throw err;
    }
  },

  ensureWorkspaceSelected: async () => {
    const { workspace, workspaces, setCurrentWorkspace } = get();
    
    // If a workspace is already selected, no need to do anything
    if (workspace?.id) {
      console.log('[workspace-store] Workspace already selected:', { id: workspace.id, name: workspace.name });
      return;
    }

    // If no workspaces available, we can't select one
    if (!workspaces || workspaces.length === 0) {
      console.log('[workspace-store] No workspaces available to select');
      return;
    }

    // Select the first workspace
    const firstWorkspace = workspaces[0];
    console.log('[workspace-store] Auto-selecting first workspace:', { id: firstWorkspace.id, name: firstWorkspace.name });
    
    try {
      await setCurrentWorkspace(firstWorkspace.id);
    } catch (err) {
      console.error('[workspace-store] Failed to auto-select workspace:', err);
      // Don't throw - silently fail as this is a convenience feature
    }
  },

  invalidateWorkspace: () => set({ workspace: null, workspaces: [] }),
}));
