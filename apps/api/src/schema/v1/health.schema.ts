import { createRoute, z } from "@hono/zod-openapi";

const dependencySchema = z.object({
  status: z.enum(["healthy", "unhealthy"]),
  latency: z.number().optional(),
  error: z.string().optional(),
});

export const healthSchema = createRoute({
    method: "get",
    path: "/",
    tags: ["Health"],
    summary: "API v1 health probe",
    description:
      "Returns the health/status payload consumed by monitoring tools. Tests actual connectivity to dependencies.",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": {
            schema: z.object({
              status: z.enum(["ok", "degraded"]),
              version: z.string(),
              timestamp: z.string(),
              uptime: z.number(),
              dependencies: z.object({
                database: dependencySchema,
                supabase: dependencySchema,
              }),
            }),
          },
        },
      },
      503: {
        description: "Service is degraded or unhealthy",
        content: {
          "application/json": {
            schema: z.object({
              status: z.enum(["ok", "degraded"]),
              version: z.string(),
              timestamp: z.string(),
              uptime: z.number(),
              dependencies: z.object({
                database: dependencySchema,
                supabase: dependencySchema,
              }),
            }),
          },
        },
      },
    },
  });