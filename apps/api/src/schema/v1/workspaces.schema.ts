import { createRoute, z } from "@hono/zod-openapi";
import { WorkspaceRole } from "@repo/database";

const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  website: z.string().url().nullable(),
});

const workspaceListItemSchema = workspaceSchema.extend({
  role: z.nativeEnum(WorkspaceRole),
});

const errorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});

export const getCurrentWorkspaceSchema = createRoute({
  method: "get",
  path: "/current",
  tags: ["workspaces"],
  summary: "Get current workspace",
  description:
    "Returns the active workspace (from cookie or first membership). Returns null if user has no workspace.",
  responses: {
    200: {
      description: "Current workspace or null",
      content: {
        "application/json": {
          schema: z.object({
            data: workspaceSchema.nullable(),
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
          schema: z.object({ data: workspaceSchema }),
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
    409: {
      description: "Workspace already exists",
      content: {
        "application/json": {
          schema: errorSchema,
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
            data: z.array(workspaceListItemSchema),
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
          schema: z.object({ data: workspaceSchema }),
        },
      },
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
});

export const updateWorkspaceSchema = createRoute({
  method: "patch",
  path: "/{workspaceId}",
  tags: ["workspaces"],
  summary: "Update workspace",
  description: "Updates workspace details. Owner role required.",
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1).max(120),
            website: z.string().url().max(255).nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Workspace updated",
      content: {
        "application/json": {
          schema: z.object({ data: workspaceSchema }),
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
});

export const deleteWorkspaceSchema = createRoute({
  method: "delete",
  path: "/{workspaceId}",
  tags: ["workspaces"],
  summary: "Delete workspace",
  description: "Deletes a workspace. Owner role required.",
  request: {
    params: z.object({
      workspaceId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Workspace deleted",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({ id: z.string().uuid() }),
          }),
        },
      },
    },
    403: {
      description: "Forbidden",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    },
  },
});
