# Workspace visibility in the private app

This note explains how workspaces are fetched and displayed in the sidebar, how creation works, and the supporting API and state changes.

## Goal

- Show all workspaces linked to the user in the private app.
- Keep a simple dropdown that can become a real workspace switcher later.

## What changed (overview)

1. Added workspace endpoints to list, create, resolve, and set the current workspace.
2. Added a workspace store in the web app to fetch and cache the list and current workspace.
3. Rendered the workspace list in the sidebar dropdown, marked the active workspace, and added switching.
4. Kept the create‑workspace dialog in the sidebar dropdown.

## Backend: workspace endpoints

### Schemas

File: apps/api/src/schema/v1/workspaces.schema.ts

```ts
export const getCurrentWorkspaceSchema = createRoute({
  method: "get",
  path: "/current",
  tags: ["workspaces"],
  summary: "Get current workspace",
  description: "Returns the active workspace resolved via tenant middleware.",
  responses: {
    200: {
      description: "Workspace resolved successfully",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              name: z.string().min(1),
            }),
          }),
        },
      },
    },
  },
});

export const listWorkspacesSchema = createRoute({
  method: "get",
  path: "/",
  tags: ["workspaces"],
  summary: "List workspaces",
  description: "Returns all workspaces linked to the current user.",
  responses: {
    200: {
      description: "Workspace list",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string().min(1),
              })
            ),
          }),
        },
      },
    },
  },
});

export const setCurrentWorkspaceSchema = createRoute({
  method: "post",
  path: "/current",
  tags: ["workspaces"],
  summary: "Set current workspace",
  description: "Sets the active workspace for the current user.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            workspaceId: z.string().uuid(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Workspace selected",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              name: z.string().min(1),
            }),
          }),
        },
      },
    },
  },
});

export const createWorkspaceSchema = createRoute({
  method: "post",
  path: "/",
  tags: ["workspaces"],
  summary: "Create a workspace",
  description: "Creates a new workspace and links the current user as OWNER.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1).max(120),
            website: z.string().url().max(255).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Workspace created successfully",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              name: z.string().min(1),
            }),
          }),
        },
      },
    },
  },
});
```

### Routes

File: apps/api/src/routes/v1/workspaces/actions.ts

```ts
handler.openapi(listWorkspacesSchema, async (c) => {
  const prisma = c.get("prisma");
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return c.json(
    {
      data: workspaces.map((entry) => entry.workspace),
    },
    200
  );
});

handler.openapi(setCurrentWorkspaceSchema, async (c) => {
  const prisma = c.get("prisma");
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const payload = await c.req.json<{ workspaceId: string }>();

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: user.id,
      workspaceId: payload.workspaceId,
    },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!membership?.workspace) {
    return c.json(
      { error: { message: "Workspace not found", code: "WORKSPACE_NOT_FOUND" } },
      404
    );
  }

  setWorkspaceCookie(c, membership.workspace.id);

  return c.json({ data: membership.workspace }, 200);
});

handler.use("/current", tenantMiddleware);

handler.openapi(getCurrentWorkspaceSchema, (c) => {
  const workspace = c.get("currentWorkspace");

  if (!workspace) {
    throw new HTTPException(403, { message: "Workspace not found" });
  }

  return c.json(
    {
      data: {
        id: workspace.id,
        name: workspace.name,
      },
    },
    200
  );
});
```

### Auth protection

File: apps/api/src/middleware/authorization.ts

```ts
const PROTECTED_PATTERNS = [
  "/api/v1/users/*",
  "/api/v1/workspaces/*",
  "/api/v1/authentication/reset-password",
] as const;
```

Why: workspace data is scoped to the authenticated user, so these routes must be protected.

## Frontend: workspace store

### New API types

File: apps/web/features/workspaces/services/workspace-service.ts

```ts
export type BackendWorkspace = {
  id: string;
  name: string;
};

export const WORKSPACE_ROUTES = {
  list: "/api/v1/workspaces",
  current: "/api/v1/workspaces/current",
  create: "/api/v1/workspaces",
  setCurrent: "/api/v1/workspaces/current",
} as const;
```

### New Zustand store

File: apps/web/store/workspace-store.ts

```ts
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  workspaces: [],
  loading: false,
  error: null,

  fetchCurrentWorkspace: async () => {
    if (get().workspace !== null) return;
    set({ loading: true, error: null });
    try {
      const client = getWorkspaceClient();
      const { data } = await client.get<{ data: BackendWorkspace }>(
        WORKSPACE_ROUTES.current
      );
      set({ workspace: data.data, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load workspace. Please try again.";
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
      set({ workspaces: data.data, loading: false, error: null });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load workspaces. Please try again.";
      set({ error: message, loading: false });
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
```

Why: the store keeps the workspace name available across the dashboard without refetching on every render.

## Frontend: sidebar display

### Workspace label and dropdown

File: apps/web/components/common/app-sidebar.tsx

```tsx
useEffect(() => {
  if (hasHydrated && isAuthenticated) {
    fetchCurrentWorkspace();
    fetchWorkspaces();
  }
}, [hasHydrated, isAuthenticated, fetchCurrentWorkspace, fetchWorkspaces]);

const workspaceLabel = workspaceLoading
  ? strings.loading
  : workspace?.name || (workspaceError ? "Workspace unavailable" : "Workspace");
```

```tsx
<SidebarMenu>
  <SidebarMenuItem>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="sm" className="...">
          {sidebarState === "collapsed" ? (
            <LayoutGrid className="h-4 w-4" />
          ) : (
            <>
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <span className="text-xs text-sidebar-foreground/60">Workspace</span>
                <span className="truncate font-medium text-sidebar-foreground">
                  {workspaceLabel}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 shrink-0 text-sidebar-foreground/60" />
            </>
          )}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {workspaceItems.length === 0 ? (
          <DropdownMenuItem disabled>
            {workspaceLabel}
          </DropdownMenuItem>
        ) : (
          workspaceItems.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={(event) => {
                event.preventDefault();
                handleWorkspaceSelect(item.id);
              }}
            >
              <span className="truncate">{item.name}</span>
              {workspace?.id === item.id ? (
                <Badge variant="secondary" className="ml-auto">
                  Active
                </Badge>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setCreateOpen(true); }}>
          Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem>
</SidebarMenu>
```

Why: users can see all their workspaces now, and the dropdown is ready for a real switcher later.

## Removed from header

File: apps/web/app/(dashboard)/layout.tsx

- The workspace dropdown in the header was removed so the workspace name appears only in the sidebar.

## Hydration warning note

If you see a hydration mismatch warning caused by extra attributes on the `body` tag, it is often due to browser extensions injecting attributes before React loads. To avoid noisy console warnings in dev, the `body` tag now uses `suppressHydrationWarning` in the root layout.

## Result

- Logged-in users see all their workspaces in the sidebar dropdown.
- Clicking a workspace switches the active workspace (cookie-backed).
- The active workspace is marked with a badge.
- A create‑workspace action is available in the same dropdown.
