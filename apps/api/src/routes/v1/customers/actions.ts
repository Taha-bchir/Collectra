import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../../../types/index.js';
import { CustomersService } from '../../../services/customers.js';
import { authorization } from '../../../middleware/authorization.js';
import { tenantMiddleware } from '../../../middleware/tenant.js';
import {
  listCustomersSchema,
  createCustomerSchema,
  getCustomerByIdSchema,
  updateCustomerSchema,
} from '../../../schema/v1/customers.schema.js';

const handler = new OpenAPIHono<Env>();

handler.use('*', authorization);
handler.use('*', tenantMiddleware);

handler.openapi(listCustomersSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No workspace' });

  const search = c.req.query('search');
  const service = new CustomersService(c.get('prisma'));
  const customers = await service.list(workspaceId, search);

  return c.json({ data: customers }, 200);
});

handler.openapi(createCustomerSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No workspace' });

  const payload = c.req.valid('json');
  const service = new CustomersService(c.get('prisma'));
  const customer = await service.create(workspaceId, payload);

  return c.json({ data: customer }, 201);
});

handler.openapi(getCustomerByIdSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No workspace' });

  const { id } = c.req.valid('param');
  const service = new CustomersService(c.get('prisma'));
  const customer = await service.getById(workspaceId, id);

  return c.json({ data: customer }, 200);
});

handler.openapi(updateCustomerSchema, async (c) => {
  const workspaceId = c.get('currentWorkspace')?.id;
  if (!workspaceId) throw new HTTPException(403, { message: 'No workspace' });

  const { id } = c.req.valid('param');
  const payload = c.req.valid('json');

  const service = new CustomersService(c.get('prisma'));
  const customer = await service.update(workspaceId, id, payload);

  return c.json({ data: customer }, 200);
});

export default { path: '/api/v1/customers', handler };