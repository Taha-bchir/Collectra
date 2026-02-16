import { Hono } from 'hono';
import type { Env } from '../../types/index.js';
import { tenantMiddleware } from '../../middleware/tenant.js';

const handler = new Hono<Env>();

// Apply tenant middleware to all routes in this handler
handler.use(tenantMiddleware);

/**
 * Test route to verify tenant middleware security
 * 
 * Test cases:
 * 1. No auth token → 401 Unauthorized
 * 2. Auth but no workspace → 403 Forbidden
 * 3. Valid auth + workspace → 200 with workspace/user data
 * 4. Verify tenant isolation (user only sees their workspace)
 */

// ✅ PASS: Valid tenant access - returns current workspace & user
handler.get('/valid', async (c) => {
  const workspace = c.get('currentWorkspace');
  const user = c.get('currentUser');
  
  if (!workspace || !user) {
    return c.json({ error: 'Missing context' }, 400);
  }
  
  return c.json({
    success: true,
    workspace: {
      id: workspace.id,
      name: workspace.name,
    },
    user: {
      id: user.id,
      email: user.email,
      role: user.role, // OWNER or AGENT
    },
  });
});

// 🔒 SECURITY TEST: Check tenant isolation
// User should only access their own workspace
handler.get('/isolation/:targetWorkspaceId', async (c) => {
  const workspace = c.get('currentWorkspace');
  const targetWorkspaceId = c.req.param('targetWorkspaceId');
  
  if (!workspace) {
    return c.json({ error: 'Missing workspace context' }, 403);
  }
  
  // Simulate checking if user can access target workspace
  if (workspace.id !== targetWorkspaceId) {
    return c.json({
      error: 'Tenant isolation breach detected',
      message: `User workspace ${workspace.id} ≠ target workspace ${targetWorkspaceId}`,
      severity: 'SECURITY_BREACH',
    }, 403);
  }
  
  return c.json({
    success: true,
    message: 'Tenant isolation verified - access granted',
    grantedWorkspaceId: workspace.id,
  });
});

// ℹ️ DEBUG: Check role-based access
handler.get('/role-check', async (c) => {
  const user = c.get('currentUser');
  
  if (!user) {
    return c.json({ error: 'Missing user context' }, 401);
  }
  
  const isOwner = user.role === 'OWNER';
  const isAgent = user.role === 'AGENT';
  
  return c.json({
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: {
      canEditWorkspace: isOwner,
      canManageMembers: isOwner,
      canViewData: isOwner || isAgent,
    },
  });
});

export default {
  path: '/api/v1/test-tenant',
  handler,
};