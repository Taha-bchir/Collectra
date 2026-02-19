import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../types/index.js'; // adjust if your Env type is elsewhere
import { getCookieHelper, WORKSPACE_COOKIE_NAME } from './cookie.js';

// We assume authorization middleware already set c.set('user', { id: string, ... })

export const tenantMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');

  // Safety: should never reach here without user (authorization should 401 first)
  if (!user || !user.id) {
    throw new HTTPException(401, { message: 'Unauthorized - no user context' });
  }

  const prisma = c.get('prisma');

  const workspaceHeader = c.req.header('x-workspace-id')?.trim();
  const preferredWorkspaceId = workspaceHeader || getCookieHelper(c, WORKSPACE_COOKIE_NAME) || null;

  const membership = preferredWorkspaceId
    ? await prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
          workspaceId: preferredWorkspaceId,
        },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              // add more fields if needed (website, etc.)
            },
          },
        },
      })
    : await prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
        },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              // add more fields if needed (website, etc.)
            },
          },
        },
        orderBy: {
          joinedAt: 'desc', // newest first → best default for single-workspace UX
        },
      });

  if (!membership || !membership.workspace) {
    throw new HTTPException(403, {
      message: 'No workspace found for this user. Please create or join one.',
    });
  }

  // Attach to context
  c.set('currentWorkspace', {
    id: membership.workspace.id,
    name: membership.workspace.name,
  });

  c.set('currentUser', {
    id: user.id,
    email: user.email!,
    role: membership.role, // workspace-specific role (OWNER/AGENT)
  });

  // Optional: log for debugging
  // console.log(`Tenant middleware: user ${user.id} → workspace ${membership.workspace.id}`);

  await next();
});