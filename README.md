# Collectra - Next.js + Hono Monorepo

A production-ready, full-stack Collectra built with Next.js, Hono, Supabase, and Prisma. This monorepo provides a complete foundation for building modern SaaS applications with authentication, authorization, database management, and more.

## 🏗️ Architecture

This is a **Turborepo monorepo** containing:

- **`apps/api`** - Hono.js REST API backend with Supabase Auth
- **`apps/web`** - Next.js 16 frontend application
- **`packages/database`** - Prisma schema and database utilities
- **`packages/types`** - Shared TypeScript types and constants
- **`packages/eslint-config`** - Shared ESLint configurations
- **`packages/typescript-config`** - Shared TypeScript configurations

## ✨ Features

### Backend (API)

- ✅ **Hono.js** - Fast, lightweight web framework
- ✅ **Supabase Auth** - Complete authentication system (email/password, OAuth)
- ✅ **Prisma ORM** - Type-safe database access
- ✅ **OpenAPI/Swagger** - Auto-generated API documentation
- ✅ **JWT Authentication** - Secure token-based auth with refresh tokens
- ✅ **Cookie-based Sessions** - HTTP-only cookies for security
- ✅ **Middleware Stack** - CORS, compression, rate limiting, error handling
- ✅ **i18n Support** - Internationalization with i18next
- ✅ **Request Logging** - Structured logging with Pino

### Frontend (Web)

- ✅ **Next.js 16** - React framework with App Router
- ✅ **React 19** - Latest React features
- ✅ **TypeScript** - Full type safety
- ✅ **Zustand** - State management with persistence
- ✅ **Axios** - HTTP client with automatic token refresh
- ✅ **shadcn/ui** - Beautiful, accessible UI components
- ✅ **Tailwind CSS** - Utility-first CSS framework
- ✅ **Theme Support** - Dark/light mode with system preference
- ✅ **Form Handling** - React Hook Form with Zod validation

### Database & Types

- ✅ **Prisma** - Database schema management
- ✅ **PostgreSQL** - Via Supabase
- ✅ **Type Generation** - Auto-generated types from database schema
- ✅ **Migrations** - Version-controlled database changes
- ✅ **Seeding** - Environment-specific seed data

## 📋 Prerequisites

- **Node.js** 22.x or higher
- **pnpm** 9.0.0 or higher (package manager)
- **PostgreSQL** database (via Supabase or self-hosted)
- **Supabase** account (for authentication and storage)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd saas-boilerplate-next-hono
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env.development
```

Edit `.env.development` with your actual values. See [docs/SETUP.md](./docs/SETUP.md) for detailed setup instructions.

### 4. Set Up Database

```bash
# Generate Prisma client
pnpm --filter @repo/database db:generate

# Run migrations
pnpm --filter @repo/database db:migrate:dev

# (Optional) Seed the database
pnpm --filter @repo/database db:seed:dev
```

### 5. Start Development Servers

```bash
# Start both API and web apps
pnpm dev
```

- **API**: <http://localhost:3000>
- **Web**: <http://localhost:3001>
- **API Docs**: <http://localhost:3000/docs>

## 📁 Project Structure

```bach
.
├── apps/
│   ├── api/              # Hono.js backend API
│   │   ├── src/
│   │   │   ├── config/    # Configuration (env, etc.)
│   │   │   ├── middleware/ # Request middleware
│   │   │   ├── routes/    # API route handlers
│   │   │   ├── services/  # Business logic
│   │   │   ├── schema/    # Zod validation schemas
│   │   │   ├── utils/     # Utility functions
│   │   │   └── lib/       # External service clients
│   │   └── package.json
│   │
│   └── web/               # Next.js frontend
│       ├── app/           # Next.js App Router pages
│       ├── components/    # React components
│       ├── features/      # Feature modules
│       ├── store/         # Zustand stores
│       ├── lib/           # Utilities and helpers
│       └── package.json
│
├── packages/
│   ├── database/         # Prisma schema and client
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │
│   ├── types/            # Shared TypeScript types
│   │   └── src/
│   │
│   ├── eslint-config/    # Shared ESLint configs
│   │
│   └── typescript-config/ # Shared TypeScript configs
│
├── docs/                 # Documentation
│   ├── SETUP.md         # Detailed setup guide
│   └── AUTH.md          # Authentication system docs
│
├── turbo.json           # Turborepo configuration
├── pnpm-workspace.yaml  # pnpm workspace config
└── package.json         # Root package.json
```

## 🛠️ Available Scripts

### Root Level

```bash
# Development
pnpm dev              # Start all apps in development mode

# Building
pnpm build            # Build all apps and packages

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format code with Prettier
pnpm check-types       # Type-check all packages

# Database (from root)
pnpm --filter @repo/database db:migrate:dev    # Run migrations
pnpm --filter @repo/database db:generate       # Generate Prisma client
pnpm --filter @repo/database db:seed:dev       # Seed database
pnpm --filter @repo/database db:studio         # Open Prisma Studio
```

### API App (`apps/api`)

```bash
pnpm --filter api dev      # Start API dev server
pnpm --filter api build    # Build API
pnpm --filter api start    # Start production server
```

### Web App (`apps/web`)

```bash
pnpm --filter web dev      # Start Next.js dev server
pnpm --filter web build    # Build Next.js app
pnpm --filter web start    # Start production server
```

## 🔐 Authentication System

This boilerplate includes a complete authentication system built on Supabase Auth. Features include:

- Email/password authentication
- Google OAuth integration
- Password reset flow
- Email verification
- JWT tokens with refresh mechanism
- Cookie-based session management
- Role-based access control (USER, ADMIN, DEMO)

See [docs/AUTH.md](./docs/AUTH.md) for comprehensive documentation on how the authentication system works.

## 📚 Documentation

- **[Docs Index](./docs/README.md)** - Central index for all project documentation
- **[Setup Guide](./docs/SETUP.md)** - Detailed instructions for setting up the project
- **[Authentication System](./docs/AUTH.md)** - Complete auth system documentation
- **[Campaigns CSV Import](./docs/CAMPAIGNS_CSV_IMPORT.md)** - CSV import format, API endpoints, and dashboard behavior
- **[API README](./apps/api/README.md)** - API-specific documentation
- **[Web README](./apps/web/README.md)** - Frontend-specific documentation

## 📝 Changelog (2026-02-27)

- **[Debt Personal Link Security](./docs/DEBT_PERSONAL_LINK_SECURITY.md)** - Updated token format, generation rules, backend-only workspace enforcement, and smoke test coverage (`test:tenant-auth`, `test:token-workspace`).
- **[API Refactor Summary](./docs/API_REFACTOR_SUMMARY_2026-02-25.md)** - Synced with current backend behavior (workspace cookie + membership fallback, no header override) and added token/workspace test updates.

## 🧩 Packages

### `@repo/database`

Prisma-based database package with schema, migrations, and client generation.

**Key Features:**

- Type-safe database access
- Migration management
- Environment-specific seeding
- Prisma Studio integration

See [packages/database/README.md](./packages/database/README.md) for details.

### `@repo/types`

Shared TypeScript types and constants used across the monorepo.

**Exports:**

- Database types (from Prisma)
- User roles and enums
- Common type definitions

See [packages/types/README.md](./packages/types/README.md) for details.

### `@repo/eslint-config`

Shared ESLint configurations for consistent code quality.

**Configs:**

- Base configuration
- Next.js specific
- React internal

See [packages/eslint-config/README.md](./packages/eslint-config/README.md) for details.

### `@repo/typescript-config`

Shared TypeScript configurations for consistent type checking.

**Configs:**

- Base TypeScript config
- Next.js config
- Node.js config
- React library config

See [packages/typescript-config/README.md](./packages/typescript-config/README.md) for details.

## 🔧 Configuration

### Environment Variables

The project uses environment-specific configuration files:

- `.env.development` - Development environment
- `.env.staging` - Staging environment
- `.env.production` - Production environment

See `.env.example` for all available variables and their descriptions.

### Turborepo

Build orchestration and caching is handled by Turborepo. Configuration is in `turbo.json`.

### pnpm Workspaces

Package management and workspace configuration is handled by pnpm. See `pnpm-workspace.yaml`.

## 🚢 Deployment

### API Deployment

1. Set all required environment variables
2. Build the API: `pnpm --filter api build`
3. Run migrations: `pnpm --filter @repo/database db:migrate:prod`
4. Start the server: `pnpm --filter api start`

### Web Deployment

1. Set all `NEXT_PUBLIC_*` environment variables
2. Build the app: `pnpm --filter web build`
3. Start the server: `pnpm --filter web start`

For Vercel deployment, the build process is handled automatically.

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and type checking: `pnpm lint && pnpm check-types`
4. Commit using conventional commits: `pnpm commit`
5. Push and create a pull request

## 📝 License

MIT

## 🙏 Acknowledgments

- [Hono](https://hono.dev/) - Fast web framework
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend as a service
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Turborepo](https://turbo.build/) - Monorepo build system
- [shadcn/ui](https://ui.shadcn.com/) - UI components
