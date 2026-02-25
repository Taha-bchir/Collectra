import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { AutoLoadRoute } from "hono-autoload/types";
import type { Env } from "../../../types/index.js";
import {
  deleteLoggedUserSchema,
  getLoggedUserDataSchema,
  updateLoggedUserDataSchema,
} from "../../../schema/v1/index.js";
import { UsersService } from "../../../services/users.js";
import { requireUserId, withRouteTryCatch } from '../../../utils/route-helpers.js';

const handler = new OpenAPIHono<Env>();

// Authorization middleware is autoloaded via middleware/authorization.ts
// for '/api/v1/users/*', so no explicit import is needed here.

handler.openapi(getLoggedUserDataSchema, withRouteTryCatch('users.me', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const usersService = new UsersService({ prisma });
  const data = await usersService.getLoggedUserData(userId);

  return c.json({
    data: {
      id: data.id,
      email: data.email,
      profile: {
        fullName: data.fullName ?? null,
      },
    },
  });
}));

handler.openapi(updateLoggedUserDataSchema, withRouteTryCatch('users.updateMe', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const payload = c.req.valid('json');

  const usersService = new UsersService({ prisma });
  const data = await usersService.updateLoggedUserData(userId, payload);

  return c.json({
    data: {
      id: data.id,
      email: data.email,
      profile: {
        fullName: data.fullName ?? null,
      },
    },
  });
}));

handler.openapi(deleteLoggedUserSchema, withRouteTryCatch('users.deleteMe', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const usersService = new UsersService({ prisma });
  await usersService.deleteLoggedUser(userId);

  return c.body(null, 204);
}));

const routeModule: AutoLoadRoute = {
  path: "/api/v1/users",
  handler: handler as unknown as AutoLoadRoute["handler"],
};

export default routeModule;