import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../../../types/index.js';
import { authorization } from '../../../middleware/authorization.js';
import { tenantMiddleware } from '../../../middleware/tenant.js';
import { listPromisesSchema, createPromiseSchema } from '../../../schema/v1/promises.schema.js';

const handler = new OpenAPIHono<Env>();

handler.use('/debts/*/promises', authorization);
handler.use('/debts/*/promises', tenantMiddleware);

// SECURITY NOTICE - TENANT ISOLATION
// All endpoints MUST use c.get('currentWorkspace').id
// NEVER trust debtId or any tenant identifier from client

handler.openapi(listPromisesSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No active workspace' });

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
});

handler.openapi(createPromiseSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No active workspace' });

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
});

const routeModule = {
  path: '/api/v1',
  handler,
};

export default routeModule;