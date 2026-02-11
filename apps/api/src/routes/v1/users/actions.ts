import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { AutoLoadRoute } from "hono-autoload/types";
import type { Env } from "../../../types/index.js";
import {
  deleteLoggedUserSchema,
  getLoggedUserDataSchema,
  updateLoggedUserDataSchema,
} from "../../../schema/v1/users.schema.js";
import { UsersService } from "../../../services/users.js";

const handler = new OpenAPIHono<Env>();

// Authorization middleware is autoloaded via middleware/authorization.ts
// for '/api/v1/users/*', so no explicit import is needed here.

handler.openapi(getLoggedUserDataSchema, async (c) => {
  const prisma = c.get("prisma");
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  try {
    const usersService = new UsersService({ prisma });
    const data = await usersService.getLoggedUserData(user.id);

    return c.json({
      data: {
        id: data.id,
        email: data.email,
        role: user.role ?? 'USER',
        profile: {
          fullName: data.fullName ?? null,
        },
      },
    });
  } catch (err) {
    throw new HTTPException(500, {
      message: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

handler.openapi(updateLoggedUserDataSchema, async (c) => {
  const prisma = c.get("prisma");
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const payload = await c.req.json<{
    fullName?: string;
  }>();

  try {
    const usersService = new UsersService({ prisma });
    const data = await usersService.updateLoggedUserData(user.id, payload);

    return c.json({
      data: {
        id: data.id,
        email: data.email,
        role: user.role ?? 'USER',
        profile: {
          fullName: data.fullName ?? null,
        },
      },
    });
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err;
    }

    throw new HTTPException(500, {
      message: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

handler.openapi(deleteLoggedUserSchema, async (c) => {
  const prisma = c.get("prisma");
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  try {
    const usersService = new UsersService({ prisma });
    await usersService.deleteLoggedUser(user.id);

    return c.body(null, 204);
  } catch (err) {
    throw new HTTPException(500, {
      message: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

const routeModule: AutoLoadRoute = {
  path: "/api/v1/users",
  handler: handler as unknown as AutoLoadRoute["handler"],
};

export default routeModule;