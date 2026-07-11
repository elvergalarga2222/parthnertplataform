import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Member, MembershipProvider } from "./membership-provider";

// Integration tests para el job de sincronización de membresías (PR-10).
// Necesitan Postgres+Redis (freezePartner revoca sesiones). Fixtures: activo,
// cancelado-con-15-días, cancelado-vencido, removed — más los fail-safes.
const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

class FakeProvider implements MembershipProvider {
  constructor(private members: Member[]) {}
  async findMemberByEmail(email: string) {
    return this.members.find((m) => m.email === email) ?? null;
  }
  async listActiveMembers() {
    return this.members.filter((m) => m.status === "active");
  }
  async listMembers() {
    return this.members;
  }
}

const mkMember = (overrides: Partial<Member> & { externalId: string }): Member => ({
  email: `${overrides.externalId}@test.dev`,
  displayName: null,
  status: "active",
  currentPeriodEndsAt: null,
  cancelAtPeriodEnd: false,
  ...overrides,
});

describe.skipIf(!hasDb)("syncMemberships (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let sync: typeof import("./membership-sync");
  let auth: typeof import("./service");

  const createdPartners: string[] = [];
  const originalGroupId = process.env.SKOOL_GROUP_ID;

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    sync = await import("./membership-sync");
    auth = await import("./service");
    process.env.SKOOL_GROUP_ID = "test-group";
  });

  afterAll(async () => {
    if (originalGroupId === undefined) delete process.env.SKOOL_GROUP_ID;
    else process.env.SKOOL_GROUP_ID = originalGroupId;
    if (!hasDb || createdPartners.length === 0) return;
    const { eq, inArray } = await import("drizzle-orm");
    await db
      .delete(schema.skoolMemberships)
      .where(inArray(schema.skoolMemberships.partnerId, createdPartners));
    await db
      .delete(schema.accessAuditLog)
      .where(inArray(schema.accessAuditLog.partnerId, createdPartners));
    for (const id of createdPartners) {
      await db.delete(schema.partners).where(eq(schema.partners.id, id));
    }
  });

  afterEach(async () => {
    // Idempotencia entre tests: nada que limpiar por default (cada test usa
    // sus propios partners), pero se resetea la env por si algún caso la toca.
  });

  async function makePartner(status: "active" | "frozen" = "active") {
    const externalId = `t_${randomUUID()}`;
    const [row] = await db
      .insert(schema.partners)
      .values({
        skoolMemberId: externalId,
        email: `${externalId}@test.dev`,
        displayName: "Test Sync",
        status,
      })
      .returning({ id: schema.partners.id });
    createdPartners.push(row.id);
    return { id: row.id, externalId };
  }

  it("leaves a healthy active member untouched", async () => {
    const p = await makePartner();
    const provider = new FakeProvider([mkMember({ externalId: p.externalId })]);

    const result = await sync.syncMemberships(new Date(), provider);
    expect(result.skipped).toBe(false);
    expect(result.frozen).toBe(0);

    const { eq } = await import("drizzle-orm");
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, p.id));
    expect(partner.status).toBe("active");
  });

  it("notifies a member cancelled with ≤15 days left (plan B grace)", async () => {
    const p = await makePartner();
    const provider = new FakeProvider([
      mkMember({ externalId: p.externalId, cancelAtPeriodEnd: true }),
    ]);
    process.env.MEMBERSHIP_GRACE_DAYS = "10";

    const now = new Date("2026-07-10T12:00:00Z");
    const result = await sync.syncMemberships(now, provider);
    expect(result.notified).toBe(1);

    const { eq } = await import("drizzle-orm");
    const [membership] = await db
      .select()
      .from(schema.skoolMemberships)
      .where(eq(schema.skoolMemberships.partnerId, p.id));
    expect(membership.alertState).toBe("expiring_notified");
    expect(membership.accessExpiresAt).not.toBeNull();
    delete process.env.MEMBERSHIP_GRACE_DAYS;
  });

  it("freezes a member whose access already expired", async () => {
    const p = await makePartner();
    // Fecha de fin de periodo ya pasada.
    const provider = new FakeProvider([
      mkMember({
        externalId: p.externalId,
        cancelAtPeriodEnd: true,
        currentPeriodEndsAt: "2026-06-01T00:00:00Z",
      }),
    ]);

    const now = new Date("2026-07-10T12:00:00Z");
    const result = await sync.syncMemberships(now, provider);
    // No se afirma sobre result.frozen (agregado): otros partners de tests
    // previos en este mismo archivo, ausentes de este FakeProvider, pueden
    // acumular missingCount y alcanzar el umbral en la misma corrida — efecto
    // secundario esperado del diseño (procesa TODOS los partners), no un bug.
    // Lo que importa es el estado del partner de ESTE test.
    expect(result.skipped).toBe(false);

    const { eq } = await import("drizzle-orm");
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, p.id));
    expect(partner.status).toBe("frozen");

    const events = await db
      .select()
      .from(schema.accessAuditLog)
      .where(eq(schema.accessAuditLog.partnerId, p.id));
    expect(events.some((e) => e.event === "partner_frozen_auto")).toBe(true);
  });

  it("freezes immediately on removed, no grace period", async () => {
    const p = await makePartner();
    const provider = new FakeProvider([
      mkMember({ externalId: p.externalId, status: "removed" }),
    ]);

    const result = await sync.syncMemberships(new Date(), provider);
    expect(result.skipped).toBe(false);

    const { eq } = await import("drizzle-orm");
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, p.id));
    expect(partner.status).toBe("frozen");
  });

  it("auto-unfreezes only when frozen BY the sync (renewal), not manual freezes", async () => {
    // Caso A: congelado automáticamente por el propio sync → renovar descongela.
    const auto = await makePartner();
    const providerCancel = new FakeProvider([
      mkMember({
        externalId: auto.externalId,
        cancelAtPeriodEnd: true,
        currentPeriodEndsAt: "2026-06-01T00:00:00Z",
      }),
    ]);
    await sync.syncMemberships(new Date("2026-07-10T12:00:00Z"), providerCancel);
    const providerRenewed = new FakeProvider([
      mkMember({ externalId: auto.externalId, status: "active" }),
    ]);
    const result = await sync.syncMemberships(new Date(), providerRenewed);
    expect(result.unfrozen).toBe(1);

    const { eq } = await import("drizzle-orm");
    const [partnerA] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, auto.id));
    expect(partnerA.status).toBe("active");

    // Caso B: congelado MANUALMENTE por admin → renovar NO lo descongela.
    const manual = await makePartner();
    await auth.freezePartner(manual.id, { adminEmail: "admin@op.dev" });
    const providerActive = new FakeProvider([
      mkMember({ externalId: manual.externalId, status: "active" }),
    ]);
    const result2 = await sync.syncMemberships(new Date(), providerActive);
    expect(result2.unfrozen).toBe(0);

    const [partnerB] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, manual.id));
    expect(partnerB.status).toBe("frozen");
  });

  it("running twice does not duplicate alerts or events (idempotent)", async () => {
    const p = await makePartner();
    const provider = new FakeProvider([
      mkMember({ externalId: p.externalId, cancelAtPeriodEnd: true }),
    ]);
    const now = new Date("2026-07-10T12:00:00Z");

    const r1 = await sync.syncMemberships(now, provider);
    const r2 = await sync.syncMemberships(now, provider);
    expect(r1.notified).toBe(1);
    expect(r2.notified).toBe(0); // ya estaba expiring_notified

    const { eq } = await import("drizzle-orm");
    const events = await db
      .select()
      .from(schema.accessAuditLog)
      .where(eq(schema.accessAuditLog.partnerId, p.id));
    expect(events.filter((e) => e.event === "membership_expiring")).toHaveLength(1);
  });

  it("never freezes on empty/partial provider response (fail-safe)", async () => {
    const p = await makePartner();
    const result = await sync.syncMemberships(new Date(), new FakeProvider([]));
    expect(result.skipped).toBe(true);
    expect(result.frozen).toBe(0);

    const { eq } = await import("drizzle-orm");
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, p.id));
    expect(partner.status).toBe("active");
  });

  it("only acts on a partner missing from the response after 3 consecutive runs", async () => {
    const present = await makePartner();
    const missing = await makePartner();
    const providerWithBoth = new FakeProvider([
      mkMember({ externalId: present.externalId }),
      mkMember({ externalId: missing.externalId }),
    ]);
    // Primer run: siembra skool_memberships para ambos.
    await sync.syncMemberships(new Date(), providerWithBoth);

    const providerMissingOne = new FakeProvider([
      mkMember({ externalId: present.externalId }),
    ]);
    const { eq } = await import("drizzle-orm");

    for (let i = 1; i <= 2; i++) {
      await sync.syncMemberships(new Date(), providerMissingOne);
      const [partner] = await db
        .select()
        .from(schema.partners)
        .where(eq(schema.partners.id, missing.id));
      expect(partner.status).toBe("active");
    }

    // 3ra ejecución consecutiva ausente ⇒ ahora sí congela.
    await sync.syncMemberships(new Date(), providerMissingOne);
    const [partner] = await db
      .select()
      .from(schema.partners)
      .where(eq(schema.partners.id, missing.id));
    expect(partner.status).toBe("frozen");
  });
});
