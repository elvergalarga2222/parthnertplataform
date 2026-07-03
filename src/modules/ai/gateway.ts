import { and, eq, sql as dsql } from "drizzle-orm";
import type { Db } from "@/db";
import { aiCreditLedger, aiProviderKeys, aiUsageLog } from "@/db/schema";
import { decryptSecret, encryptSecret } from "./crypto";

export type AiProvider = "anthropic" | "openai";

export interface QuotaStore {
  /** Incrementa el contador diario y devuelve el total tras incrementar. */
  increment(partnerId: string, day: string): Promise<number>;
}

export const DAILY_REQUEST_QUOTA = 200;

// Resolución de key (regla de negocio #6):
//   1) key BYOK del Partner  →  2) créditos prepagados  →  3) error 402.
// La plataforma nunca paga tokens de IA.
export type KeyResolution =
  | { source: "byok"; provider: AiProvider; apiKey: string }
  | { source: "credits"; provider: AiProvider }
  | { source: "none"; error: "payment_required" }
  | { source: "quota_exceeded"; error: "quota_exceeded" };

export class AiGateway {
  constructor(
    private db: Db,
    private quota: QuotaStore,
    private masterKey: string,
  ) {}

  async saveKey(partnerId: string, provider: AiProvider, apiKey: string) {
    const encrypted = encryptSecret(apiKey, this.masterKey);
    const keyLast4 = apiKey.slice(-4);
    const [row] = await this.db
      .insert(aiProviderKeys)
      .values({ partnerId, provider, encryptedKey: encrypted, keyLast4 })
      .onConflictDoUpdate({
        target: [aiProviderKeys.partnerId, aiProviderKeys.provider],
        set: {
          encryptedKey: encrypted,
          keyLast4,
          isValid: true,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: aiProviderKeys.id,
        provider: aiProviderKeys.provider,
        keyLast4: aiProviderKeys.keyLast4,
      });
    return row;
  }

  async deleteKey(partnerId: string, provider: AiProvider) {
    await this.db
      .delete(aiProviderKeys)
      .where(
        and(
          eq(aiProviderKeys.partnerId, partnerId),
          eq(aiProviderKeys.provider, provider),
        ),
      );
  }

  async listKeys(partnerId: string) {
    return this.db
      .select({
        provider: aiProviderKeys.provider,
        keyLast4: aiProviderKeys.keyLast4,
        isValid: aiProviderKeys.isValid,
      })
      .from(aiProviderKeys)
      .where(eq(aiProviderKeys.partnerId, partnerId));
  }

  async creditBalance(partnerId: string): Promise<number> {
    const [row] = await this.db
      .select({ balance: dsql<number>`coalesce(sum(${aiCreditLedger.delta}), 0)` })
      .from(aiCreditLedger)
      .where(eq(aiCreditLedger.partnerId, partnerId));
    return Number(row?.balance ?? 0);
  }

  /**
   * Resuelve qué key usar para una llamada de IA, aplicando la cuota diaria
   * dura antes de cualquier cosa (cinturón de seguridad anti-abuso).
   */
  async resolveKey(
    partnerId: string,
    preferredProvider?: AiProvider,
  ): Promise<KeyResolution> {
    const day = new Date().toISOString().slice(0, 10);
    const used = await this.quota.increment(partnerId, day);
    if (used > DAILY_REQUEST_QUOTA) {
      return { source: "quota_exceeded", error: "quota_exceeded" };
    }

    const keys = await this.db
      .select()
      .from(aiProviderKeys)
      .where(
        and(
          eq(aiProviderKeys.partnerId, partnerId),
          eq(aiProviderKeys.isValid, true),
        ),
      );

    const pick =
      (preferredProvider && keys.find((k) => k.provider === preferredProvider)) ||
      keys.find((k) => k.provider === "anthropic") ||
      keys[0];

    if (pick) {
      return {
        source: "byok",
        provider: pick.provider as AiProvider,
        apiKey: decryptSecret(pick.encryptedKey, this.masterKey),
      };
    }

    const balance = await this.creditBalance(partnerId);
    if (balance > 0) {
      return { source: "credits", provider: preferredProvider ?? "anthropic" };
    }

    return { source: "none", error: "payment_required" };
  }

  /** Marca una key como inválida cuando el proveedor devuelve 401. */
  async invalidateKey(partnerId: string, provider: AiProvider) {
    await this.db
      .update(aiProviderKeys)
      .set({ isValid: false, updatedAt: new Date() })
      .where(
        and(
          eq(aiProviderKeys.partnerId, partnerId),
          eq(aiProviderKeys.provider, provider),
        ),
      );
  }

  async logUsage(input: {
    partnerId: string;
    feature: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costEstimate?: string | null;
  }) {
    await this.db.insert(aiUsageLog).values(input);
  }
}

/** Cuota diaria dura en Redis con expiración a 48 h. */
export class RedisQuotaStore implements QuotaStore {
  constructor(
    private redis: {
      incr(key: string): Promise<number>;
      expire(key: string, seconds: number): Promise<number>;
    },
  ) {}

  async increment(partnerId: string, day: string): Promise<number> {
    const key = `ai_quota:${partnerId}:${day}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60 * 60 * 48);
    }
    return count;
  }
}

/** Implementación en memoria para tests. */
export class MemoryQuotaStore implements QuotaStore {
  private counts = new Map<string, number>();

  async increment(partnerId: string, day: string): Promise<number> {
    const key = `${partnerId}:${day}`;
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}
