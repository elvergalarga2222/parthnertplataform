import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  aiGenerations,
  aiPartnerKeys,
  aiPrompts,
  aiUsageLimits,
  workspaces,
} from "@/db/schema";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { decryptSecret, encryptSecret, keyHint } from "./crypto";
import { getAiProvider } from "./providers";
import { estimateCostUsd } from "./providers/types";
import type {
  AiGenerationView,
  AiKeyStatus,
  AiPromptView,
  AiType,
  AiUsageView,
} from "./types";

// AI module service. Regla #6 (inquebrantable): la plataforma nunca paga
// tokens. Resolución de key: BYOK del Partner → error 402. Cuota diaria dura en
// Redis; límite mensual en ai_usage_limits. Aislamiento por partner en todo.

export class AiError extends Error {
  constructor(
    message: string,
    public readonly code: "no_key" | "quota" | "not_found" | "provider" = "provider",
  ) {
    super(message);
  }
}

const DEFAULT_MONTHLY_LIMIT = 500_000;
const DAILY_TOKEN_CAP = 100_000; // hard daily cap per partner, tracked in Redis

// --- Keys (BYOK) ---------------------------------------------------------

export async function getKeyStatus(partnerId: string): Promise<AiKeyStatus> {
  const [row] = await db
    .select()
    .from(aiPartnerKeys)
    .where(
      and(
        eq(aiPartnerKeys.partnerId, partnerId),
        eq(aiPartnerKeys.provider, "anthropic"),
      ),
    );
  return {
    hasKey: Boolean(row),
    keyHint: row?.keyHint ?? null,
    provider: "anthropic",
  };
}

export async function setPartnerKey(
  partnerId: string,
  plaintextKey: string,
): Promise<void> {
  const encrypted = encryptSecret(plaintextKey);
  await db
    .insert(aiPartnerKeys)
    .values({
      partnerId,
      provider: "anthropic",
      encryptedKey: encrypted,
      keyHint: keyHint(plaintextKey),
    })
    .onConflictDoUpdate({
      target: [aiPartnerKeys.partnerId, aiPartnerKeys.provider],
      set: {
        encryptedKey: encrypted,
        keyHint: keyHint(plaintextKey),
        updatedAt: new Date(),
      },
    });
}

export async function deletePartnerKey(partnerId: string): Promise<void> {
  await db
    .delete(aiPartnerKeys)
    .where(
      and(
        eq(aiPartnerKeys.partnerId, partnerId),
        eq(aiPartnerKeys.provider, "anthropic"),
      ),
    );
}

async function resolveApiKey(partnerId: string): Promise<string> {
  // Mock provider needs no real key — return a placeholder so dev/tests work
  // without BYOK configured.
  if (process.env.AI_PROVIDER !== "anthropic") return "mock-key";

  const [row] = await db
    .select()
    .from(aiPartnerKeys)
    .where(
      and(
        eq(aiPartnerKeys.partnerId, partnerId),
        eq(aiPartnerKeys.provider, "anthropic"),
      ),
    );
  if (!row) {
    throw new AiError(
      "Configura tu API key de Anthropic para usar la IA (BYOK).",
      "no_key",
    );
  }
  return decryptSecret(row.encryptedKey);
}

// --- Usage / quota -------------------------------------------------------

export async function getUsage(partnerId: string): Promise<AiUsageView> {
  const limit = await ensureUsageRow(partnerId);
  const pct =
    limit.monthlyTokenLimit > 0
      ? Math.min(
          100,
          Math.round(
            (limit.tokensUsedThisMonth / limit.monthlyTokenLimit) * 100,
          ),
        )
      : 0;
  return {
    monthlyTokenLimit: limit.monthlyTokenLimit,
    tokensUsedThisMonth: limit.tokensUsedThisMonth,
    resetAt: limit.resetAt,
    pct,
  };
}

async function ensureUsageRow(partnerId: string) {
  const [existing] = await db
    .select()
    .from(aiUsageLimits)
    .where(eq(aiUsageLimits.partnerId, partnerId));

  if (existing) {
    // Roll over the monthly counter if we passed reset_at.
    if (new Date(existing.resetAt) <= new Date()) {
      const [rolled] = await db
        .update(aiUsageLimits)
        .set({
          tokensUsedThisMonth: 0,
          resetAt: nextMonthStart(),
          updatedAt: new Date(),
        })
        .where(eq(aiUsageLimits.partnerId, partnerId))
        .returning();
      return normalizeUsage(rolled);
    }
    return normalizeUsage(existing);
  }

  const [created] = await db
    .insert(aiUsageLimits)
    .values({ partnerId, monthlyTokenLimit: DEFAULT_MONTHLY_LIMIT })
    .onConflictDoNothing()
    .returning();
  if (created) return normalizeUsage(created);

  const [row] = await db
    .select()
    .from(aiUsageLimits)
    .where(eq(aiUsageLimits.partnerId, partnerId));
  return normalizeUsage(row);
}

function normalizeUsage(row: typeof aiUsageLimits.$inferSelect) {
  return {
    monthlyTokenLimit: Number(row.monthlyTokenLimit),
    tokensUsedThisMonth: Number(row.tokensUsedThisMonth),
    resetAt:
      typeof row.resetAt === "string"
        ? row.resetAt
        : new Date(row.resetAt as unknown as string).toISOString().slice(0, 10),
  };
}

function nextMonthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

async function assertWithinDailyCap(
  partnerId: string,
  estimatedTokens: number,
): Promise<void> {
  const redis = getRedis();
  const key = `ai_daily:${partnerId}:${new Date().toISOString().slice(0, 10)}`;
  const used = Number((await redis.get(key)) ?? 0);
  if (used + estimatedTokens > DAILY_TOKEN_CAP) {
    throw new AiError(
      "Alcanzaste el límite diario de IA. Intenta de nuevo mañana.",
      "quota",
    );
  }
}

async function recordDailyUsage(partnerId: string, tokens: number) {
  const redis = getRedis();
  const key = `ai_daily:${partnerId}:${new Date().toISOString().slice(0, 10)}`;
  await redis.multi().incrby(key, tokens).expire(key, 60 * 60 * 26).exec();
}

// --- Prompts -------------------------------------------------------------

export async function getPrompts(
  partnerId: string,
  type: AiType,
): Promise<AiPromptView[]> {
  const rows = await db
    .select()
    .from(aiPrompts)
    .where(
      and(
        eq(aiPrompts.type, type),
        or(isNull(aiPrompts.partnerId), eq(aiPrompts.partnerId, partnerId)),
      ),
    )
    .orderBy(aiPrompts.position, aiPrompts.createdAt);

  return rows.map((r) => ({
    id: r.id,
    type: r.type as AiType,
    name: r.name,
    isGlobal: r.partnerId === null,
  }));
}

// --- Generation ----------------------------------------------------------

export async function generate(
  partnerId: string,
  input: {
    type: AiType;
    promptId?: string | null;
    workspaceId?: string | null;
    messages: { role: "user" | "assistant"; content: string }[];
  },
): Promise<AiGenerationView> {
  const userText = input.messages.at(-1)?.content ?? "";

  // Monthly limit (hard cost control).
  const usage = await ensureUsageRow(partnerId);
  if (usage.tokensUsedThisMonth >= usage.monthlyTokenLimit) {
    throw new AiError(
      "Superaste tu límite mensual de tokens de IA.",
      "quota",
    );
  }
  // Daily cap in Redis (rough pre-check on input size).
  await assertWithinDailyCap(partnerId, Math.ceil(userText.length / 4));

  // Resolve system prompt (global template or partner-owned).
  let systemPrompt =
    "Eres un asistente experto que ayuda a partners de marketing a crear contenido de negocio claro y accionable.";
  if (input.promptId) {
    const [prompt] = await db
      .select()
      .from(aiPrompts)
      .where(
        and(
          eq(aiPrompts.id, input.promptId),
          or(isNull(aiPrompts.partnerId), eq(aiPrompts.partnerId, partnerId)),
        ),
      );
    if (!prompt) throw new AiError("Prompt no encontrado.", "not_found");
    systemPrompt = prompt.systemPrompt;
  }

  // Validate the workspace belongs to the partner, if provided.
  if (input.workspaceId) {
    const [ws] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, input.workspaceId),
          eq(workspaces.partnerId, partnerId),
        ),
      );
    if (!ws) throw new AiError("Espacio de trabajo no encontrado.", "not_found");
  }

  const apiKey = await resolveApiKey(partnerId);
  const provider = getAiProvider();

  let result;
  try {
    result = await provider.generate({
      systemPrompt,
      messages: input.messages,
      apiKey,
    });
  } catch (err) {
    logger.error("ai_generate_failed", err, { partnerId, type: input.type });
    throw new AiError(
      "No se pudo generar el contenido. Revisa tu API key e intenta de nuevo.",
      "provider",
    );
  }

  const costUsd = estimateCostUsd(result.tokensInput, result.tokensOutput);
  const totalTokens = result.tokensInput + result.tokensOutput;

  const [row] = await db
    .insert(aiGenerations)
    .values({
      partnerId,
      workspaceId: input.workspaceId ?? null,
      promptId: input.promptId ?? null,
      type: input.type,
      inputText: userText,
      outputText: result.text,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      costUsd: String(costUsd),
      provider: provider.name,
      model: result.model,
    })
    .returning();

  // Increment monthly + daily counters.
  await db
    .update(aiUsageLimits)
    .set({
      tokensUsedThisMonth: usage.tokensUsedThisMonth + totalTokens,
      updatedAt: new Date(),
    })
    .where(eq(aiUsageLimits.partnerId, partnerId));
  await recordDailyUsage(partnerId, totalTokens);

  return {
    id: row.id,
    type: row.type as AiType,
    inputText: row.inputText,
    outputText: row.outputText,
    tokensInput: row.tokensInput,
    tokensOutput: row.tokensOutput,
    costUsd,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getRecentGenerations(
  partnerId: string,
  type: AiType,
  workspaceId: string | null,
  limit = 20,
): Promise<AiGenerationView[]> {
  const rows = await db
    .select()
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.partnerId, partnerId),
        eq(aiGenerations.type, type),
        workspaceId
          ? eq(aiGenerations.workspaceId, workspaceId)
          : isNull(aiGenerations.workspaceId),
      ),
    )
    .orderBy(desc(aiGenerations.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    type: r.type as AiType,
    inputText: r.inputText,
    outputText: r.outputText,
    tokensInput: r.tokensInput,
    tokensOutput: r.tokensOutput,
    costUsd: Number(r.costUsd),
    createdAt: r.createdAt.toISOString(),
  }));
}
