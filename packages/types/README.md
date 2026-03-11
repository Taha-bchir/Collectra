# @repo/types

Shared TypeScript types and constants used across the monorepo.

## 🎯 Overview

This package provides:

- **Database Types** - TypeScript types generated from Prisma schema
- **Shared Types** - Common type definitions
- **Constants** - Shared constants and enums
- **Type Utilities** - Helper types and utilities

## 📁 Structure

```bash
src/
├── types.ts          # Main type definitions
├── constants.ts      # Constants and enums
├── campaigns.ts      # Campaign DTOs shared by API/Web
├── workspaces.ts     # Workspace/team role & status DTOs
├── users.ts          # User profile DTOs
├── auth.ts           # Authentication request/response DTOs
├── team.ts           # Team/invitation DTOs
└── index.ts          # Package exports
```

## 🚀 Getting Started

### Installation

This package is automatically installed as a workspace dependency.

### Usage

```typescript
import type { UserRole } from '@repo/types'
import { Constants } from '@repo/types'

// Use types
const role: UserRole = 'USER'

// Use constants
const roles = Constants.public.Enums.UserRole
```

## 📝 Available Types

### Database Types

Types generated from Prisma schema:

```typescript
import type { Database } from '@repo/types'

// Table types
type User = Database['public']['Tables']['users']['Row']

// Enum types
type UserRole = Database['public']['Enums']['UserRole']
```

### Type Utilities

Helper types for working with database types:

```typescript
import type { Tables, TablesInsert, TablesUpdate, Enums } from '@repo/types'

// Get table row type
type User = Tables<'users'>

// Get insert type
type NewUser = TablesInsert<'users'>

// Get update type
type UserUpdate = TablesUpdate<'users'>

// Get enum type
type UserRole = Enums<'UserRole'>
```

## 🔧 Constants

### User Roles

```typescript
import { Constants } from '@repo/types'

const roles = Constants.public.Enums.UserRole
// ['USER', 'ADMIN', 'DEMO']
```

## 📚 Type Definitions

### Database Schema Types

The `Database` type represents the complete database schema:

```typescript
import type { Database } from '@repo/types'

type UserTable = Database['public']['Tables']['users']
type UserRow = UserTable['Row']
type UserInsert = UserTable['Insert']
type UserUpdate = UserTable['Update']
```

### Enum Types

```typescript
import type { Database } from '@repo/types'

type UserRole = Database['public']['Enums']['UserRole']
// 'USER' | 'ADMIN' | 'DEMO'
```

## 🔄 Type Generation

Database types are generated from the Prisma schema:

1. Prisma schema is defined in `@repo/database`
2. Prisma generates TypeScript types
3. Types are exported from this package

To regenerate types:

```bash
pnpm --filter @repo/database db:generate
```

## 🛠️ Development

### Adding New Types

1. Add type definitions to `src/types.ts`
2. Export from `src/index.ts`
3. Use across monorepo

### Adding Constants

1. Add constants to `src/constants.ts`
2. Export from `src/index.ts`
3. Use across monorepo

## 📦 Building

```bash
# Build TypeScript
pnpm --filter @repo/types build

# Watch mode
pnpm --filter @repo/types dev
```

## 🔍 Type Checking

Types are checked when building dependent packages:

```bash
# Check types across monorepo
pnpm check-types
```

## 📚 Usage Examples

### In API Routes

```typescript
import type { Database } from '@repo/types'

type User = Database['public']['Tables']['users']['Row']

handler.get('/users', async (c) => {
  const users: User[] = await prisma.user.findMany()
  return c.json({ data: users })
})
```

### In Frontend

```typescript
import type { UserRole } from '@repo/types'

const role: UserRole = 'USER'
```

### With Constants

```typescript
import { Constants } from '@repo/types'

const isValidRole = (role: string) => {
  return Constants.public.Enums.UserRole.includes(role as any)
}
```

## 🤝 Contributing

When adding new types:

1. Add to appropriate file (`types.ts` or `constants.ts`)
2. Export from `index.ts`
3. Document usage
4. Ensure type safety
5. Update this README if needed

## 📄 License

MIT
