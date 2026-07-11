import { Queue, type ConnectionOptions } from "bullmq";

// Conexión de BullMQ: requiere maxRetriesPerRequest: null. Se pasan opciones
// (no una instancia ioredis) porque BullMQ empaqueta su propia copia de
// ioredis con tipos incompatibles con la del repo (src/lib/redis.ts) — dejar
// que BullMQ cree su propio cliente internamente evita el choque de tipos.
export function createJobsConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set (jobs)");
  return { url, maxRetriesPerRequest: null };
}

export const MEMBERSHIP_SYNC_QUEUE = "membership-sync";

export function createMembershipSyncQueue(): Queue {
  return new Queue(MEMBERSHIP_SYNC_QUEUE, {
    connection: createJobsConnection(),
  });
}
