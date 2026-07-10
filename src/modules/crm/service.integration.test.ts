import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Integration tests against a real Postgres. They run only when DATABASE_URL
// is set (local dev); CI has no database and skips them.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("crm service (integration)", () => {
  // Imported lazily so importing this file without DATABASE_URL never throws.
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let crm: typeof import("./service");

  let partnerA: string;
  let partnerB: string;
  const createdPartners: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    crm = await import("./service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-${label}-${randomUUID()}@test.dev`,
          displayName: `Test ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;
  });

  afterAll(async () => {
    if (!hasDb || createdPartners.length === 0) return;
    const { inArray, eq } = await import("drizzle-orm");
    for (const partnerId of createdPartners) {
      const dealRows = await db
        .select({ id: schema.deals.id })
        .from(schema.deals)
        .where(eq(schema.deals.partnerId, partnerId));
      if (dealRows.length) {
        await db.delete(schema.dealActivity).where(
          inArray(
            schema.dealActivity.dealId,
            dealRows.map((d) => d.id),
          ),
        );
      }
      const fieldRows = await db
        .select({ id: schema.customFields.id })
        .from(schema.customFields)
        .where(eq(schema.customFields.partnerId, partnerId));
      if (fieldRows.length) {
        await db.delete(schema.customFieldValues).where(
          inArray(
            schema.customFieldValues.customFieldId,
            fieldRows.map((f) => f.id),
          ),
        );
      }
      await db.delete(schema.customFields).where(eq(schema.customFields.partnerId, partnerId));
      await db.delete(schema.deals).where(eq(schema.deals.partnerId, partnerId));
      await db.delete(schema.contacts).where(eq(schema.contacts.partnerId, partnerId));
      await db.delete(schema.companies).where(eq(schema.companies.partnerId, partnerId));
      await db.delete(schema.pipelineStages).where(eq(schema.pipelineStages.partnerId, partnerId));
      await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
    }
  });

  it("creates default stages once per partner", async () => {
    await crm.ensureDefaultStages(partnerA);
    await crm.ensureDefaultStages(partnerA);
    const snapshot = await crm.getCrmSnapshot(partnerA);
    expect(snapshot.stages).toHaveLength(4);
    expect(snapshot.stages[0].name).toBe("Descubrimiento");
  });

  it("isolates data between partners", async () => {
    await crm.ensureDefaultStages(partnerB);
    const snapshotA = await crm.getCrmSnapshot(partnerA);
    const stageA = snapshotA.stages[0];

    const dealId = await crm.createDeal(partnerA, {
      title: "Deal privado de A",
      value: 1000,
      stageId: stageA.id,
    });

    const snapshotB = await crm.getCrmSnapshot(partnerB);
    expect(snapshotB.deals.find((d) => d.id === dealId)).toBeUndefined();
    expect(snapshotB.stages.some((s) => s.id === stageA.id)).toBe(false);

    // Cross-partner access by id must behave as "not found".
    await expect(
      crm.updateDeal(partnerB, dealId, { title: "hackeado" }),
    ).rejects.toThrow();
    await expect(
      crm.moveDealStage(partnerB, dealId, snapshotB.stages[0].id, 0),
    ).rejects.toThrow();
    // Ni siquiera moviéndolo a una etapa del partner A:
    await expect(
      crm.moveDealStage(partnerB, dealId, stageA.id, 0),
    ).rejects.toThrow();
  });

  it("moves a deal, renormalizes positions and logs activity", async () => {
    const snapshot = await crm.getCrmSnapshot(partnerA);
    const [first, second] = snapshot.stages;

    const dealId = snapshot.deals[0].id;
    await crm.moveDealStage(partnerA, dealId, second.id, 0);

    const after = await crm.getCrmSnapshot(partnerA);
    const moved = after.deals.find((d) => d.id === dealId)!;
    expect(moved.stageId).toBe(second.id);
    expect(moved.position).toBe(0);

    const activity = await crm.getDealActivity(partnerA, dealId);
    const change = activity.find((a) => a.type === "stage_change");
    expect(change?.description).toBe(`Movido a ${second.name}`);

    // Volver a la etapa original para no ensuciar los otros tests.
    await crm.moveDealStage(partnerA, dealId, first.id, 0);
  });

  it("deleting a stage moves its deals to the first remaining stage", async () => {
    const stage = await crm.createStage(partnerA, {
      name: "Temporal",
      color: "amber",
    });
    const dealId = await crm.createDeal(partnerA, {
      title: "Deal en etapa temporal",
      value: 500,
      stageId: stage.id,
    });

    await crm.deleteStage(partnerA, stage.id);

    const after = await crm.getCrmSnapshot(partnerA);
    expect(after.stages.some((s) => s.id === stage.id)).toBe(false);
    const survivor = after.deals.find((d) => d.id === dealId)!;
    expect(survivor.stageId).toBe(after.stages[0].id);

    await crm.deleteDeal(partnerA, dealId);
  });

  it("survives a poisoned next_activity_at instead of crashing the snapshot", async () => {
    // Regresión del digest 4159151474: un timestamptz que JavaScript no puede
    // representar ('infinity', años BC o > 275760) llega del driver como
    // Invalid Date y .toISOString() lanzaba RangeError en cada render de
    // /clientes. El CHECK de la migración 0007 ya impide insertarlo por la vía
    // normal, así que se recrea el estado pre-migración soltando la constraint
    // temporalmente (mismo dato envenenado que había en producción).
    const { sql } = await import("drizzle-orm");
    const snapshot = await crm.getCrmSnapshot(partnerA);
    const dealId = await crm.createDeal(partnerA, {
      title: "Deal envenenado",
      value: 1,
      stageId: snapshot.stages[0].id,
    });

    await db.execute(
      sql`ALTER TABLE deals DROP CONSTRAINT deals_next_activity_at_range_check`,
    );
    try {
      await db.execute(
        sql`UPDATE deals SET next_activity_at = 'infinity' WHERE id = ${dealId}`,
      );
      const after = await crm.getCrmSnapshot(partnerA);
      const poisoned = after.deals.find((d) => d.id === dealId);
      expect(poisoned).toBeDefined();
      expect(poisoned!.nextActivityAt).toBeNull();
    } finally {
      await db.execute(
        sql`UPDATE deals SET next_activity_at = NULL WHERE id = ${dealId}`,
      );
      await db.execute(
        sql`ALTER TABLE deals ADD CONSTRAINT deals_next_activity_at_range_check
            CHECK (next_activity_at IS NULL
                   OR (next_activity_at >= '1900-01-01' AND next_activity_at < '2200-01-01'))`,
      );
      await crm.deleteDeal(partnerA, dealId);
    }
  });

  it("rejects an out-of-range next_activity_at at the database level", async () => {
    const snapshot = await crm.getCrmSnapshot(partnerA);
    await expect(
      crm.createDeal(partnerA, {
        title: "Deal con fecha imposible",
        value: 1,
        stageId: snapshot.stages[0].id,
        // Año 20260 — el dedazo típico en el <input type="date">.
        nextActivityAt: new Date("+020260-07-10T09:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it("custom field values are scoped to the owning partner", async () => {
    const field = await crm.createCustomField(partnerA, {
      entity: "deal",
      label: "Fuente del lead",
      fieldType: "select",
      options: ["Referido", "Web"],
    });
    const snapshot = await crm.getCrmSnapshot(partnerA);
    const dealId = snapshot.deals[0].id;

    await crm.setCustomFieldValue(partnerA, field.id, dealId, "Referido");
    const after = await crm.getCrmSnapshot(partnerA);
    expect(after.deals.find((d) => d.id === dealId)!.custom[field.id]).toBe(
      "Referido",
    );

    // Partner B cannot write through A's field, nor A's deal.
    await expect(
      crm.setCustomFieldValue(partnerB, field.id, dealId, "Web"),
    ).rejects.toThrow();
  });
});
