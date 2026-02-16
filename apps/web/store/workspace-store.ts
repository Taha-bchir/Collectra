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

  invalidateWorkspace: () => set({ workspace: null, workspaces: [] }),
}));
