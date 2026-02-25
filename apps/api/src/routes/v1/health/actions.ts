import { OpenAPIHono } from "@hono/zod-openapi";
import type { AutoLoadRoute } from "hono-autoload/types";
import type { Env } from "../../../types/index.js";
import { healthSchema } from "../../../schema/v1/index.js";
import { logger } from "../../../utils/logger.js";
import { withRouteTryCatch } from '../../../utils/route-helpers.js';

const handler = new OpenAPIHono<Env>();

// Health check with actual connectivity tests
handler.openapi(healthSchema, withRouteTryCatch('health.v1', async (c) => {
  const supabase = c.get("supabase");
  const prisma = c.get("prisma");
  const requestId = c.get("requestId");

  const dependencies: {
    database: { status: "healthy" | "unhealthy"; latency?: number; error?: string };
    supabase: { status: "healthy" | "unhealthy"; latency?: number; error?: string };
  } = {
    database: { status: "unhealthy" },
    supabase: { status: "unhealthy" },
  };

  // Test database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    dependencies.database = {
      status: "healthy",
      latency: dbLatency,
    };
  } catch (error) {
    logger.error(
      { error, requestId },
      "Database health check failed"
    );
    dependencies.database = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Test Supabase connectivity (auth API)
  try {
    const supabaseStart = Date.now();
    // Simple API call to verify Supabase is reachable
    const { error } = await supabase.auth.getSession();
    const supabaseLatency = Date.now() - supabaseStart;
    
    // Even if there's no session (which is expected), if we get a response, it's healthy
    dependencies.supabase = {
      status: "healthy",
      latency: supabaseLatency,
    };
  } catch (error) {
    logger.error(
      { error, requestId },
      "Supabase health check failed"
    );
    dependencies.supabase = {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  // Determine overall status
  const allHealthy =
    dependencies.database.status === "healthy" &&
    dependencies.supabase.status === "healthy";

  const statusCode = allHealthy ? 200 : 503;

  return c.json(
    {
      status: allHealthy ? ("ok" as const) : ("degraded" as const),
      version: "v1",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies,
    },
    statusCode
  );
}));

const routeModule: AutoLoadRoute = {
  path: "/api/v1/health",
  handler: handler as unknown as AutoLoadRoute["handler"],
};

export default routeModule;
