import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import type { Env } from '../../../types/index.js';
import { DebtsService } from '../../../services/debts.js';
import {
  listDebtsSchema,
  createDebtSchema,
  getDebtByIdSchema,
  updateDebtSchema,
} from '../../../schema/v1/index.js';
import { requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js';

const handler = new OpenAPIHono<Env>();

type DebtRouteEntity = Awaited<ReturnType<DebtsService['create']>> & {
  client?: {
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
};

const toApiDebt = (debt: DebtRouteEntity) => ({
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

handler.openapi(listDebtsSchema, withRouteTryCatch('debts.list', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const { status, clientId, campaignId } = c.req.valid('query') ?? {};

  const service = new DebtsService(c.get('prisma'));
  const debts = await service.list(workspaceId, { status, clientId, campaignId });

  return c.json({ data: debts.map((debt) => toApiDebt(debt)) }, 200);
}));

handler.openapi(createDebtSchema, withRouteTryCatch('debts.create', async (c) => {
  const workspaceId = requireWorkspaceId(c);

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
}));

handler.openapi(getDebtByIdSchema, withRouteTryCatch('debts.getById', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const { id } = c.req.valid('param');

  const service = new DebtsService(c.get('prisma'));
  const debt = await service.getById(workspaceId, id);

  return c.json({ data: toApiDebt(debt) }, 200);
}));

handler.openapi(updateDebtSchema, withRouteTryCatch('debts.update', async (c) => {
  const workspaceId = requireWorkspaceId(c);

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
}));

const routeModule = {
  path: '/api/v1/debts',
  handler,
};


const getPersonalLinkSchema = createRoute({
  method: 'get',
  path: '/{id}/personal-link',
  tags: ['debts'],
  summary: 'Get secure personal link for customer (debt view)',
  description: 'Returns a unique, unguessable link the company can share with the debtor. Token-only access, no auth required for customer.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Personal link for customer',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              link: z.string().url(),
              token: z.string().uuid(),
              expiresAt: z.string().datetime().nullable(),
            }),
          }),
        },
      },
    },
    404: { description: 'Debt not found or not in workspace' },
    401: { description: 'Unauthorized' },
    403: { description: 'No active workspace' },
  },
});

handler.openapi(getPersonalLinkSchema, withRouteTryCatch('debts.personalLink', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const { id } = c.req.valid('param');

  const service = new DebtsService(c.get('prisma'));
  const link = await service.getPersonalLink(workspaceId, id);

  const debt = await service.getById(workspaceId, id); // already fetched in service

  return c.json({
    data: {
      link,
      token: debt.customerToken,
      expiresAt: debt.tokenExpiresAt?.toISOString() || null,
    },
  });
}));

export default routeModule;