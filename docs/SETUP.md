# Setup Guide

Complete guide for setting up and running the SaaS Boilerplate monorepo.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Supabase Configuration](#supabase-configuration)
6. [Running the Application](#running-the-application)
7. [Development Workflow](#development-workflow)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** 22.x or higher
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify: `node --version`

- **pnpm** 9.0.0 or higher
  - Install: `npm install -g pnpm@9.0.0`
  - Verify: `pnpm --version`

- **Git**
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify: `git --version`

### Required Accounts

- **Supabase Account**
  - Sign up at [supabase.com](https://supabase.com/)
  - Create a new project

- **PostgreSQL Database**
  - Provided by Supabase (recommended)
  - Or self-hosted PostgreSQL instance

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd saas-boilerplate-next-hono
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all dependencies for the monorepo, including:
- Root dependencies
- API app dependencies
- Web app dependencies
- All package dependencies

### 3. Verify Installation

```bash
# Check all packages are installed
pnpm list --depth=0

# Verify TypeScript
pnpm exec tsc --version
```

## Environment Configuration

### 1. Create Environment Files

The project uses environment-specific configuration files. Create them from the example:

```bash
# Copy example file
cp .env.example .env.development
```

For other environments:

```bash
cp .env.example .env.staging
cp .env.example .env.production
```

### 2. Configure Environment Variables

Edit `.env.development` with your actual values. Here's what you need:

#### Core Configuration

```env
# Environment
NODE_ENV=development

# API Server
PORT=3000
API_URL=http://localhost:3000
WEB_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### Database Configuration

You'll get these from your Supabase project dashboard:

```env
# Database URLs from Supabase
# Use Connection Pooling URL for DATABASE_URL (port 6543)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true

# Use Direct Connection URL for DIRECT_URL (port 5432)
DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Important:**
- `DATABASE_URL` uses port **6543** (PgBouncer connection pooling) - for queries
- `DIRECT_URL` uses port **5432** (direct connection) - for migrations
- Replace `[YOUR-PASSWORD]` with your database password
- Replace `[PROJECT-REF]` with your Supabase project reference

#### Supabase Configuration

From your Supabase project settings:

```env
# Supabase Project URL
SUPABASE_URL=https://[PROJECT-REF].supabase.co

# Supabase Anon Key (safe for frontend, but treat as secret)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (SERVER ONLY - never expose to frontend)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redirect URLs (adjust to your domain)
SUPABASE_EMAIL_REDIRECT_URL=http://localhost:3001/auth/verify
SUPABASE_RESET_REDIRECT_URL=http://localhost:3001/auth/reset-password
SUPABASE_OAUTH_REDIRECT_URL=http://localhost:3001/auth/callback
```

#### Security Configuration

Generate secure secrets:

```bash
# Generate JWT secret (use a strong random string)
openssl rand -base64 32

# Generate cookie secret (use a strong random string)
openssl rand -base64 32
```

Add to `.env.development`:

```env
JWT_SECRET=your-generated-jwt-secret-here
COOKIE_SECRET=your-generated-cookie-secret-here
```

#### Web App Configuration

Create `.env.local` in `apps/web/`:

```env
# API Base URL
NEXT_PUBLIC_API_URL=http://localhost:3000

# LocalStorage Keys (must be unique per app/deployment)
NEXT_PUBLIC_APP_AUTH_STORAGE_KEY=saas.auth
NEXT_PUBLIC_APP_PREFERENCES_STORAGE_KEY=saas.preferences

# Default Theme
NEXT_PUBLIC_DEFAULT_THEME=system

# Default Signup Role
NEXT_PUBLIC_DEFAULT_SIGNUP_ROLE=USER
```

## Database Setup

### 1. Generate Prisma Client

```bash
pnpm --filter @repo/database db:generate
```

This command:
- Reads the Prisma schema
- Generates the Prisma Client
- Creates TypeScript types

### 2. Run Migrations

```bash
# Create and apply initial migration
pnpm --filter @repo/database db:migrate:dev
```

This will:
- Create a migration file in `packages/database/prisma/migrations/`
- Apply the migration to your database
- Create the necessary tables

**Migration Output:**
```
✔ Generated Prisma Client
✔ Created migration: 20260209120903_initial_migration
✔ Applied migration: 20260209120903_initial_migration
```

### 3. Verify Database Schema

Open Prisma Studio to view your database:

```bash
pnpm --filter @repo/database db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View tables
- Browse data
- Edit records
- Test queries

### 4. (Optional) Seed the Database

Seed the database with initial data:

```bash
pnpm --filter @repo/database db:seed:dev
```

This runs the development seed script which may include:
- Test users
- Sample data
- Initial configuration

## Supabase Configuration

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com/)
2. Sign in or create an account
3. Click "New Project"
4. Fill in project details:
   - Name: Your project name
   - Database Password: Choose a strong password
   - Region: Choose closest region
5. Wait for project to be created (2-3 minutes)

### 2. Get Connection Strings

1. Go to **Project Settings** → **Database**
2. Find **Connection String** section
3. Copy:
   - **Connection Pooling** URL → Use for `DATABASE_URL`
   - **Direct Connection** URL → Use for `DIRECT_URL`

### 3. Get API Keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → Use for `SUPABASE_URL`
   - **anon public** key → Use for `SUPABASE_ANON_KEY`
   - **service_role** key → Use for `SUPABASE_SERVICE_ROLE_KEY`
3. Note your **Project ID** (found in Project Settings → General)

### 4. Install and Login to Supabase CLI

Install the Supabase CLI and authenticate:

```bash
# Install Supabase CLI globally (if not already installed)
pnpm add -g supabase

# Or use pnpm dlx (no global install needed)
# Login to Supabase
pnpm supabase login
```

This will:
- Open your browser for authentication
- Store your access token locally
- Allow you to generate types from your project

### 5. Generate Supabase Types

Generate TypeScript types from your Supabase database schema:

```bash
# Generate types and save to packages/types/src/types.ts
pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/types/src/types.ts
```

**Important:**
- Replace `YOUR_PROJECT_ID` with your actual Supabase project ID
- You can find your Project ID in **Project Settings** → **General**
- This command reads your database schema and generates TypeScript types
- Run this whenever your database schema changes

**Alternative:** If you're already logged in and have linked your project:

```bash
# If you've linked the project locally
pnpm dlx supabase gen types typescript --linked > packages/types/src/types.ts
```

### 6. Configure Authentication

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL**: `http://localhost:3001`
3. Add **Redirect URLs**:
   - `http://localhost:3001/auth/callback`
   - `http://localhost:3001/auth/verify`
   - `http://localhost:3001/auth/reset-password`

### 7. (Optional) Configure OAuth Providers

For Google OAuth:

1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Add **Client ID** and **Client Secret** from Google Cloud Console
4. Set **Redirect URL** in Google Console: `https://[PROJECT-REF].supabase.co/auth/v1/callback`

## Running the Application

### Development Mode

Start both API and web apps in development mode:

```bash
# From root directory
pnpm dev
```

This starts:
- **API Server**: http://localhost:3000
- **Web App**: http://localhost:3001
- **API Docs**: http://localhost:3000/docs

### Individual Apps

Start apps individually:

```bash
# Start API only
pnpm --filter api dev

# Start web only
pnpm --filter web dev
```

### Production Build

Build for production:

```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter api build
pnpm --filter web build
```

### Production Run

```bash
# Start API
pnpm --filter api start

# Start web (in another terminal)
pnpm --filter web start
```

## Development Workflow

### Making Schema Changes

1. **Edit Schema**
   ```bash
   # Edit packages/database/prisma/schema.prisma
   ```

2. **Create Migration**
   ```bash
   pnpm --filter @repo/database db:migrate:dev
   ```

3. **Regenerate Client**
   ```bash
   pnpm --filter @repo/database db:generate
   ```

4. **Update Types**
   ```bash
   # Regenerate Prisma types (auto-generated)
   pnpm --filter @repo/database db:generate
   
   # Regenerate Supabase types (if schema changed)
   pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/types/src/types.ts
   
   # Verify types
   pnpm check-types
   ```

### Adding New Routes

1. **Create Route File**
   ```bash
   # Create apps/api/src/routes/v1/your-resource/actions.ts
   ```

2. **Define Schema**
   ```typescript
   // Use @hono/zod-openapi for OpenAPI schemas
   ```

3. **Restart Dev Server**
   ```bash
   # Routes are auto-loaded on restart
   ```

### Database Operations

```bash
# View database
pnpm --filter @repo/database db:studio

# Check migration status
pnpm --filter @repo/database db:status:dev

# Reset database (⚠️ drops all data)
pnpm --filter @repo/database db:reset:dev

# Pull schema from database
pnpm --filter @repo/database db:pull

# Regenerate Supabase types after schema changes
pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/types/src/types.ts
```

### Code Quality

```bash
# Lint all code
pnpm lint

# Format code
pnpm format

# Type check
pnpm check-types
```

## Troubleshooting

### Database Connection Issues

**Problem:** Cannot connect to database

**Solutions:**
1. Verify `DATABASE_URL` and `DIRECT_URL` are correct
2. Check database password is correct
3. Verify Supabase project is active
4. Check firewall/network settings
5. Ensure using correct ports (6543 for pooling, 5432 for direct)

### Migration Errors

**Problem:** Migration fails

**Solutions:**
1. Check migration SQL for syntax errors
2. Verify database user has migration permissions
3. Check for conflicting migrations
4. Review migration history: `pnpm --filter @repo/database db:status:dev`

### Prisma Client Not Generated

**Problem:** Types not available

**Solutions:**
1. Run: `pnpm --filter @repo/database db:generate`
2. Check `schema.prisma` for syntax errors
3. Verify Prisma is installed: `pnpm list @prisma/client`

### Environment Variables Not Loading

**Problem:** Variables undefined

**Solutions:**
1. Verify file name: `.env.${NODE_ENV}` (e.g., `.env.development`)
2. Check `NODE_ENV` is set correctly
3. Restart dev server after changes
4. Verify file is in repo root (not in apps/)

### Port Already in Use

**Problem:** Port 3000 or 3001 already in use

**Solutions:**
1. Change port in `.env.development`:
   ```env
   PORT=3002  # For API
   ```
2. Or kill process using port:
   ```bash
   # Find process
   lsof -i :3000
   # Kill process
   kill -9 <PID>
   ```

### Supabase Auth Issues

**Problem:** Authentication not working

**Solutions:**
1. Verify Supabase URLs and keys are correct
2. Check redirect URLs match Supabase configuration
3. Verify OAuth providers are configured (if using)
4. Check browser console for errors
5. Verify cookies are being set (check DevTools)

### Type Errors

**Problem:** TypeScript errors

**Solutions:**
1. Regenerate Prisma client: `pnpm --filter @repo/database db:generate`
2. Regenerate Supabase types: `pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_ID > packages/types/src/types.ts`
3. Rebuild packages: `pnpm build`
4. Check TypeScript version compatibility
5. Clear node_modules and reinstall: `pnpm install`

### Supabase Type Generation Issues

**Problem:** Cannot generate Supabase types

**Solutions:**
1. Ensure you're logged in: `pnpm supabase login`
2. Verify Project ID is correct (find in Supabase dashboard → Project Settings → General)
3. Check you have access to the project
4. Verify database is accessible
5. Try using `--linked` flag if project is linked locally: `pnpm dlx supabase gen types typescript --linked > packages/types/src/types.ts`

## Next Steps

After setup is complete:

1. **Read Authentication Docs**: See [AUTH.md](./AUTH.md) for auth system details
2. **Explore API**: Visit http://localhost:3000/docs for API documentation
3. **Customize**: Start customizing the boilerplate for your needs
4. **Deploy**: Follow deployment guides for your hosting platform

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Hono Documentation](https://hono.dev/)

## Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review error messages carefully
3. Check application logs
4. Verify all prerequisites are met
5. Consult framework documentation
