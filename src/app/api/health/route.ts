import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

// One-curl diagnosis endpoint:
//
//   curl -s https://<host>/api/health | jq
//
// Returns 200 when Postgres AND Redis respond, 503 otherwise. Each check
// reports ok/latency/error so a failing dependency is obvious at a glance.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Check {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

const CHECK_TIMEOUT_MS = 3000;

// A dependency that hangs must FAIL FAST, not stall the healthcheck. Redis is
// configured with maxRetriesPerRequest: null (commands queue while it's down),
// so without this timeout a down Redis would hang the request forever.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]);
}

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const started = Date.now();
  try {
    await withTimeout(Promise.resolve().then(fn), CHECK_TIMEOUT_MS);
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const [postgres, redis] = await Promise.all([
    timed(() => db.execute(sql`SELECT 1`)),
    timed(async () => {
      const pong = await getRedis().ping();
      if (pong !== "PONG") throw new Error(`unexpected ping response: ${pong}`);
    }),
  ]);

  const ok = postgres.ok && redis.ok;
  const payload = {
    status: ok ? "ok" : "degraded",
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    env: process.env.NODE_ENV ?? "unknown",
    version: process.env.APP_VERSION ?? null,
    checks: { postgres, redis },
  };

  if (!ok) {
    logger.error("healthcheck_degraded", undefined, {
      route: "/api/health",
      postgres: postgres.ok,
      redis: redis.ok,
    });
  }

  return NextResponse.json(payload, {
    status: ok ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
