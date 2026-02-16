import { createRoute, z } from "@hono/zod-openapi";

const workspaceResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
  }),
});

const currentWorkspaceResponseSchema = z.object({
  data: z
    .object({
      id: z.string().uuid(),
      name: z.string().min(1),
    })
    .nullable(),
});

const workspaceListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
    })
  ),
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
          schema: currentWorkspaceResponseSchema,
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
          schema: workspaceResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
              code: z.string().optional(),
            }),
          }),
        },
      },
    },
    409: {
      description: "Workspace already exists",
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
              code: z.string().optional(),
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
          schema: workspaceListResponseSchema,
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
          schema: workspaceResponseSchema,
        },
      },
    },
    404: {
      description: "Workspace not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.object({
              message: z.string(),
              code: z.string().optional(),
            }),
          }),
        },
      },
    },
  },
});
