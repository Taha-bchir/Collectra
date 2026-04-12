import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../../types/index.js';
import { CustomersService } from '../../../services/customers.js';
import { requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js';
import { normalizeMetadata } from '../../../utils/metadata.js';
import {
  listCustomersSchema,
  createCustomerSchema,
  getCustomerByIdSchema,
  getCustomerTrackingSchema,
  updateCustomerSchema,
} from '../../../schema/v1/index.js';

const handler = new OpenAPIHono<Env>();

const toApiCustomerDetails = (
  customer: Awaited<ReturnType<CustomersService['getByIdWithDetails']>>,
) => ({
  id: customer.id,
  fullName: customer.fullName,
  email: customer.email,
  phone: customer.phone,
  address: customer.address,
  createdAt: customer.createdAt.toISOString(),
  updatedAt: customer.updatedAt.toISOString(),
  debts: customer.debts.map((debt) => ({
    id: debt.id,
    campaignId: debt.campaignId,
    campaignName: debt.campaignName,
    amount: debt.amount,
    dueDate: debt.dueDate.toISOString(),
    promiseDate: debt.promiseDate?.toISOString() ?? null,
    status: debt.status,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
    promises: debt.promises.map((promise) => ({
      id: promise.id,
      debtId: promise.debtId,
      promisedDate: promise.promisedDate.toISOString(),
      status: promise.status,
      createdAt: promise.createdAt.toISOString(),
      updatedAt: promise.updatedAt.toISOString(),
    })),
  })),
  actionHistory: customer.actionHistory.map((action) => ({
    id: action.id,
    debtId: action.debtId,
    customerId: action.customerId,
    actionType: action.actionType,
    timestamp: action.timestamp.toISOString(),
    performedBy: action.performedBy,
    metadata: normalizeMetadata(action.metadata),
    createdAt: action.createdAt.toISOString(),
  })),
});

const toApiCustomerTracking = (
  tracking: Awaited<ReturnType<CustomersService['getCommunicationTracking']>>,
) => ({
  customerId: tracking.customerId,
  summary: {
    totalDebts: tracking.summary.totalDebts,
    sentDebts: tracking.summary.sentDebts,
    notSentDebts: tracking.summary.notSentDebts,
    deliveredCount: tracking.summary.deliveredCount,
    openedCount: tracking.summary.openedCount,
    clickedCount: tracking.summary.clickedCount,
    spamCount: tracking.summary.spamCount,
    bouncedCount: tracking.summary.bouncedCount,
    unsubscribedCount: tracking.summary.unsubscribedCount,
    publicLinkVisitCount: tracking.summary.publicLinkVisitCount,
    lastEventAt: tracking.summary.lastEventAt?.toISOString() ?? null,
  },
  debts: tracking.debts.map((debt) => ({
    debtId: debt.debtId,
    campaignId: debt.campaignId,
    campaignName: debt.campaignName,
    debtStatus: debt.debtStatus,
    sentCount: debt.sentCount,
    deliveredCount: debt.deliveredCount,
    openedCount: debt.openedCount,
    clickedCount: debt.clickedCount,
    spamCount: debt.spamCount,
    bouncedCount: debt.bouncedCount,
    unsubscribedCount: debt.unsubscribedCount,
    publicLinkVisitCount: debt.publicLinkVisitCount,
    notSent: debt.notSent,
    notSeen: debt.notSeen,
    status: debt.status,
    lastEventAt: debt.lastEventAt?.toISOString() ?? null,
    lastSeenAt: debt.lastSeenAt?.toISOString() ?? null,
    events: debt.events.map((event) => ({
      id: event.id,
      debtId: event.debtId,
      timestamp: event.timestamp.toISOString(),
      actionType: event.actionType,
      eventName: event.eventName,
      channel: event.channel,
      metadata: normalizeMetadata(event.metadata),
    })),
  })),
});

handler.openapi(listCustomersSchema, withRouteTryCatch('customers.list', async (c) => {
  const workspaceId = requireWorkspaceId(c, 'No workspace');
  const service = new CustomersService(c.get('prisma'));
  const query = c.req.valid('query');
  const customers = await service.listWithDebtSummary(workspaceId, query);

  return c.json(customers, 200);
}));

handler.openapi(createCustomerSchema, withRouteTryCatch('customers.create', async (c) => {
  const workspaceId = requireWorkspaceId(c, 'No workspace');

  const payload = c.req.valid('json');
  const service = new CustomersService(c.get('prisma'));
  const customer = await service.create(workspaceId, payload);

  return c.json({ data: customer }, 201);
}));

handler.openapi(getCustomerByIdSchema, withRouteTryCatch('customers.getById', async (c) => {
  const workspaceId = requireWorkspaceId(c, 'No workspace');

  const { id } = c.req.valid('param');
  const service = new CustomersService(c.get('prisma'));
  const customer = await service.getByIdWithDetails(workspaceId, id);

  return c.json({ data: toApiCustomerDetails(customer) }, 200);
}));

handler.openapi(getCustomerTrackingSchema, withRouteTryCatch('customers.tracking', async (c) => {
  const workspaceId = requireWorkspaceId(c, 'No workspace');

  const { id } = c.req.valid('param');
  const service = new CustomersService(c.get('prisma'));
  const tracking = await service.getCommunicationTracking(workspaceId, id);

  return c.json({ data: toApiCustomerTracking(tracking) }, 200);
}));

handler.openapi(updateCustomerSchema, withRouteTryCatch('customers.update', async (c) => {
  const workspaceId = requireWorkspaceId(c, 'No workspace');

  const { id } = c.req.valid('param');
  const payload = c.req.valid('json');

  const service = new CustomersService(c.get('prisma'));
  const customer = await service.update(workspaceId, id, payload);

  return c.json({ data: customer }, 200);
}));

export default { path: '/api/v1/customers', handler };