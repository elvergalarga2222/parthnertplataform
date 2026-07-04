import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getRedis } from "@/lib/redis";

// Regla #1: la sesión vive en Redis y es revocable al instante (nunca JWT
// stateless como sesión primaria). El id de sesión va en una cookie httpOnly;
// el mapeo id -> partnerId vive en Redis con TTL.
const COOKIE_NAME = "pm_session";
const REDIS_PREFIX = "session:";
// Índice inverso partner -> sus sesiones, para poder revocar todas al congelar.
const PARTNER_SESSIONS_PREFIX = "partner_sessions:";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export async function createSession(partnerId: string): Promise<string> {
  const sessionId = randomUUID();
  const redis = getRedis();

  await redis
    .multi()
    .set(`${REDIS_PREFIX}${sessionId}`, partnerId, "EX", TTL_SECONDS)
    .sadd(`${PARTNER_SESSIONS_PREFIX}${partnerId}`, sessionId)
    .exec();

  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });

  return sessionId;
}

/** Devuelve el partnerId de la sesión actual, o null si no hay sesión válida. */
export async function getSessionPartnerId(): Promise<string | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const partnerId = await getRedis().get(`${REDIS_PREFIX}${sessionId}`);
  return partnerId;
}

/** Cierra la sesión actual (logout) y limpia la cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;

  if (sessionId) {
    const partnerId = await getRedis().get(`${REDIS_PREFIX}${sessionId}`);
    const pipeline = getRedis().multi().del(`${REDIS_PREFIX}${sessionId}`);
    if (partnerId) {
      pipeline.srem(`${PARTNER_SESSIONS_PREFIX}${partnerId}`, sessionId);
    }
    await pipeline.exec();
  }

  store.delete(COOKIE_NAME);
}

/**
 * Revoca TODAS las sesiones de un partner (usado al congelar — regla #2).
 * No borra datos, solo invalida el acceso vivo.
 */
export async function revokeAllSessions(partnerId: string): Promise<void> {
  const redis = getRedis();
  const key = `${PARTNER_SESSIONS_PREFIX}${partnerId}`;
  const sessionIds = await redis.smembers(key);
  if (sessionIds.length === 0) return;

  const pipeline = redis.multi();
  for (const id of sessionIds) {
    pipeline.del(`${REDIS_PREFIX}${id}`);
  }
  pipeline.del(key);
  await pipeline.exec();
}
