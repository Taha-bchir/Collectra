import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '../types/index.js'; // adjust if your Env type is elsewhere
import type { MiddlewareDefinition } from './types.js';
import { attachTenantContext } from './authorization.js';

// We assume authorization middleware already set c.set('user', { id: string, ... })

export const tenantMiddleware = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user');

  // Safety: should never reach here without user (authorization should 401 first)
  if (!user || !user.id) {
    throw new HTTPException(401, { message: 'Unauthorized - no user context' });
  }

  await attachTenantContext(c, {
    id: user.id,
    email: user.email,
  });

  await next();
});

const TENANT_PATTERNS = [
  '/api/v1/customers',
  '/api/v1/customers/*',
  '/api/v1/debts',
  '/api/v1/debts/*',
  '/api/v1/actions',
  '/api/v1/actions/*',
  '/api/v1/debts/*/promises',
  '/api/v1/test-tenant',
  '/api/v1/test-tenant/*',
] as const;

const definitions: MiddlewareDefinition[] = TENANT_PATTERNS.map((pattern, index) => ({
  name: `tenant:${index}`,
  handler: tenantMiddleware,
  pattern,
  order: 60,
}));

export default definitions;