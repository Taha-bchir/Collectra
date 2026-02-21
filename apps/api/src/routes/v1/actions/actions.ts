import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../../../types/index.js';
import { ActionType, Prisma } from '@repo/database';
import { authorization } from '../../../middleware/authorization.js';
import { tenantMiddleware } from '../../../middleware/tenant.js';
import {
  listDebtActionsSchema,
  listCustomerActionsSchema,
  recordActionSchema,
} from '../../../schema/v1/actions.schema.js';

const handler = new OpenAPIHono<Env>();

handler.use('/actions', authorization);
handler.use('/actions', tenantMiddleware);
handler.use('/debts/*/actions', authorization);
handler.use('/debts/*/actions', tenantMiddleware);
handler.use('/customers/*/actions', authorization);
handler.use('/customers/*/actions', tenantMiddleware);

handler.openapi(listDebtActionsSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No active workspace' });

  const { debtId } = c.req.valid('param');

  const debt = await c.get('prisma').debtRecord.findUnique({
    where: { id: debtId },
    select: { campaign: { select: { workspaceId: true } } },
  });

  if (!debt || debt.campaign.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: 'Debt not found or not in your workspace' });
  }

  const actions = await c.get('prisma').customerActionHistory.findMany({
    where: { debtId },
    orderBy: { timestamp: 'desc' },
  });

  const formattedActions = actions.map(action => ({
    ...action,
    metadata: typeof action.metadata === 'object' ? action.metadata : null,
  }));

  return c.json({ data: formattedActions }, 200);
});

handler.openapi(listCustomerActionsSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No active workspace' });

  const { customerId } = c.req.valid('param');

  const customer = await c.get('prisma').client.findUnique({
    where: { id: customerId },
    select: { workspaceId: true },
  });

  if (!customer || customer.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: 'Customer not found or not in your workspace' });
  }

  const actions = await c.get('prisma').customerActionHistory.findMany({
    where: { customerId },
    orderBy: { timestamp: 'desc' },
  });

  const formattedActions = actions.map(action => ({
    ...action,
    metadata: typeof action.metadata === 'object' ? action.metadata : null,
  }));

  return c.json({ data: formattedActions }, 200);
});

handler.openapi(recordActionSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No active workspace' });

  const payload = c.req.valid('json') as { customerId: string; debtId?: string; actionType: string; metadata?: unknown };

  // Verify customer belongs to workspace
  const customer = await c.get('prisma').client.findUnique({
    where: { id: payload.customerId },
    select: { workspaceId: true },
  });

  if (!customer || customer.workspaceId !== workspaceId) {
    throw new HTTPException(404, { message: 'Customer not found or not in your workspace' });
  }

  // Optional: if debtId given, verify it too
  if (payload.debtId) {
    const debt = await c.get('prisma').debtRecord.findUnique({
      where: { id: payload.debtId },
      select: { campaign: { select: { workspaceId: true } } },
    });
    if (!debt || debt.campaign.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Debt not found or not in workspace' });
    }
  }

  const action = await c.get('prisma').customerActionHistory.create({
    data: {
      customerId: payload.customerId,
      debtId: payload.debtId,
      actionType: payload.actionType as ActionType,
      performedBy: c.get('currentUser')?.id, // logged-in user
      metadata: payload.metadata as Prisma.InputJsonValue | undefined,
    },
  });

  const formattedAction = {
    ...action,
    metadata: typeof action.metadata === 'object' ? action.metadata : null,
  };

  return c.json({ data: formattedAction }, 201);
});

const routeModule = {
  path: '/api/v1',
  handler,
};

export default routeModule;