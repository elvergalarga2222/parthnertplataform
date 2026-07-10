import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Integration tests para congelamiento (PR-7). Necesitan Postgres y Redis
// (revocación de sesiones); se saltan sin DATABASE_URL/REDIS_URL como el resto.
const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

describe.skipIf(!hasDb)("auth freeze/unfreeze (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let auth: typeof import("./service");
  let session: typeof import("./session");
  let redis: import("ioredis").Redis;

  let partnerId: string;
  let partnerEmail: string;
  const originalAdmins = process.env.ADMIN_EMAILS;

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    auth = await import("./service");
    session = await import("./session");
    const { getRedis } = await import("@/lib/redis");
    redis = getRedis();

    partnerEmail = `test-freeze-${randomUUID()}@test.dev`;
    const [row] = await db
      .insert(schema.partners)
      .values({
        skoolMemberId: `test:${randomUUID()}`,
        email: partnerEmail,
        displayName: "Test Freeze",
      })
      .returning({ id: schema.partners.id });
    partnerId = row.id;
  });

  afterEach(() => {
    if (originalAdmins === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdmins;
  });

  afterAll(async () => {
    if (!hasDb || !partnerId) return;
    const { eq } = await import("drizzle-orm");
    await db
      .delete(schema.accessAuditLog)
      .where(eq(schema.accessAuditLog.partnerId, partnerId));
    await db.delete(schema.deals).where(eq(schema.deals.partnerId, partnerId));
    await db
      .delete(schema.pipelineStages)
      .where(eq(schema.pipelineStages.partnerId, partnerId));
    await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
  });

  it("freezes: blocks access, revokes sessions, keeps data; unfreeze restores", async () => {
    const { eq } = await import("drizzle-orm");

    // Datos del partner que deben sobrevivir (regla #2: congelar ≠ borrar).
    const [stage] = await db
      .insert(schema.pipelineStages)
      .values({ partnerId, name: "Etapa", position: 0 })
      .returning({ id: schema.pipelineStages.id });
    await db.insert(schema.deals).values({
      partnerId,
      stageId: stage.id,
      title: "Deal que sobrevive al congelamiento",
    });

    // Sesión viva simulada en Redis (createSession real requiere cookies()).
    const sessionId = randomUUID();
    await redis
      .multi()
      .set(`session:${sessionId}`, partnerId, "EX", 600)
      .sadd(`partner_sessions:${partnerId}`, sessionId)
      .exec();

    await auth.freezePartner(partnerId, { adminEmail: "test@op.dev" });

    const [frozen] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, partnerId));
    expect(frozen.status).toBe("frozen");
    expect(frozen.frozenAt).not.toBeNull();
    // Sesiones revocadas al instante.
    expect(await redis.get(`session:${sessionId}`)).toBeNull();
    // Datos intactos.
    const dealsLeft = await db
      .select()
      .from(schema.deals)
      .where(eq(schema.deals.partnerId, partnerId));
    expect(dealsLeft).toHaveLength(1);
    // Auditoría con el actor.
    const audit = await db
      .select()
      .from(schema.accessAuditLog)
      .where(eq(schema.accessAuditLog.partnerId, partnerId));
    expect(
      audit.some(
        (a) =>
          a.event === "partner_frozen" &&
          (a.detail as { by?: string })?.by === "test@op.dev",
      ),
    ).toBe(true);

    // Congelar dos veces falla claro (0 filas afectadas).
    await expect(
      auth.freezePartner(partnerId, { adminEmail: "test@op.dev" }),
    ).rejects.toThrow(/ya congelado/);

    await auth.unfreezePartner(partnerId, { adminEmail: "test@op.dev" });
    const [restored] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, partnerId));
    expect(restored.status).toBe("active");
    expect(restored.frozenAt).toBeNull();
    expect(
      (
        await db
          .select()
          .from(schema.accessAuditLog)
          .where(eq(schema.accessAuditLog.partnerId, partnerId))
      ).some((a) => a.event === "partner_unfrozen"),
    ).toBe(true);
  });

  it("never freezes an operator account (anti-lockout)", async () => {
    process.env.ADMIN_EMAILS = ` OTRA@x.com , ${partnerEmail.toUpperCase()} `;
    await expect(
      auth.freezePartner(partnerId, { adminEmail: "test@op.dev" }),
    ).rejects.toThrow(/administrador/);
  });

  it("revokeAllSessions is a safe no-op without sessions", async () => {
    await expect(session.revokeAllSessions(randomUUID())).resolves.toBeUndefined();
  });
});
