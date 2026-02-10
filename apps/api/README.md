# API - Hono.js Backend

Production-ready REST API built with Hono.js, Supabase Auth, and Prisma ORM.

## 🎯 Overview

This API provides a complete backend solution for the SaaS boilerplate, featuring:

- **Fast & Lightweight** - Built on Hono.js for optimal performance
- **Type-Safe** - Full TypeScript with Zod validation
- **Secure** - JWT authentication with Supabase Auth
- **Documented** - Auto-generated OpenAPI/Swagger documentation
- **Scalable** - Middleware-based architecture with autoloading routes

## 📁 Project Structure

```
src/
├── config/           # Configuration (env, etc.)
│   └── env.ts        # Environment variable validation
│
├── middleware/       # Request middleware
│   ├── authorization.ts    # JWT auth middleware
│   ├── autoloader.ts        # Route and middleware autoloading
│   ├── cookie.ts            # Cookie management
│   ├── cors.ts              # CORS configuration
│   ├── error-handler.ts     # Error handling
│   ├── swagger.ts           # OpenAPI setup
│   └── ...                  # Other middleware
│
├── routes/           # API route handlers
│   └── v1/
│       ├── authentication/  # Auth endpoints
│       ├── users/           # User management
│       └── health/          # Health checks
│
├── services/        # Business logic
│   ├── authentication.ts    # Auth service
│   └── users.ts             # User service
│
├── schema/          # Zod validation schemas
│   └── v1/
│       ├── authentication.schema.ts
│       └── users.schema.ts
│
├── utils/           # Utility functions
│   ├── auth.ts             # Auth helpers
│   └── logger.ts           # Logging utilities
│
├── lib/             # External service clients
│   ├── prisma.ts           # Prisma client
│   └── supabase.ts         # Supabase client
│
├── types/           # TypeScript types
│   └── index.ts
│
├── locales/         # i18n translation files
│   └── en/
│
├── app.ts           # Main app setup
└── server.ts        # Server entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js 22.x or higher
- pnpm 9.0.0 or higher
- PostgreSQL database (via Supabase)
- Supabase project configured

### Installation

```bash
# From root of monorepo
pnpm install
```

### Environment Setup

The API loads environment variables from `.env.${NODE_ENV}` in the repo root.

Required variables (see `.env.example` for full list):

```env
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
API_URL=http://localhost:3000
WEB_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001
```

### Database Setup

```bash
# Generate Prisma client
pnpm --filter @repo/database db:generate

# Run migrations
pnpm --filter @repo/database db:migrate:dev

# (Optional) Seed database
pnpm --filter @repo/database db:seed:dev
```

### Development Server

```bash
# Start dev server with hot reload
pnpm --filter api dev

# Or from root
pnpm dev
```

The API will be available at `http://localhost:3000`

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/authentication/register` | Register new user | No |
| POST | `/api/v1/authentication/login` | Sign in | No |
| POST | `/api/v1/authentication/logout` | Sign out | No |
| POST | `/api/v1/authentication/refresh` | Refresh access token | No |
| POST | `/api/v1/authentication/forgot-password` | Request password reset | No |
| POST | `/api/v1/authentication/reset-password` | Reset password | Yes |
| POST | `/api/v1/authentication/google/url` | Get Google OAuth URL | No |
| POST | `/api/v1/authentication/google/callback` | Handle OAuth callback | No |
| POST | `/api/v1/authentication/google/tokens` | Exchange OAuth tokens | No |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/users/me` | Get current user | Yes |

### Health

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/health` | Health check | No |
| GET | `/api/v2/health` | Health check (v2) | No |

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/docs` | Swagger UI documentation |
| GET | `/openapi.json` | OpenAPI specification |

## 🔧 Development

### Adding New Routes

The API uses **autoloading** - routes are automatically discovered from the `src/routes/` directory.

#### Step-by-Step Guide

1. **Create route file** in `src/routes/v1/your-resource/actions.ts`

2. **Define OpenAPI schema** using `@hono/zod-openapi`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { AutoLoadRoute } from 'hono-autoload/types'
import type { Env } from '../../../types/index.js'

const handler = new OpenAPIHono<Env>()

const getResource = createRoute({
  method: 'get',
  path: '/',
  tags: ['YourResource'],
  summary: 'Get resource',
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(z.object({
              id: z.string(),
              name: z.string(),
            })),
          }),
        },
      },
    },
  },
})

handler.openapi(getResource, async (c) => {
  const prisma = c.get('prisma')
  const data = await prisma.yourModel.findMany()
  return c.json({ data })
})

export default {
  path: '/api/v1/your-resource',
  handler,
} satisfies AutoLoadRoute
```

3. **Add authentication** if needed:

```typescript
import { authorization } from '../../../middleware/authorization.js'

// Apply to all routes in handler
handler.use('*', authorization)

// Or use requireRole for specific roles
import { requireRole } from '../../../middleware/authorization.js'
handler.get('/admin', requireRole(['ADMIN']), async (c) => {
  // Admin-only route
})
```

4. **Restart dev server** - routes are auto-discovered on startup

### Using Services

Services are injected into the Hono context:

```typescript
handler.openapi(route, async (c) => {
  // Get services from context
  const prisma = c.get('prisma')
  const supabase = c.get('supabase')
  
  // Use them
  const user = await prisma.user.findUnique({ where: { id: '...' } })
})
```

### Error Handling

Errors are automatically handled by the error middleware. Use HTTPException for custom errors:

```typescript
import { HTTPException } from 'hono/http-exception'

if (!resource) {
  throw new HTTPException(404, { message: 'Resource not found' })
}
```

### Request Validation

All routes use Zod schemas for validation:

```typescript
const createResource = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1),
            email: z.string().email(),
          }),
        },
      },
    },
  },
  // ...
})
```

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm --filter api test

# Type checking
pnpm --filter api check-types

# Linting
pnpm --filter api lint
```

## 🏗️ Building

```bash
# Build for production
pnpm --filter api build

# Output will be in dist/
```

## 🚀 Production

### Environment Variables

Ensure all required environment variables are set:

- `NODE_ENV=production`
- `API_URL` - Public API URL
- `WEB_URL` - Public web app URL
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- Database URLs
- Supabase credentials
- Security secrets (JWT_SECRET, COOKIE_SECRET)

### Running Migrations

```bash
pnpm --filter @repo/database db:migrate:prod
```

### Starting Server

```bash
pnpm --filter api start
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **HTTP-only Cookies** - Prevents XSS attacks
- **CORS Protection** - Configurable allowed origins
- **Rate Limiting** - Prevents abuse
- **Helmet** - Security headers
- **Input Validation** - Zod schemas for all inputs
- **Error Sanitization** - Prevents information leakage

## 📊 Middleware Stack

The API includes a comprehensive middleware stack:

1. **Services** - Inject Prisma, Supabase clients
2. **Request ID** - Unique ID for each request
3. **CORS** - Cross-origin resource sharing
4. **Compression** - Response compression
5. **Cookie Parsing** - Cookie handling
6. **Body Parsing** - JSON, form, multipart
7. **Authorization** - JWT validation (on protected routes)
8. **Error Handling** - Centralized error handling
9. **Logging** - Request/response logging

## 🌐 Internationalization

The API supports i18n via i18next:

```typescript
import { t } from 'i18next'

const message = t('common:error.notFound')
```

Translation files are in `src/locales/`.

## 📝 Logging

Structured logging with Pino:

```typescript
import { logger } from '../utils/logger.js'

logger.info({ userId: '123' }, 'User action')
logger.error({ err }, 'Error occurred')
```

## 🔍 Debugging

Enable debug logging:

```bash
DEBUG=* pnpm --filter api dev
```

## 📚 Additional Resources

- [Hono.js Documentation](https://hono.dev/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)

## 🤝 Contributing

When adding new features:

1. Follow the existing route structure
2. Add OpenAPI schemas for all endpoints
3. Write tests for new functionality
4. Update this README if needed
5. Ensure type safety throughout

## 📄 License

MIT
