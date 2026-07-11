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
// Índice inverso colaborador -> sus sesiones, para poder revocar SOLO las
// suyas al desactivarlo (sin tocar las del partner ni las de otros colaboradores).
const COLLAB_SESSIONS_PREFIX = "collab_sessions:";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

/**
 * Crea una sesión. `collaboratorId` ausente = sesión del propio partner
 * (formato de valor plano, compatible con sesiones viejas). Con
 * `collaboratorId`, el valor se guarda como JSON `{"p":...,"c":...}` — ver
 * `parseSessionValue` — y además se indexa en `collab_sessions:*`. Ambas
 * comparten el mismo índice `partner_sessions:*`, así que
 * `revokeAllSessions(partnerId)` cubre también las de sus colaboradores sin
 * cambios (PR-8 §3).
 */
export async function createSession(
  partnerId: string,
  collaboratorId?: string,
): Promise<string> {
  const sessionId = randomUUID();
  const redis = getRedis();
  const value = collaboratorId
    ? JSON.stringify({ p: partnerId, c: collaboratorId })
    : partnerId;

  const pipeline = redis
    .multi()
    .set(`${REDIS_PREFIX}${sessionId}`, value, "EX", TTL_SECONDS)
    .sadd(`${PARTNER_SESSIONS_PREFIX}${partnerId}`, sessionId);
  if (collaboratorId) {
    pipeline.sadd(`${COLLAB_SESSIONS_PREFIX}${collaboratorId}`, sessionId);
  }
  await pipeline.exec();

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

/** Sesión de un colaborador — mismo mecanismo, solo cambia el valor guardado. */
export async function createCollaboratorSession(
  partnerId: string,
  collaboratorId: string,
): Promise<string> {
  return createSession(partnerId, collaboratorId);
}

export interface SessionActor {
  partnerId: string;
  collaboratorId: string | null;
}

/**
 * `partner_id` plano (sesiones creadas antes de PR-8) o JSON `{p,c}`
 * (colaborador). Si el parseo JSON falla, se asume el formato viejo — así
 * ninguna sesión existente se invalida en el deploy de PR-8. Exportada para
 * test unitario directo (PR-8 criterio de aceptación 9).
 */
export function parseSessionValue(raw: string): SessionActor {
  try {
    const parsed = JSON.parse(raw) as { p?: unknown; c?: unknown };
    if (parsed && typeof parsed.p === "string") {
      return {
        partnerId: parsed.p,
        collaboratorId: typeof parsed.c === "string" ? parsed.c : null,
      };
    }
  } catch {
    // No es JSON: formato viejo, `raw` es el partnerId tal cual.
  }
  return { partnerId: raw, collaboratorId: null };
}

/** Actor (partner + colaborador opcional) de la sesión actual, o null. */
export async function getSessionActor(): Promise<SessionActor | null> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const raw = await getRedis().get(`${REDIS_PREFIX}${sessionId}`);
  if (!raw) return null;
  return parseSessionValue(raw);
}

/** Devuelve el partnerId de la sesión actual, o null si no hay sesión válida. */
export async function getSessionPartnerId(): Promise<string | null> {
  const actor = await getSessionActor();
  return actor?.partnerId ?? null;
}

/** Cierra la sesión actual (logout) y limpia la cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(COOKIE_NAME)?.value;

  if (sessionId) {
    const raw = await getRedis().get(`${REDIS_PREFIX}${sessionId}`);
    const pipeline = getRedis().multi().del(`${REDIS_PREFIX}${sessionId}`);
    if (raw) {
      const { partnerId, collaboratorId } = parseSessionValue(raw);
      pipeline.srem(`${PARTNER_SESSIONS_PREFIX}${partnerId}`, sessionId);
      if (collaboratorId) {
        pipeline.srem(`${COLLAB_SESSIONS_PREFIX}${collaboratorId}`, sessionId);
      }
    }
    await pipeline.exec();
  }

  store.delete(COOKIE_NAME);
}

/**
 * Revoca TODAS las sesiones de un partner, incluidas las de sus
 * colaboradores (usado al congelar — regla #2). No borra datos, solo
 * invalida el acceso vivo.
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

/**
 * Revoca SOLO las sesiones de un colaborador (al desactivarlo) — no toca las
 * del partner ni las de otros colaboradores del mismo tenant.
 */
export async function revokeCollaboratorSessions(
  collaboratorId: string,
): Promise<void> {
  const redis = getRedis();
  const key = `${COLLAB_SESSIONS_PREFIX}${collaboratorId}`;
  const sessionIds = await redis.smembers(key);
  if (sessionIds.length === 0) return;

  const pipeline = redis.multi();
  for (const id of sessionIds) {
    pipeline.del(`${REDIS_PREFIX}${id}`);
  }
  pipeline.del(key);
  await pipeline.exec();
}
