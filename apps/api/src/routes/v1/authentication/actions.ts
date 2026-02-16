import { OpenAPIHono } from "@hono/zod-openapi";
import type { AutoLoadRoute } from "hono-autoload/types";
import { HTTPException } from "hono/http-exception";
import { getCookie } from "hono/cookie";
import type { AppContext, Env } from "../../../types/index.js";
import {
  forgotPasswordSchema,
  loginSchema,
  registerUserSchema,
  refreshSchema,
  resetPasswordSchema,
  logoutSchema,
  googleOAuthUrlSchema,
  googleOAuthCallbackSchema,
  googleOAuthTokensSchema,
} from "../../../schema/v1/authentication.schema.js";
import { AuthenticationService } from "../../../services/authentication.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";
import { requireUser } from "../../../utils/auth.js";
import { setAuthCookies, clearAuthCookies, AUTH_COOKIE_NAMES } from "../../../middleware/cookie.js";

const handler = new OpenAPIHono<Env>();

const emailRedirectTo = env.SUPABASE_EMAIL_REDIRECT_URL 
const resetRedirectTo = env.SUPABASE_RESET_REDIRECT_URL
const oauthRedirectTo = env.SUPABASE_OAUTH_REDIRECT_URL

const getService = (c: AppContext) => {
  const supabase = c.get("supabase");
  const prisma = c.get("prisma");

  return new AuthenticationService({
    supabase,
    prisma,
    emailRedirectTo,
    resetRedirectTo,
    oauthRedirectTo,
  });
};

const normalizeError = (error: unknown, fallbackStatus = 500) => {
  if (error instanceof HTTPException) {
    return { status: error.status, message: error.message };
  }

  if (error instanceof Error) {
    const status = (error as { status?: number }).status ?? fallbackStatus;
    return { status, message: error.message };
  }

  return { status: fallbackStatus, message: "Unexpected error" };
};

type RegisterPayload = Parameters<AuthenticationService["registerUser"]>[0];
type LoginPayload = Parameters<AuthenticationService["signIn"]>[0];
type ForgotPasswordPayload = Parameters<
  AuthenticationService["requestPasswordReset"]
>[0];
type RefreshPayload = Parameters<AuthenticationService["refreshSession"]>[0];
type ResetPasswordServicePayload = Parameters<
  AuthenticationService["resetPassword"]
>[0];

type ResetPasswordRequestBody = {
  newPassword: ResetPasswordServicePayload["newPassword"];
  confirmPassword: ResetPasswordServicePayload["newPassword"];
};

type GoogleOAuthUrlPayload = Parameters<AuthenticationService["getGoogleOAuthUrl"]>[0];
type GoogleOAuthCallbackPayload = Parameters<AuthenticationService["handleGoogleOAuthCallback"]>[0];
type GoogleOAuthTokensPayload = Parameters<AuthenticationService["handleGoogleOAuthTokens"]>[0];

handler.openapi(registerUserSchema, async (c) => {
  const payload = await c.req.json<RegisterPayload>();
  const service = getService(c);

  try {
    const result = await service.registerUser(payload);
    if (result.session) {
      setAuthCookies(c, result.session.accessToken, result.session.refreshToken, result.session.expiresIn);
    }

    return c.json(
      {
        data: {
          ...result.user,
          requiresEmailVerification: result.requiresEmailVerification,
        },
      },
      201
    );
  } catch (error) {
    logger.error({ error, scope: "auth.register" }, "Failed to register user");
    const normalized = normalizeError(error, 400);
    const isConflict = /already/i.test(normalized.message);
    const status: 400 | 409 | 500 = isConflict
      ? 409
      : normalized.status >= 500
      ? 500
      : 400;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: isConflict ? "AUTH_USER_EXISTS" : "AUTH_REGISTRATION_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(loginSchema, async (c) => {
  const payload = await c.req.json<LoginPayload>();
  const service = getService(c);

  try {
    const result = await service.signIn(payload);
    setAuthCookies(c, result.accessToken, result.refreshToken, result.expiresIn);
    return c.json({ data: result }, 200);
  } catch (error) {
    logger.warn({ error, scope: "auth.login" }, "Login failed");
    const normalized = normalizeError(error, 401);
    const status: 400 | 401 | 500 =
      normalized.status >= 500 ? 500 : normalized.status === 400 ? 400 : 401;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_LOGIN_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(forgotPasswordSchema, async (c) => {
  const payload = await c.req.json<ForgotPasswordPayload>();
  const service = getService(c);

  try {
    const result = await service.requestPasswordReset(payload);
    return c.json(result, 200);
  } catch (error) {
    logger.error({ error, scope: "auth.reset" }, "Password reset request failed");
    const normalized = normalizeError(error, 400);
    const status: 400 | 500 = normalized.status >= 500 ? 500 : 400;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_RESET_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(resetPasswordSchema, async (c) => {
  const payload = await c.req.json<ResetPasswordRequestBody>();
  const user = requireUser(c);
  const service = getService(c);

  try {
    const result = await service.resetPassword({
      userId: user.id,
      newPassword: payload.newPassword,
    });

    return c.json(result, 200);
  } catch (error) {
    logger.error({ error, scope: "auth.resetPassword" }, "Password reset failed");
    const normalized = normalizeError(error, 400);
    const status: 400 | 401 | 500 =
      normalized.status >= 500
        ? 500
        : normalized.status === 401
        ? 401
        : 400;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_RESET_PASSWORD_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(refreshSchema, async (c) => {
  const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));
  const refreshToken =
    body.refreshToken ?? getCookie(c, AUTH_COOKIE_NAMES.refreshToken) ?? null;
  if (!refreshToken) {
    return c.json(
      { error: { message: "Refresh token required", code: "AUTH_REFRESH_FAILED" } },
      401
    );
  }
  const service = getService(c);

  try {
    const result = await service.refreshSession({ refreshToken });
    setAuthCookies(c, result.accessToken, result.refreshToken, result.expiresIn);
    return c.json({ data: result }, 200);
  } catch (error) {
    logger.warn({ error, scope: "auth.refresh" }, "Token refresh failed");
    const normalized = normalizeError(error, 401);
    const status: 400 | 401 | 500 =
      normalized.status >= 500 ? 500 : normalized.status === 400 ? 400 : 401;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_REFRESH_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(logoutSchema, async (c) => {
  clearAuthCookies(c);
  return c.json({ message: "Logged out" }, 200);
});

handler.openapi(googleOAuthUrlSchema, async (c) => {
  const payload = await c.req.json<GoogleOAuthUrlPayload>();
  const service = getService(c);

  try {
    const result = await service.getGoogleOAuthUrl(payload);
    return c.json({ data: result }, 200);
  } catch (error) {
    logger.error({ error, scope: "auth.google.url" }, "Failed to generate Google OAuth URL");
    const normalized = normalizeError(error, 400);
    const status: 400 | 500 = normalized.status >= 500 ? 500 : 400;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_GOOGLE_URL_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(googleOAuthCallbackSchema, async (c) => {
  const payload = await c.req.json<GoogleOAuthCallbackPayload>();
  const service = getService(c);

  try {
    const result = await service.handleGoogleOAuthCallback(payload);
    setAuthCookies(c, result.accessToken, result.refreshToken, result.expiresIn);
    return c.json({ data: result }, 200);
  } catch (error) {
    logger.warn({ error, scope: "auth.google.callback" }, "Google OAuth callback failed");
    const normalized = normalizeError(error, 401);
    const status: 400 | 401 | 500 =
      normalized.status >= 500 ? 500 : normalized.status === 400 ? 400 : 401;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_GOOGLE_CALLBACK_FAILED",
        },
      },
      status
    );
  }
});

handler.openapi(googleOAuthTokensSchema, async (c) => {
  const payload = await c.req.json<GoogleOAuthTokensPayload>();
  const service = getService(c);

  try {
    const result = await service.handleGoogleOAuthTokens(payload);
    setAuthCookies(c, result.accessToken, result.refreshToken, result.expiresIn);
    return c.json({ data: result }, 200);
  } catch (error) {
    logger.warn({ error, scope: "auth.google.tokens" }, "Google OAuth token validation failed");
    const normalized = normalizeError(error, 401);
    const status: 400 | 401 | 500 =
      normalized.status >= 500 ? 500 : normalized.status === 400 ? 400 : 401;

    return c.json(
      {
        error: {
          message: normalized.message,
          code: "AUTH_GOOGLE_TOKENS_FAILED",
        },
      },
      status
    );
  }
});

const routeModule: AutoLoadRoute = {
  path: "/api/v1/authentication",
  handler: handler as unknown as AutoLoadRoute["handler"],
};

export default routeModule;
