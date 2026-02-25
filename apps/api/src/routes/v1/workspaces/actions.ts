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
} from "../../../schema/v1/index.js";
import { setWorkspaceCookie, getCookieHelper, WORKSPACE_COOKIE_NAME } from "../../../middleware/cookie.js";
import { requireUserId, withRouteTryCatch } from '../../../utils/route-helpers.js';

const handler = new OpenAPIHono<Env>();

// GET /current - resolve current workspace optionally (no tenant; returns null if none)
handler.openapi(getCurrentWorkspaceSchema, withRouteTryCatch('workspaces.current', async (c) => {
  const userId = requireUserId(c);

  const prisma = c.get("prisma");
  const preferredWorkspaceId = getCookieHelper(c, WORKSPACE_COOKIE_NAME) || null;

  const membership = preferredWorkspaceId
    ? await prisma.workspaceMember.findFirst({
        where: {
          userId,
          workspaceId: preferredWorkspaceId,
        },
        select: {
          workspace: {
            select: { id: true, name: true },
          },
        },
      })
    : await prisma.workspaceMember.findFirst({
        where: { userId },
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
}));

// POST /current - set current workspace
handler.openapi(setCurrentWorkspaceSchema, withRouteTryCatch('workspaces.setCurrent', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const payload = c.req.valid('json');

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
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
}));

// GET / - list all workspaces for user
handler.openapi(listWorkspacesSchema, withRouteTryCatch('workspaces.list', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const workspaces = await prisma.workspaceMember.findMany({
    where: { userId },
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
      data: workspaces.map((entry: (typeof workspaces)[number]) => entry.workspace),
    },
    200
  );
}));

// POST / - create new workspace
handler.openapi(createWorkspaceSchema, withRouteTryCatch('workspaces.create', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const payload = c.req.valid('json');

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
        createdByUserId: userId,
        members: {
          create: {
            userId,
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
}));

const routeModule: AutoLoadRoute = {
  path: "/api/v1/workspaces",
  handler: handler as unknown as AutoLoadRoute["handler"],
};

export default routeModule;
