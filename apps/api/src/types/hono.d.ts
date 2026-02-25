import type { Context } from 'hono';

// Extend Hono's context variables
declare module 'hono' {
  interface ContextVariableMap {
    // Set by authorization middleware
    user?: {
      id: string;
      email?: string;
      // ... other fields you set in authorization.ts
    };

    // Set by tenant-aware authorization middleware
    currentWorkspace?: {
      id: string;
      name: string;
      // add more fields later if needed (website, createdAt, etc.)
    };

    currentUser?: {
      id: string;
      email?: string;
      role: 'OWNER' | 'AGENT';
    };
  }
}