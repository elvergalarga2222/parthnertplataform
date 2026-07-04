import Redis from "ioredis";

// Singleton cacheado en globalThis para no abrir una conexión nueva en cada
// hot-reload de desarrollo. Las sesiones viven aquí (revocables al instante).
const globalForRedis = globalThis as unknown as { redis?: Redis };

export function getRedis(): Redis {
  if (!globalForRedis.redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is not set");
    }
    globalForRedis.redis = new Redis(url, { maxRetriesPerRequest: null });
  }
  return globalForRedis.redis;
}
