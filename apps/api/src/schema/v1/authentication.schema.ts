import { createRoute, z } from "@hono/zod-openapi";
import { Constants } from "@repo/types";

const userRoleEnum = z.enum(Constants.public.Enums.UserRole);

const authErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});

const authTokensResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().positive(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: userRoleEnum,
    emailConfirmed: z.boolean(),
  }),
});

export const registerUserSchema = createRoute({
  method: "post",
  path: "/register",
  tags: ["Authentication"],
  summary: "Register a new user",
  description:
    "Creates a Supabase auth user, persists the profile in the database, and sends a verification email.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email().openapi({ example: "user@collectra.com" }),
            password: z.string().min(8).max(72).openapi({ example: "password123" }),
            role: userRoleEnum.optional().openapi({ example: "USER" }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "User registered. Verification email sent when required.",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              email: z.string().email(),
              role: userRoleEnum,
              requiresEmailVerification: z.boolean(),
            }),
          }),
        },
      },
    },
    400: {
      description: "Validation or Supabase error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    409: {
      description: "User already exists",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const loginSchema = createRoute({
  method: "post",
  path: "/login",
  tags: ["Authentication"],
  summary: "Sign in with email and password",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email().openapi({ example: "user@collectra.com" }),
            password: z.string().min(8).openapi({ example: "password123" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "User authenticated",
      content: {
        "application/json": {
          schema: z.object({
            data: authTokensResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Invalid credentials",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const refreshSchema = createRoute({
  method: "post",
  path: "/refresh",
  tags: ["Authentication"],
  summary: "Refresh access token using refresh token (cookie or body)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            refreshToken: z.string().min(1).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tokens refreshed",
      content: {
        "application/json": {
          schema: z.object({
            data: authTokensResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Invalid request or refresh token",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized / invalid refresh token",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const forgotPasswordSchema = createRoute({
  method: "post",
  path: "/forgot-password",
  tags: ["Authentication"],
  summary: "Trigger password reset email",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reset email dispatched",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Invalid email",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const resetPasswordSchema = createRoute({
  method: "post",
  path: "/reset-password",
  tags: ["Authentication"],
  summary: "Reset password for the currently authenticated user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z
            .object({
              newPassword: z.string().min(8).max(72),
              confirmPassword: z.string().min(8).max(72),
            })
            .refine((data) => data.newPassword === data.confirmPassword, {
              message: "Passwords do not match",
              path: ["confirmPassword"],
            }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Password successfully reset",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: "Invalid request",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized / missing or invalid token",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const logoutSchema = createRoute({
  method: "post",
  path: "/logout",
  tags: ["Authentication"],
  summary: "Clear auth cookies (logout)",
  request: {},
  responses: {
    200: {
      description: "Logged out",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const googleOAuthUrlSchema = createRoute({
  method: "post",
  path: "/google/url",
  tags: ["Authentication"],
  summary: "Get Google OAuth URL for signup/login",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            redirectTo: z.string().url().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "OAuth URL generated",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              url: z.string().url(),
            }),
          }),
        },
      },
    },
    400: {
      description: "Invalid request or OAuth redirect URL not configured",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const googleOAuthCallbackSchema = createRoute({
  method: "post",
  path: "/google/callback",
  tags: ["Authentication"],
  summary: "Handle Google OAuth callback and authenticate user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.string().min(1),
            state: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "User authenticated via Google OAuth",
      content: {
        "application/json": {
          schema: z.object({
            data: authTokensResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Invalid OAuth code",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    401: {
      description: "OAuth authentication failed",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});

export const googleOAuthTokensSchema = createRoute({
  method: "post",
  path: "/google/tokens",
  tags: ["Authentication"],
  summary: "Validate Google OAuth tokens and authenticate user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            accessToken: z.string().min(1),
            refreshToken: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "User authenticated via Google OAuth tokens",
      content: {
        "application/json": {
          schema: z.object({
            data: authTokensResponseSchema,
          }),
        },
      },
    },
    400: {
      description: "Invalid tokens",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    401: {
      description: "Token validation failed",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
    500: {
      description: "Unexpected error",
      content: {
        "application/json": {
          schema: authErrorSchema,
        },
      },
    },
  },
});