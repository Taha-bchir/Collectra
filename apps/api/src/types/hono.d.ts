import type { Context } from 'hono';

// Extend Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    // Already set by authorization middleware
    user?: {
      id: string;
      email: string;
      // ... other fields you set in authorization.ts
    };

    // NEW - set by tenant middleware
    currentWorkspace?: {
      id: string;
      name: string;
      // add more fields later if needed (website, createdAt, etc.)
    };

    currentUser?: {
      id: string;
      email: string;
      role: 'OWNER' | 'AGENT';
    };
  }
}