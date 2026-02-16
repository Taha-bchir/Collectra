import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { AutoLoadRoute } from "hono-autoload/types";
import type { Env } from "../../../types/index.js";
import { WorkspaceRole } from "@repo/database";
import {
  getCurrentWorkspaceSchema,
  createWorkspaceSchema,
  listWorkspacesSchema,
  setCurrentWorkspaceSchema,
} from "../../../schema/v1/workspaces.schema.js";
import { setWorkspaceCookie, getCookieHelper, WORKSPACE_COOKIE_NAME } from "../../../middleware/cookie.js";

const handler = new OpenAPIHono<Env>();

// GET /current - resolve current workspace optionally (no tenant; returns null if none)
handler.openapi(getCurrentWorkspaceSchema, async (c) => {
  const user = c.get("user");
  if (!user?.id) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const prisma = c.get("prisma");
  const preferredWorkspaceId = getCookieHelper(c, WORKSPACE_COOKIE_NAME) || null;

  const membership = preferredWorkspaceId
    ? await prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
          workspaceId: preferredWorkspaceId,
        },
        select: {
          workspace: {
            select: { id: true, name: true },
          },
        },
      })
    : await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        select: {
          workspace: {
            select: { id: true, name: true },
          },
        },
        orderBy: { joinedAt: "desc" },
      });

  const workspace = membership?.workspace ?? null;

  return c.json(
    {
      data: workspace
        ? { id: workspace.id, name: workspace.name }
        : null,
    },
    200
  );
});

// POST /current - set current workspace
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

// GET / - list all workspaces for user
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

// POST / - create new workspace
handler.openapi(createWorkspaceSchema, async (c) => {
  const prisma = c.get("prisma");
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const payload = await c.req.json<{ name: string; website?: string }>();

  const name = payload.name?.trim();
  if (!name) {
    return c.json(
      { error: { message: "Workspace name is required", code: "WORKSPACE_NAME_REQUIRED" } },
      400
    );
  }

  const website = payload.website?.trim() || null;

  try {
    const workspace = await prisma.workspace.create({
      data: {
        name,
        website,
        createdByUserId: user.id,
        members: {
          create: {
            userId: user.id,
            role: WorkspaceRole.OWNER,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    return c.json({ data: workspace }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace creation failed";
    const isConflict = /unique|already|duplicate/i.test(message);

    return c.json(
      {
        error: {
          message: isConflict ? "Workspace name already exists" : message,
          code: isConflict ? "WORKSPACE_EXISTS" : "WORKSPACE_CREATE_FAILED",
        },
      },
      isConflict ? 409 : 400
    );
  }
});

const routeModule: AutoLoadRoute = {
  path: "/api/v1/workspaces",
  handler: handler as unknown as AutoLoadRoute["handler"],
};

export default routeModule;
