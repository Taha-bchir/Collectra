# Web - Next.js Frontend

Modern, production-ready Next.js 16 frontend application with React 19, TypeScript, and shadcn/ui components.

## 🎯 Overview

This is the frontend application for the SaaS boilerplate, featuring:

- **Next.js 16** - Latest App Router with React Server Components
- **React 19** - Latest React features and improvements
- **TypeScript** - Full type safety across the application
- **Zustand** - Lightweight state management with persistence
- **shadcn/ui** - Beautiful, accessible UI components
- **Tailwind CSS** - Utility-first styling
- **Dark Mode** - Theme support with system preference
- **Form Handling** - React Hook Form with Zod validation

## 📁 Project Structure

```
app/
├── (dashboard)/          # Protected dashboard routes
│   ├── layout.tsx        # Dashboard layout
│   ├── overview/        # Overview page
│   └── settings/         # Settings pages
│
├── (public)/             # Public routes
│   └── auth/             # Authentication pages
│       ├── login/        # Login page
│       ├── sign-up/      # Registration page
│       ├── forgot-password/ # Password reset request
│       └── ...
│
├── layout.tsx            # Root layout
├── page.tsx              # Home page
└── globals.css           # Global styles

components/
├── common/               # Common components
│   ├── navbar.tsx        # Navigation bar
│   ├── footer.tsx        # Footer
│   ├── theme-provider.tsx # Theme context
│   └── ...
│
├── ui/                   # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   └── ...
│
└── app-sidebar.tsx       # Dashboard sidebar

features/
├── auth/                 # Authentication feature
│   ├── hooks/
│   │   └── use-auth.ts   # Auth hook
│   └── services/
│       └── auth-service.ts # Auth API client
│
└── users/                # User management feature
    └── services/
        └── user-service.ts

store/                    # Zustand stores
├── auth-store.ts         # Authentication state
├── user-store.ts         # User state
└── preferences-store.ts  # User preferences

lib/
├── api-client.ts         # Axios client with auth
├── api.ts                # API utilities
├── db-types.ts           # Database types
└── utils.ts              # Utility functions

config/
├── env.ts                # Environment configuration
└── nav-config.ts         # Navigation configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 22.x or higher
- pnpm 9.0.0 or higher
- API server running (or configured API URL)

### Installation

```bash
# From root of monorepo
pnpm install
```

### Environment Setup

Create `.env.local` in `apps/web/` (or set environment variables):

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# App Configuration
NEXT_PUBLIC_APP_AUTH_STORAGE_KEY=saas.auth
NEXT_PUBLIC_APP_PREFERENCES_STORAGE_KEY=saas.preferences
NEXT_PUBLIC_DEFAULT_THEME=system
NEXT_PUBLIC_DEFAULT_SIGNUP_ROLE=USER
```

### Development Server

```bash
# Start dev server
pnpm --filter web dev

# Or from root
pnpm dev
```

The app will be available at `http://localhost:3001`

## 🎨 Features

### Authentication

Complete authentication system with:

- Email/password login
- User registration
- Password reset flow
- Google OAuth integration
- Session management with automatic token refresh
- Protected routes

See [docs/AUTH.md](../../docs/AUTH.md) for detailed authentication documentation.

### State Management

**Zustand** stores with persistence:

- `auth-store` - Authentication state (persisted to localStorage)
- `user-store` - User profile data
- `preferences-store` - User preferences (theme, etc.)

### UI Components

Built with **shadcn/ui** - copy, paste, customize:

- Buttons, Cards, Forms
- Dialogs, Dropdowns, Tooltips
- Tables, Charts, Navigation
- And many more...

All components are in `components/ui/` and can be customized as needed.

### Theme System

Dark/light mode support:

- System preference detection
- Manual theme switching
- Persistent theme preference
- Smooth transitions

### Form Handling

React Hook Form + Zod validation:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const form = useForm({
  resolver: zodResolver(schema),
})
```

## 🔧 Development

### Adding New Pages

1. Create a new file in `app/` directory:

```typescript
// app/about/page.tsx
export default function AboutPage() {
  return <div>About</div>
}
```

2. For protected routes, use the dashboard layout:

```typescript
// app/(dashboard)/about/page.tsx
export default function AboutPage() {
  return <div>About</div>
}
```

### Using Authentication

```typescript
import { useAuth } from '@/features/auth/hooks/use-auth'

export default function ProtectedPage() {
  const { isAuthenticated, profile, signOut } = useAuth()
  
  if (!isAuthenticated) {
    return <div>Please log in</div>
  }
  
  return (
    <div>
      <p>Welcome, {profile?.email}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

### Making API Calls

```typescript
import { createCookieAuthApiClient } from '@/lib/api-client'

const client = createCookieAuthApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  useCookies: true,
})

const { data } = await client.get('/api/v1/users/me')
```

### Adding UI Components

Use shadcn/ui CLI to add components:

```bash
cd apps/web
npx shadcn@latest add button
npx shadcn@latest add card
```

Or manually copy from [shadcn/ui](https://ui.shadcn.com/).

### Styling

The app uses **Tailwind CSS** for styling:

```typescript
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800">
  <h1 className="text-2xl font-bold">Title</h1>
</div>
```

## 🧪 Testing

```bash
# Run tests (when implemented)
pnpm --filter web test

# Type checking
pnpm --filter web check-types

# Linting
pnpm --filter web lint
```

## 🏗️ Building

```bash
# Build for production
pnpm --filter web build

# Output will be in .next/
```

## 🚀 Production

### Environment Variables

Set all `NEXT_PUBLIC_*` variables in your deployment platform:

- `NEXT_PUBLIC_API_URL` - Production API URL
- `NEXT_PUBLIC_APP_AUTH_STORAGE_KEY` - Unique storage key
- `NEXT_PUBLIC_APP_PREFERENCES_STORAGE_KEY` - Unique storage key
- `NEXT_PUBLIC_DEFAULT_THEME` - Default theme
- `NEXT_PUBLIC_DEFAULT_SIGNUP_ROLE` - Default signup role

### Building

```bash
pnpm --filter web build
```

### Starting Server

```bash
pnpm --filter web start
```

### Vercel Deployment

The app is configured for Vercel deployment:

1. Connect your repository
2. Set environment variables
3. Deploy automatically on push

## 📱 Responsive Design

The app is fully responsive with:

- Mobile-first approach
- Breakpoint utilities
- Touch-friendly interactions
- Responsive navigation

## ♿ Accessibility

Built with accessibility in mind:

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management

## 🎯 Performance

Optimizations included:

- Next.js Image optimization
- Code splitting
- Server Components
- Static generation where possible
- Efficient re-renders with Zustand

## 🔍 Debugging

### React DevTools

Install React DevTools browser extension for component inspection.

### Network Tab

Check API requests in browser DevTools Network tab.

### Console Logging

```typescript
console.log('Debug info', { data })
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)

## 🤝 Contributing

When adding new features:

1. Follow the existing structure
2. Use TypeScript types
3. Add proper error handling
4. Ensure accessibility
5. Test responsive design
6. Update this README if needed

## 📄 License

MIT
