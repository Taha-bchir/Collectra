import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../../../types/index.js';
import { listPromisesSchema, createPromiseSchema } from '../../../schema/v1/index.js';
import { requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js';

const handler = new OpenAPIHono<Env>();

// SECURITY NOTICE - TENANT ISOLATION
// All endpoints MUST use c.get('currentWorkspace').id
// NEVER trust debtId or any tenant identifier from client

handler.openapi(listPromisesSchema, withRouteTryCatch('promises.list', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const { debtId } = c.req.valid('param');

  // Fetch debt to verify it belongs to workspace
  const debt = await c.get('prisma').debtRecord.findUnique({
    where: { id: debtId },
    select: { campaign: { select: { workspaceId: true } } },
  });

  if (!debt || debt.campaign.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: 'Debt not found or not in your workspace' });
  }

  const promises = await c.get('prisma').paymentPromise.findMany({
    where: { debtId },
    orderBy: { createdAt: 'desc' },
  });

  return c.json({ data: promises }, 200);
}));

handler.openapi(createPromiseSchema, withRouteTryCatch('promises.create', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const { debtId } = c.req.valid('param');
  const payload = c.req.valid('json');

  const debt = await c.get('prisma').debtRecord.findUnique({
    where: { id: debtId },
    select: { campaign: { select: { workspaceId: true } } },
  });

  if (!debt || debt.campaign.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: 'Debt not found or not in your workspace' });
  }

  const promise = await c.get('prisma').paymentPromise.create({
    data: {
      debtId,
      promisedDate: new Date(payload.promisedDate),
      status: payload.status ?? 'ACTIVE',
    },
  });

  return c.json({ data: promise }, 201);
}));

const routeModule = {
  path: '/api/v1',
  handler,
};

export default routeModule;