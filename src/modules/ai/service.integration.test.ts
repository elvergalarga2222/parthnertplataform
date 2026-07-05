import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Integration tests against a real Postgres + Redis (skip without DATABASE_URL,
// as in CI). Exercise the AI module with the mock provider (no real key/network).
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("ai service (integration, mock provider)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let ai: typeof import("./service");

  const createdPartners: string[] = [];
  let partnerA: string;
  let partnerB: string;

  beforeAll(async () => {
    process.env.AI_KEYS_MASTER_KEY ??= randomBytes(32).toString("base64");
    delete process.env.AI_PROVIDER; // ensure mock provider

    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    ai = await import("./service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-ai-${label}-${randomUUID()}@test.dev`,
          displayName: `Test AI ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;
  });

  afterAll(async () => {
    if (!hasDb) return;
    const { eq } = await import("drizzle-orm");
    for (const partnerId of createdPartners) {
      await db.delete(schema.aiGenerations).where(eq(schema.aiGenerations.partnerId, partnerId));
      await db.delete(schema.aiUsageLimits).where(eq(schema.aiUsageLimits.partnerId, partnerId));
      await db.delete(schema.aiPartnerKeys).where(eq(schema.aiPartnerKeys.partnerId, partnerId));
      await db.delete(schema.aiPrompts).where(eq(schema.aiPrompts.partnerId, partnerId));
      await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
    }
  });

  it("generates with the mock provider and logs cost + tokens", async () => {
    const gen = await ai.generate(partnerA, {
      type: "guion",
      messages: [{ role: "user", content: "Producto: curso de ventas" }],
    });
    expect(gen.outputText).toContain("demostración");
    expect(gen.tokensInput).toBeGreaterThan(0);
    expect(gen.tokensOutput).toBeGreaterThan(0);
    expect(gen.costUsd).toBeGreaterThanOrEqual(0);

    const usage = await ai.getUsage(partnerA);
    expect(usage.tokensUsedThisMonth).toBe(gen.tokensInput + gen.tokensOutput);
  });

  it("enforces the monthly token limit", async () => {
    // Drop the limit below what's already been used.
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.aiUsageLimits)
      .set({ monthlyTokenLimit: 1 })
      .where(eq(schema.aiUsageLimits.partnerId, partnerA));

    await expect(
      ai.generate(partnerA, {
        type: "guion",
        messages: [{ role: "user", content: "otra generación" }],
      }),
    ).rejects.toThrow(/límite mensual/i);
  });

  it("stores the BYOK key encrypted and reports a hint", async () => {
    await ai.setPartnerKey(partnerA, "sk-ant-secret-value-1234");
    const status = await ai.getKeyStatus(partnerA);
    expect(status.hasKey).toBe(true);
    expect(status.keyHint).toBe("1234");

    // The stored value must not be the plaintext.
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(schema.aiPartnerKeys)
      .where(eq(schema.aiPartnerKeys.partnerId, partnerA));
    expect(row.encryptedKey).not.toContain("sk-ant-secret-value-1234");
  });

  it("isolates generations, usage and keys between partners", async () => {
    await ai.generate(partnerB, {
      type: "estrategia",
      messages: [{ role: "user", content: "negocio de partner B" }],
    });

    const recentA = await ai.getRecentGenerations(partnerA, "estrategia", null);
    expect(recentA).toHaveLength(0); // A never generated an 'estrategia'

    const recentB = await ai.getRecentGenerations(partnerB, "estrategia", null);
    expect(recentB.length).toBeGreaterThan(0);

    // B has no key configured; A does — statuses are independent.
    const statusB = await ai.getKeyStatus(partnerB);
    expect(statusB.hasKey).toBe(false);
  });

  it("rejects a prompt that belongs to another partner", async () => {
    const [prompt] = await db
      .insert(schema.aiPrompts)
      .values({
        partnerId: partnerB,
        type: "guion",
        name: "Prompt privado de B",
        systemPrompt: "secreto",
      })
      .returning();

    // Reset A's limit so we get past the quota check to the prompt check.
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.aiUsageLimits)
      .set({ monthlyTokenLimit: 500000, tokensUsedThisMonth: 0 })
      .where(eq(schema.aiUsageLimits.partnerId, partnerA));

    await expect(
      ai.generate(partnerA, {
        type: "guion",
        promptId: prompt.id,
        messages: [{ role: "user", content: "usa el prompt de B" }],
      }),
    ).rejects.toThrow(/no encontrado/i);
  });
});
