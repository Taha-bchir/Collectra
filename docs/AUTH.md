# Authentication System Documentation

Complete documentation of the authentication system from backend to frontend.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Authentication Flows](#authentication-flows)
6. [Token Management](#token-management)
7. [Security Features](#security-features)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

## Overview

The authentication system is built on **Supabase Auth** with a custom backend API layer. It provides:

- Email/password authentication
- Google OAuth integration
- Password reset flow
- Email verification
- JWT tokens with refresh mechanism
- Cookie-based session management
- Role-based access control (USER, ADMIN, DEMO)

### Key Components

- **Backend (API)**: Hono.js API with Supabase Auth integration
- **Frontend (Web)**: Next.js app with Zustand state management
- **Database**: Prisma-managed PostgreSQL (synced with Supabase Auth)
- **Tokens**: JWT access tokens + refresh tokens
- **Storage**: HTTP-only cookies (backend) + localStorage (frontend state)

## Architecture

### System Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ HTTP Request
       ▼
┌─────────────────┐
│  Next.js App    │
│  (Frontend)     │
│  - Zustand      │
│  - Axios        │
└──────┬──────────┘
       │
       │ API Call (with cookies)
       ▼
┌─────────────────┐
│  Hono API       │
│  (Backend)      │
│  - Auth Middleware│
│  - Supabase     │
└──────┬──────────┘
       │
       │ Validate Token
       ▼
┌─────────────────┐
│  Supabase Auth  │
│  - JWT Verify   │
│  - User Data    │
└──────┬──────────┘
       │
       │ Sync User
       ▼
┌─────────────────┐
│  PostgreSQL     │
│  (via Prisma)   │
│  - User Table   │
│  - Roles        │
└─────────────────┘
```

### Token Flow

```
Login/Register
    │
    ├─► Supabase Auth
    │   └─► Returns: access_token, refresh_token
    │
    ├─► Backend API
    │   └─► Sets HTTP-only cookies:
    │       - access_token (short-lived)
    │       - refresh_token (long-lived)
    │
    └─► Frontend
        └─► Stores user profile in Zustand (localStorage)
```

## Backend Implementation

### Authentication Service

Location: `apps/api/src/services/authentication.ts`

The `AuthenticationService` class handles all authentication operations:

#### Key Methods

**1. Register User**
```typescript
async registerUser(payload: RegisterPayload)
```
- Creates user in Supabase Auth
- Syncs user to Prisma database
- Returns user data with email verification status

**2. Sign In**
```typescript
async signIn(payload: LoginPayload)
```
- Validates credentials with Supabase
- Syncs user data to database
- Returns access token, refresh token, and user profile

**3. Refresh Session**
```typescript
async refreshSession(payload: RefreshPayload)
```
- Validates refresh token
- Issues new access token
- Updates user data if changed

**4. Password Reset**
```typescript
async requestPasswordReset(payload: PasswordResetPayload)
async resetPassword(payload: PasswordChangePayload)
```
- Sends password reset email
- Updates password using service role client

**5. Google OAuth**
```typescript
async getGoogleOAuthUrl(payload: GoogleOAuthPayload)
async handleGoogleOAuthCallback(payload: GoogleOAuthCallbackPayload)
async handleGoogleOAuthTokens(payload: GoogleOAuthTokenPayload)
```
- Generates OAuth URL
- Handles OAuth callback
- Exchanges tokens for session

### User Synchronization

The system maintains user data in two places:

1. **Supabase Auth** - Authentication provider
2. **PostgreSQL (via Prisma)** - Application database

**Sync Process:**
- On login/register: User is upserted to database
- Role is synced from database to Supabase `user_metadata`
- Profile fields are stored in database
- JWT contains role from `user_metadata`

**Why Sync?**
- Database is source of truth for roles
- Enables complex queries and relationships
- Allows custom user fields
- Maintains consistency

### Authorization Middleware

Location: `apps/api/src/middleware/authorization.ts`

**How it works:**

1. **Token Resolution** (priority order):
   - HTTP-only cookie: `access_token`
   - Authorization header: `Bearer <token>`

2. **Token Validation**:
   - Validates JWT with Supabase
   - Extracts user data from token
   - Attaches user to context: `c.set('user', { id, email, role })`

3. **Protected Routes**:
   - Applied to routes matching patterns in `PROTECTED_PATTERNS`
   - Returns 401 if token missing/invalid
   - Returns 403 if role insufficient (with `requireRole`)

**Protected Patterns:**
```typescript
const PROTECTED_PATTERNS = [
  '/api/v1/users/*',
  '/api/v1/authentication/reset-password',
]
```

### Cookie Management

Location: `apps/api/src/middleware/cookie.ts`

**Cookie Configuration:**
- **access_token**: Short-lived (expires based on token expiry)
- **refresh_token**: Long-lived (30 days)
- **httpOnly**: true (prevents XSS)
- **secure**: true (production only, HTTPS)
- **sameSite**: 'None' (production) / 'Lax' (development)

**Setting Cookies:**
```typescript
setAuthCookies(c, accessToken, refreshToken, expiresInSeconds)
```

**Clearing Cookies:**
```typescript
clearAuthCookies(c) // On logout
```

## Frontend Implementation

### Auth Store

Location: `apps/web/store/auth-store.ts`

**Zustand store** with persistence to localStorage:

**State:**
```typescript
{
  profile: Profile | null        // User profile
  hasHydrated: boolean            // Store hydration status
  authLoading: boolean            // Loading state
  authError: string | null        // Error messages
}
```

**Actions:**
- `signIn` - Email/password login
- `signUp` - User registration
- `signOut` - Logout
- `revalidateSession` - Refresh user data from server
- `requestPasswordReset` - Request password reset email
- `resetPassword` - Reset password with token
- `getGoogleOAuthUrl` - Get Google OAuth URL
- `handleGoogleCallback` - Handle OAuth callback
- `handleGoogleTokens` - Exchange OAuth tokens

**Persistence:**
- Only `profile` is persisted to localStorage
- On rehydration, `revalidateSession` is called to sync with server

### API Client

Location: `apps/web/lib/api-client.ts`

**Cookie-based Auth Client:**
- Uses `withCredentials: true` to send cookies
- Automatically retries on 401 with token refresh
- No tokens in JavaScript (security)

**Refresh Flow:**
1. Request fails with 401
2. Client calls refresh endpoint
3. Backend sets new cookies
4. Original request is retried

### Auth Hook

Location: `apps/web/features/auth/hooks/use-auth.ts`

**React hook** for easy auth access:

```typescript
const {
  profile,
  isAuthenticated,
  authLoading,
  authError,
  signIn,
  signUp,
  signOut,
  signInWithGoogle,
} = useAuth()
```

## Authentication Flows

### 1. Email/Password Registration

```
User fills form
    │
    ▼
Frontend: POST /api/v1/authentication/register
    │
    ▼
Backend: AuthenticationService.registerUser()
    │
    ├─► Supabase Auth: signUp()
    │   └─► Creates auth user
    │   └─► Sends verification email (if enabled)
    │
    ├─► Prisma: upsertUser()
    │   └─► Creates/updates user in database
    │
    └─► Response: { id, email, role, requiresEmailVerification }
    │
    ▼
Frontend: Updates auth store
    └─► Shows success/verification message
```

### 2. Email/Password Login

```
User fills form
    │
    ▼
Frontend: POST /api/v1/authentication/login
    │
    ▼
Backend: AuthenticationService.signIn()
    │
    ├─► Supabase Auth: signInWithPassword()
    │   └─► Validates credentials
    │   └─► Returns: session (access_token, refresh_token)
    │
    ├─► Prisma: upsertUser()
    │   └─► Syncs user to database
    │
    ├─► Supabase: updateUserMetadata()
    │   └─► Syncs role to token
    │
    ├─► setAuthCookies()
    │   └─► Sets HTTP-only cookies
    │
    └─► Response: { accessToken, refreshToken, user }
    │
    ▼
Frontend: Updates auth store
    └─► Stores profile in Zustand
    └─► Redirects to dashboard
```

### 3. Token Refresh

```
API Request with expired token
    │
    ▼
Backend: Authorization middleware
    └─► Token invalid/expired
    │
    ▼
Response: 401 Unauthorized
    │
    ▼
Frontend: Axios interceptor
    └─► Detects 401
    │
    ▼
Frontend: POST /api/v1/authentication/refresh
    │ (with refresh_token cookie)
    │
    ▼
Backend: AuthenticationService.refreshSession()
    │
    ├─► Supabase Auth: refreshSession()
    │   └─► Validates refresh token
    │   └─► Returns: new session
    │
    ├─► Prisma: upsertUser()
    │   └─► Syncs user data
    │
    ├─► setAuthCookies()
    │   └─► Sets new cookies
    │
    └─► Response: { accessToken, refreshToken, user }
    │
    ▼
Frontend: Retries original request
    └─► Request succeeds
```

### 4. Password Reset

```
User requests reset
    │
    ▼
Frontend: POST /api/v1/authentication/forgot-password
    │
    ▼
Backend: AuthenticationService.requestPasswordReset()
    │
    └─► Supabase Auth: resetPasswordForEmail()
        └─► Sends reset email
    │
    ▼
User clicks email link
    │
    ▼
Supabase redirects to: /auth/reset-password?token=...
    │
    ▼
Frontend: Extracts token from URL
    │
    ▼
Frontend: POST /api/v1/authentication/reset-password
    │ (with token in Authorization header)
    │
    ▼
Backend: AuthenticationService.resetPassword()
    │
    └─► Supabase Admin: updateUserById()
        └─► Updates password
    │
    ▼
Frontend: Shows success, redirects to login
```

### 5. Google OAuth

```
User clicks "Sign in with Google"
    │
    ▼
Frontend: POST /api/v1/authentication/google/url
    │
    ▼
Backend: AuthenticationService.getGoogleOAuthUrl()
    │
    └─► Supabase Auth: signInWithOAuth()
        └─► Returns: OAuth URL
    │
    ▼
Frontend: Redirects to Google
    │
    ▼
User authorizes on Google
    │
    ▼
Google redirects to: Supabase callback
    │
    ▼
Supabase redirects to: /auth/callback?code=...
    │
    ▼
Frontend: Extracts code from URL
    │
    ▼
Frontend: POST /api/v1/authentication/google/callback
    │
    ▼
Backend: AuthenticationService.handleGoogleOAuthCallback()
    │
    ├─► Supabase Auth: exchangeCodeForSession()
    │   └─► Exchanges code for session
    │
    ├─► Prisma: upsertUser()
    │   └─► Creates/updates user
    │
    ├─► setAuthCookies()
    │   └─► Sets cookies
    │
    └─► Response: { accessToken, refreshToken, user }
    │
    ▼
Frontend: Updates auth store
    └─► Redirects to dashboard
```

### 6. Logout

```
User clicks logout
    │
    ▼
Frontend: POST /api/v1/authentication/logout
    │
    ▼
Backend: clearAuthCookies()
    └─► Deletes cookies
    │
    ▼
Frontend: clearSession()
    └─► Clears Zustand store
    └─► Redirects to login
```

## Token Management

### Access Token

**Purpose:** Authenticate API requests

**Characteristics:**
- Short-lived (default: 1 hour)
- Contains user ID, email, role
- Stored in HTTP-only cookie
- Validated on every protected request

**Structure:**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "user_metadata": {
    "role": "USER"
  },
  "exp": 1234567890
}
```

### Refresh Token

**Purpose:** Obtain new access tokens

**Characteristics:**
- Long-lived (30 days)
- Stored in HTTP-only cookie
- Used only for refresh endpoint
- Rotated on each refresh

**Usage:**
- Automatically sent with refresh request
- Backend validates and issues new tokens
- Old refresh token is invalidated

### Token Storage

**Backend (Cookies):**
- `access_token` - HTTP-only, secure, sameSite
- `refresh_token` - HTTP-only, secure, sameSite

**Frontend (State):**
- User profile in Zustand (localStorage)
- No tokens in JavaScript (security)

## Security Features

### 1. HTTP-Only Cookies

**Benefit:** Prevents XSS attacks
- Tokens not accessible via JavaScript
- Browser automatically sends with requests
- Cannot be stolen by malicious scripts

### 2. Secure Cookies (Production)

**Benefit:** Prevents man-in-the-middle attacks
- Cookies only sent over HTTPS
- Prevents interception on insecure connections

### 3. SameSite Attribute

**Benefit:** Prevents CSRF attacks
- `Lax` in development (allows same-site)
- `None` in production (with secure flag)

### 4. Token Expiration

**Benefit:** Limits exposure window
- Short-lived access tokens
- Refresh tokens rotated regularly
- Expired tokens cannot be reused

### 5. Role Synchronization

**Benefit:** Database is source of truth
- Role changes in database sync to tokens
- Prevents privilege escalation
- Centralized role management

### 6. Input Validation

**Benefit:** Prevents injection attacks
- Zod schemas validate all inputs
- Type-safe request/response handling
- Rejects malformed requests

## API Reference

### Authentication Endpoints

#### POST /api/v1/authentication/register

Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe",
  "role": "USER"
}
```

**Response:**
```json
{
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "USER",
    "profile": {
      "fullName": "John Doe"
    },
    "requiresEmailVerification": true
  }
}
```

#### POST /api/v1/authentication/login

Sign in with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 3600,
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "role": "USER",
      "profile": {...},
      "emailConfirmed": true
    }
  }
}
```

**Cookies Set:**
- `access_token` - Access token
- `refresh_token` - Refresh token

#### POST /api/v1/authentication/refresh

Refresh access token.

**Request:** (empty body, uses refresh_token cookie)

**Response:**
```json
{
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 3600,
    "user": {...}
  }
}
```

#### POST /api/v1/authentication/logout

Sign out current user.

**Request:** (empty body)

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

**Cookies Cleared:**
- `access_token`
- `refresh_token`

#### POST /api/v1/authentication/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If an account exists for that email, a reset link is on the way."
}
```

#### POST /api/v1/authentication/reset-password

Reset password with token.

**Request:**
```json
{
  "newPassword": "newsecurepassword",
  "confirmPassword": "newsecurepassword"
}
```

**Headers:**
```
Authorization: Bearer <reset-token>
```

**Response:**
```json
{
  "message": "Password has been updated successfully."
}
```

#### POST /api/v1/authentication/google/url

Get Google OAuth URL.

**Request:**
```json
{
  "redirectTo": "http://localhost:3001/auth/callback"
}
```

**Response:**
```json
{
  "data": {
    "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
  }
}
```

#### POST /api/v1/authentication/google/callback

Handle Google OAuth callback.

**Request:**
```json
{
  "code": "oauth-code",
  "state": "optional-state"
}
```

**Response:**
```json
{
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 3600,
    "user": {...}
  }
}
```

## Troubleshooting

### Common Issues

#### 1. "Unauthorized" on Protected Routes

**Causes:**
- Token expired
- Token missing
- Invalid token

**Solutions:**
- Check cookies are being sent (`withCredentials: true`)
- Verify token is valid (check expiration)
- Try refreshing token
- Check authorization middleware is applied

#### 2. Token Refresh Fails

**Causes:**
- Refresh token expired
- Refresh token invalid
- Cookies not being sent

**Solutions:**
- User must log in again (refresh token expired)
- Check cookies are enabled
- Verify `withCredentials: true` in axios config
- Check refresh endpoint is accessible

#### 3. User Role Not Updating

**Causes:**
- Role not synced to Supabase metadata
- Token not refreshed after role change

**Solutions:**
- Update role in database
- User must log out and log back in
- Or call refresh endpoint to get new token

#### 4. OAuth Redirect Not Working

**Causes:**
- Redirect URL not configured in Supabase
- Redirect URL mismatch

**Solutions:**
- Verify redirect URL in Supabase dashboard
- Check redirect URL matches exactly
- Ensure OAuth provider is configured

#### 5. Cookies Not Being Set

**Causes:**
- CORS not configured
- SameSite/Secure settings
- Domain mismatch

**Solutions:**
- Check CORS configuration
- Verify cookie settings match environment
- Ensure same domain or proper CORS setup

### Debugging Tips

1. **Check Browser DevTools**
   - Network tab: Verify cookies in requests
   - Application tab: Check cookies are set
   - Console: Check for errors

2. **Check Backend Logs**
   - Authorization middleware logs
   - Authentication service logs
   - Error handler logs

3. **Verify Token**
   - Decode JWT at [jwt.io](https://jwt.io)
   - Check expiration time
   - Verify user data in token

4. **Test Endpoints**
   - Use API docs at `/docs`
   - Test with curl/Postman
   - Verify request/response format

## Best Practices

1. **Always use HTTPS in production**
2. **Keep tokens short-lived**
3. **Rotate refresh tokens**
4. **Validate all inputs**
5. **Use HTTP-only cookies**
6. **Sync roles from database**
7. **Handle errors gracefully**
8. **Log security events**
9. **Monitor token usage**
10. **Regular security audits**

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
