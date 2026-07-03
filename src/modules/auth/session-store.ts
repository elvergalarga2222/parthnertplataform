import { randomBytes } from "node:crypto";
import type Redis from "ioredis";

export const SESSION_COOKIE = "pm_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 h

// La sesión vive server-side y es revocable al instante (regla de negocio #1):
// nunca JWT stateless como sesión primaria.
export interface SessionStore {
  create(partnerId: string): Promise<string>;
  getPartnerId(sessionId: string): Promise<string | null>;
  destroy(sessionId: string): Promise<void>;
  destroyAllForPartner(partnerId: string): Promise<number>;
}

const sessKey = (id: string) => `sess:${id}`;
const partnerIndexKey = (partnerId: string) => `partner_sessions:${partnerId}`;

export class RedisSessionStore implements SessionStore {
  constructor(private redis: Redis) {}

  async create(partnerId: string): Promise<string> {
    const sessionId = randomBytes(32).toString("base64url");
    await this.redis
      .multi()
      .set(sessKey(sessionId), partnerId, "EX", SESSION_TTL_SECONDS)
      .sadd(partnerIndexKey(partnerId), sessionId)
      .expire(partnerIndexKey(partnerId), SESSION_TTL_SECONDS * 2)
      .exec();
    return sessionId;
  }

  async getPartnerId(sessionId: string): Promise<string | null> {
    return this.redis.get(sessKey(sessionId));
  }

  async destroy(sessionId: string): Promise<void> {
    const partnerId = await this.redis.get(sessKey(sessionId));
    const multi = this.redis.multi().del(sessKey(sessionId));
    if (partnerId) {
      multi.srem(partnerIndexKey(partnerId), sessionId);
    }
    await multi.exec();
  }

  async destroyAllForPartner(partnerId: string): Promise<number> {
    const sessionIds = await this.redis.smembers(partnerIndexKey(partnerId));
    if (sessionIds.length === 0) {
      return 0;
    }
    await this.redis
      .multi()
      .del(...sessionIds.map(sessKey))
      .del(partnerIndexKey(partnerId))
      .exec();
    return sessionIds.length;
  }
}

/** Implementación en memoria para tests y desarrollo sin Redis. */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, string>();

  async create(partnerId: string): Promise<string> {
    const sessionId = randomBytes(32).toString("base64url");
    this.sessions.set(sessionId, partnerId);
    return sessionId;
  }

  async getPartnerId(sessionId: string): Promise<string | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async destroyAllForPartner(partnerId: string): Promise<number> {
    let count = 0;
    for (const [id, pid] of this.sessions) {
      if (pid === partnerId) {
        this.sessions.delete(id);
        count++;
      }
    }
    return count;
  }
}
