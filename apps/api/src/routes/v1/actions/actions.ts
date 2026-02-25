import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../../../types/index.js';
import {
  listDebtActionsSchema,
  listCustomerActionsSchema,
  recordActionSchema,
} from '../../../schema/v1/index.js';
import { normalizeMetadata, toPrismaMetadata } from '../../../utils/metadata.js';
import { requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js';

const handler = new OpenAPIHono<Env>();

handler.openapi(listDebtActionsSchema, withRouteTryCatch('actions.listDebt', async (c) => {
  const workspaceId = requireWorkspaceId(c);

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

  const formattedActions = actions.map((action: (typeof actions)[number]) => ({
    ...action,
    metadata: normalizeMetadata(action.metadata),
  }));

  return c.json({ data: formattedActions }, 200);
}));

handler.openapi(listCustomerActionsSchema, withRouteTryCatch('actions.listCustomer', async (c) => {
  const workspaceId = requireWorkspaceId(c);

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

  const formattedActions = actions.map((action: (typeof actions)[number]) => ({
    ...action,
    metadata: normalizeMetadata(action.metadata),
  }));

  return c.json({ data: formattedActions }, 200);
}));

handler.openapi(recordActionSchema, withRouteTryCatch('actions.record', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const payload = c.req.valid('json');

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
      actionType: payload.actionType,
      performedBy: c.get('currentUser')?.id, // logged-in user
      metadata: toPrismaMetadata(payload.metadata),
    },
  });

  const formattedAction = {
    ...action,
    metadata: normalizeMetadata(action.metadata),
  };

  return c.json({ data: formattedAction }, 201);
}));

const routeModule = {
  path: '/api/v1',
  handler,
};

export default routeModule;