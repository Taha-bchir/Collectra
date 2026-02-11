import { createRoute, z } from "@hono/zod-openapi";
import { Constants } from "@repo/types";

/**
 * Shape of the user profile returned by the API.
 * This mirrors the authentication schemas but is kept local
 * to avoid cross-schema coupling.
 */
const userProfileResponseSchema = z.object({
  fullName: z.string().nullable().optional(),
});

const userRoleSchema = z.enum(['USER', 'ADMIN', 'DEMO']);

const loggedUserResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: userRoleSchema,
    profile: userProfileResponseSchema,
  }),
});

export const getLoggedUserDataSchema = createRoute({
  method: "get",
  path: "/me",
  tags: ["users"],
  summary: "Get logged-in user data",
  description:
    "Returns basic information about the currently authenticated user, including profile fields.",
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: loggedUserResponseSchema,
        },
      },
    },
  },
});

const userIdParam = z.object({
  userId: z.string().uuid(),
});

const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});

/**
 * Update the logged-in user's profile (personal information).
 * Currently supports updating fullName.
 */
export const updateLoggedUserDataSchema = createRoute({
  method: "put",
  path: "/me",
  tags: ["users"],
  summary: "Update logged-in user profile",
  description:
    "Allows the authenticated user to update basic profile information such as full name.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            fullName: z.string().min(1).max(120).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile updated successfully",
      content: {
        "application/json": {
          schema: loggedUserResponseSchema,
        },
      },
    },
  },
});

/**
 * Delete the logged-in user's account.
 * This performs a hard delete of the user record; related data handling
 * is delegated to the underlying database constraints.
 */
export const deleteLoggedUserSchema = createRoute({
  method: "delete",
  path: "/me",
  tags: ["users"],
  summary: "Delete logged-in user account",
  description:
    "Permanently deletes the authenticated user's account. This action cannot be undone.",
  responses: {
    204: {
      description: "Account deleted successfully",
    },
  },
});