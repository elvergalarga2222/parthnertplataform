import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Integration tests against a real Postgres (skip without DATABASE_URL, as in
// CI). Cover the auto-create trigger and partner isolation of workspaces.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("workspace service (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let crm: typeof import("@/modules/crm/service");
  let ws: typeof import("./service");

  const createdPartners: string[] = [];
  let partnerA: string;
  let partnerB: string;
  let wonStageId: string;
  let openStageId: string;

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    crm = await import("@/modules/crm/service");
    ws = await import("./service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-ws-${label}-${randomUUID()}@test.dev`,
          displayName: `Test WS ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;

    await crm.ensureDefaultStages(partnerA);
    await crm.ensureDefaultStages(partnerB);
    const snapshot = await crm.getCrmSnapshot(partnerA);
    wonStageId = snapshot.stages.find((s) => s.isWon)!.id;
    openStageId = snapshot.stages.find((s) => !s.isWon)!.id;
  });

  afterAll(async () => {
    if (!hasDb || createdPartners.length === 0) return;
    const { eq, inArray } = await import("drizzle-orm");
    for (const partnerId of createdPartners) {
      const wsRows = await db
        .select({ id: schema.workspaces.id })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.partnerId, partnerId));
      const wsIds = wsRows.map((w) => w.id);
      if (wsIds.length) {
        await db.delete(schema.kanbanCards).where(inArray(schema.kanbanCards.workspaceId, wsIds));
        await db.delete(schema.kanbanColumns).where(inArray(schema.kanbanColumns.workspaceId, wsIds));
        await db.delete(schema.workspaceProfiles).where(inArray(schema.workspaceProfiles.workspaceId, wsIds));
        await db.delete(schema.workspaces).where(inArray(schema.workspaces.id, wsIds));
      }
      const dealRows = await db
        .select({ id: schema.deals.id })
        .from(schema.deals)
        .where(eq(schema.deals.partnerId, partnerId));
      if (dealRows.length) {
        await db.delete(schema.dealActivity).where(
          inArray(schema.dealActivity.dealId, dealRows.map((d) => d.id)),
        );
      }
      await db.delete(schema.deals).where(eq(schema.deals.partnerId, partnerId));
      await db.delete(schema.pipelineStages).where(eq(schema.pipelineStages.partnerId, partnerId));
      await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
    }
  });

  it("auto-creates a workspace with default columns when a deal is won", async () => {
    const dealId = await crm.createDeal(partnerA, {
      title: "Cliente Ganado SA",
      value: 9000,
      stageId: openStageId,
    });

    let list = await ws.getWorkspaces(partnerA);
    expect(list.find((w) => w.dealId === dealId)).toBeUndefined();

    await crm.moveDealStage(partnerA, dealId, wonStageId, 0);

    list = await ws.getWorkspaces(partnerA);
    const created = list.find((w) => w.dealId === dealId);
    expect(created).toBeDefined();
    expect(created!.clientName).toBe("Cliente Ganado SA");

    const snapshot = await ws.getWorkspaceSnapshot(partnerA, created!.id);
    expect(snapshot.columns.map((c) => c.name)).toEqual([
      "Por hacer",
      "En proceso",
      "En estancamiento",
      "Hecho",
    ]);

    // Volver a mover el deal no duplica el workspace (idempotencia).
    await crm.moveDealStage(partnerA, dealId, openStageId, 0);
    await crm.moveDealStage(partnerA, dealId, wonStageId, 0);
    const after = await ws.getWorkspaces(partnerA);
    expect(after.filter((w) => w.dealId === dealId)).toHaveLength(1);
  });

  it("isolates workspaces between partners", async () => {
    const list = await ws.getWorkspaces(partnerA);
    const wsId = list[0].id;

    const listB = await ws.getWorkspaces(partnerB);
    expect(listB.find((w) => w.id === wsId)).toBeUndefined();

    await expect(ws.getWorkspaceSnapshot(partnerB, wsId)).rejects.toThrow();
    await expect(
      ws.updateWorkspaceProfile(partnerB, wsId, { businessName: "hack" }),
    ).rejects.toThrow();
    await expect(ws.createColumn(partnerB, wsId, "Intrusa")).rejects.toThrow();
  });

  it("moves cards renormalizing positions and scopes card writes", async () => {
    const list = await ws.getWorkspaces(partnerA);
    const wsId = list[0].id;
    const snapshot = await ws.getWorkspaceSnapshot(partnerA, wsId);
    const [col1, col2] = snapshot.columns;

    const cardA = await ws.createCard(partnerA, wsId, {
      columnId: col1.id,
      title: "Tarea A",
    });
    const cardB = await ws.createCard(partnerA, wsId, {
      columnId: col1.id,
      title: "Tarea B",
    });

    await ws.moveCard(partnerA, cardA, col2.id, 0);

    const after = await ws.getWorkspaceSnapshot(partnerA, wsId);
    const movedA = after.cards.find((c) => c.id === cardA)!;
    const stayedB = after.cards.find((c) => c.id === cardB)!;
    expect(movedA.columnId).toBe(col2.id);
    expect(movedA.position).toBe(0);
    expect(stayedB.position).toBe(0);

    await expect(
      ws.moveCard(partnerB, cardA, col1.id, 0),
    ).rejects.toThrow();
    await expect(
      ws.updateCard(partnerB, cardA, { title: "hackeada" }),
    ).rejects.toThrow();
  });

  it("deleting a column moves its cards to the first remaining column", async () => {
    const list = await ws.getWorkspaces(partnerA);
    const wsId = list[0].id;
    const column = await ws.createColumn(partnerA, wsId, "Temporal");
    const cardId = await ws.createCard(partnerA, wsId, {
      columnId: column.id,
      title: "Huérfana",
    });

    await ws.deleteColumn(partnerA, column.id);

    const after = await ws.getWorkspaceSnapshot(partnerA, wsId);
    expect(after.columns.find((c) => c.id === column.id)).toBeUndefined();
    const survivor = after.cards.find((c) => c.id === cardId)!;
    expect(survivor.columnId).toBe(after.columns[0].id);
  });

  it("stores free-form profile fields in jsonb extra", async () => {
    const list = await ws.getWorkspaces(partnerA);
    const wsId = list[0].id;

    await ws.updateWorkspaceProfile(partnerA, wsId, {
      businessName: "Negocio Demo",
      extra: { instagram: "@demo", facturacion_anual: "120k" },
    });

    const snapshot = await ws.getWorkspaceSnapshot(partnerA, wsId);
    expect(snapshot.profile.businessName).toBe("Negocio Demo");
    expect(snapshot.profile.extra).toEqual({
      instagram: "@demo",
      facturacion_anual: "120k",
    });
  });

  it("assembles the export document data and scopes it by partner", async () => {
    const list = await ws.getWorkspaces(partnerA);
    const wsId = list[0].id;

    await ws.updateWorkspaceProfile(partnerA, wsId, {
      strategyDoc: "# Plan\n- Fase 1\n- Fase 2",
    });
    const { columns } = await ws.getWorkspaceSnapshot(partnerA, wsId);
    await ws.createCard(partnerA, wsId, {
      columnId: columns[0].id,
      title: "Tarea exportable",
      description: "Aparece en el documento",
    });
    // Generaciones IA del workspace: la más reciente por tipo entra al export.
    await db.insert(schema.aiGenerations).values([
      {
        partnerId: partnerA,
        workspaceId: wsId,
        type: "estrategia",
        outputText: "Estrategia vieja",
        tokensInput: 1,
        tokensOutput: 1,
        costUsd: "0",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      {
        partnerId: partnerA,
        workspaceId: wsId,
        type: "estrategia",
        outputText: "Estrategia nueva",
        tokensInput: 1,
        tokensOutput: 1,
        costUsd: "0",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      },
    ]);

    const data = await ws.getWorkspaceExportData(partnerA, wsId);
    expect(data.profile.strategyDoc).toContain("# Plan");
    expect(data.columns.length).toBeGreaterThan(0);
    expect(data.columns.some((c) => c.cards.length > 0)).toBe(true);
    const gen = data.latestGenerations.find((g) => g.type === "estrategia");
    expect(gen?.outputText).toBe("Estrategia nueva");

    // El snapshot también expone la última generación de estrategia.
    const snapshot = await ws.getWorkspaceSnapshot(partnerA, wsId);
    expect(snapshot.latestStrategyGeneration?.outputText).toBe("Estrategia nueva");

    // Cross-tenant: exportar el workspace de A como B ⇒ "no encontrado".
    await expect(ws.getWorkspaceExportData(partnerB, wsId)).rejects.toThrow(
      /no encontrado/,
    );

    const { eq } = await import("drizzle-orm");
    await db
      .delete(schema.aiGenerations)
      .where(eq(schema.aiGenerations.partnerId, partnerA));
  });
});
