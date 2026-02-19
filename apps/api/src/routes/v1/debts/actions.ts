import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../../../types/index.js';
import { DebtsService } from '../../../services/debts.js';
import { authorization } from '../../../middleware/authorization.js';
import { tenantMiddleware } from '../../../middleware/tenant.js';
import {
  listDebtsSchema,
  createDebtSchema,
  getDebtByIdSchema,
  updateDebtSchema,
} from '../../../schema/v1/debts.schema.js';
import type { DebtStatus, Prisma } from '@repo/database';

const handler = new OpenAPIHono<Env>();

handler.use('*', authorization);
handler.use('*', tenantMiddleware);

type ApiDebt = {
  id: string;
  campaignId: string;
  clientId: string;
  amount: number;
  dueDate: string;
  status: DebtStatus;
  promiseDate?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: {
    fullName: string;
    phone: string | null;
    email: string | null;
  };
};

type DebtEntity = {
  id: string;
  campaignId: string;
  clientId: string;
  amount: Prisma.Decimal;
  dueDate: Date;
  status: DebtStatus;
  promiseDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
};

const toApiDebt = (debt: DebtEntity): ApiDebt => ({
  id: debt.id,
  campaignId: debt.campaignId,
  clientId: debt.clientId,
  amount: debt.amount.toNumber(),
  dueDate: debt.dueDate.toISOString(),
  status: debt.status,
  promiseDate: debt.promiseDate?.toISOString() ?? null,
  createdAt: debt.createdAt.toISOString(),
  updatedAt: debt.updatedAt.toISOString(),
  ...(debt.client
    ? {
        client: {
          fullName: debt.client.fullName,
          phone: debt.client.phone,
          email: debt.client.email,
        },
      }
    : {}),
});

// SECURITY NOTICE - TENANT ISOLATION
// All endpoints in this file MUST use c.get('currentWorkspace').id from context.
// NEVER trust campaignId, clientId, or any other tenant identifier from request body/query/params.
// This middleware ensures cross-tenant data access is impossible.

handler.openapi(listDebtsSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) {
    throw new HTTPException(403, { message: 'No active workspace' });
  }

  const { status, clientId, campaignId } = c.req.valid('query') ?? {};

  const service = new DebtsService(c.get('prisma'));
  const debts = await service.list(workspaceId, { status, clientId, campaignId });

  return c.json({ data: debts.map((debt) => toApiDebt(debt)) }, 200);
});

handler.openapi(createDebtSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) {
    throw new HTTPException(403, { message: 'No active workspace' });
  }

  const payload = c.req.valid('json');
  const createInput: Parameters<DebtsService['create']>[1] = {
    campaignId: payload.campaignId,
    clientId: payload.clientId,
    amount: payload.amount,
    status: payload.status,
    dueDate: new Date(payload.dueDate),
  };
  if (payload.promiseDate !== undefined) {
    createInput.promiseDate = payload.promiseDate ? new Date(payload.promiseDate) : null;
  }

  const service = new DebtsService(c.get('prisma'));
  const debt = await service.create(workspaceId, createInput);

  return c.json({ data: toApiDebt(debt) }, 201);
});

handler.openapi(getDebtByIdSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) {
    throw new HTTPException(403, { message: 'No active workspace' });
  }

  const { id } = c.req.valid('param');

  const service = new DebtsService(c.get('prisma'));
  const debt = await service.getById(workspaceId, id);

  return c.json({ data: toApiDebt(debt) }, 200);
});

handler.openapi(updateDebtSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) {
    throw new HTTPException(403, { message: 'No active workspace' });
  }

  const { id } = c.req.valid('param');
  const payload = c.req.valid('json');
  const updateInput: Parameters<DebtsService['update']>[2] = {};
  if (payload.amount !== undefined) {
    updateInput.amount = payload.amount;
  }
  if (payload.status !== undefined) {
    updateInput.status = payload.status;
  }
  if (payload.dueDate !== undefined) {
    updateInput.dueDate = new Date(payload.dueDate);
  }
  if (payload.promiseDate !== undefined) {
    updateInput.promiseDate = payload.promiseDate ? new Date(payload.promiseDate) : null;
  }

  const service = new DebtsService(c.get('prisma'));
  const updatedDebt = await service.update(workspaceId, id, updateInput);

  return c.json({ data: toApiDebt(updatedDebt) }, 200);
});

const routeModule = {
  path: '/api/v1/debts',
  handler,
};

export default routeModule;