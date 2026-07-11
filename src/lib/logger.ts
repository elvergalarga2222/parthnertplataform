// Structured server-side logger.
//
// Emits one JSON object per line to stdout/stderr so logs are trivially
// greppable in `pm2 logs` / `docker logs`:
//
//   pm2 logs partner-manager | grep '"level":"error"'
//   pm2 logs partner-manager | grep '"partnerId":"<id>"'
//   pm2 logs partner-manager | grep '"requestId":"<id>"'
//
// In development the same data is printed in a compact human-readable form.
// Never import this from a Client Component — it is server-only.
//
// Errors also get pushed to a small Redis ring buffer (best-effort, capped)
// so the admin panel (/admin/logs) can show recent failures without SSH.
// This NEVER changes the stdout format above — it is a side channel.

import { getRedis } from "./redis";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Correlates every log line of a single request (see withRequestContext). */
  requestId?: string;
  partnerId?: string;
  route?: string;
  /** Any extra structured fields. */
  [key: string]: unknown;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// LOG_LEVEL env overrides the floor; defaults to debug in dev, info in prod.
function minLevel(): number {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVEL_WEIGHT) return LEVEL_WEIGHT[configured];
  return process.env.NODE_ENV === "production"
    ? LEVEL_WEIGHT.info
    : LEVEL_WEIGHT.debug;
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function emit(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown,
) {
  if (LEVEL_WEIGHT[level] < minLevel()) return;

  const record: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...context,
  };
  if (error !== undefined) record.err = serializeError(error);

  const line =
    process.env.NODE_ENV === "production"
      ? JSON.stringify(record)
      : `[${level}] ${message}${
          context && Object.keys(context).length
            ? " " + JSON.stringify(context)
            : ""
        }${error !== undefined ? "\n" + (error instanceof Error ? error.stack : String(error)) : ""}`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Solo errores (no warn: recomendación — ruido innecesario en un buffer
  // acotado). Fire-and-forget: nunca puede retrasar ni romper al caller.
  if (level === "error") pushToBuffer(record);
}

// --- Buffer de errores en Redis para el visor del panel admin --------------

export const LOG_BUFFER_KEY = "logs:errors";
const LOG_BUFFER_MAX = Number(process.env.LOG_BUFFER_MAX ?? 500);
const LOG_BUFFER_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días, renovado en cada push
const MAX_STACK_CHARS = 4000;
const MAX_MSG_CHARS = 2000;

/** Trunca campos que podrían inflar el buffer (stacks largos, mensajes gigantes). */
export function clipRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const clipped: Record<string, unknown> = { ...record };
  if (typeof clipped.msg === "string" && clipped.msg.length > MAX_MSG_CHARS) {
    clipped.msg = clipped.msg.slice(0, MAX_MSG_CHARS);
  }
  const err = clipped.err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    clipped.err = {
      ...e,
      ...(typeof e.stack === "string"
        ? { stack: e.stack.slice(0, MAX_STACK_CHARS) }
        : {}),
      ...(typeof e.message === "string"
        ? { message: e.message.slice(0, MAX_MSG_CHARS) }
        : {}),
    };
  }
  return clipped;
}

function pushToBuffer(record: Record<string, unknown>): void {
  // Nunca puede romper ni retrasar al caller: sin await, todo error tragado.
  // Y jamás se loguea a sí mismo en fallo (bucle infinito prohibido).
  try {
    if (!process.env.REDIS_URL) return; // build/tests/dev sin Redis
    const redis = getRedis();
    const payload = JSON.stringify(clipRecord(record));
    void redis
      .multi()
      .lpush(LOG_BUFFER_KEY, payload)
      .ltrim(LOG_BUFFER_KEY, 0, LOG_BUFFER_MAX - 1)
      .expire(LOG_BUFFER_KEY, LOG_BUFFER_TTL_SECONDS)
      .exec()
      .catch(() => {});
  } catch {
    /* jamás propagar: el logging no puede tumbar la request */
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) =>
    emit("debug", message, context),
  info: (message: string, context?: LogContext) =>
    emit("info", message, context),
  warn: (message: string, context?: LogContext) =>
    emit("warn", message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    emit("error", message, context, error),

  /** Returns a logger bound to a fixed context (e.g. per request/partner). */
  child(base: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        emit("debug", message, { ...base, ...context }),
      info: (message: string, context?: LogContext) =>
        emit("info", message, { ...base, ...context }),
      warn: (message: string, context?: LogContext) =>
        emit("warn", message, { ...base, ...context }),
      error: (message: string, error?: unknown, context?: LogContext) =>
        emit("error", message, { ...base, ...context }, error),
    };
  },
};

/** Short random id to correlate logs within one request. */
export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}
