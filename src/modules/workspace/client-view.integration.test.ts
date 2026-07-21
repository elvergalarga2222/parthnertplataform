import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Vista de Cliente (regla #7). Es la única superficie que se lee sin sesión, así
// que los tests se centran en lo que NO debe salir: tarjetas no marcadas,
// tarjetas de otro partner, `assignee`, y enlaces apagados o rotados.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("client view by token (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let crm: typeof import("@/modules/crm/service");
  let ws: typeof import("./service");

  const createdPartners: string[] = [];
  let partnerA: string;
  let partnerB: string;
  let workspaceA: string;
  let workspaceB: string;
  let columnA: string;
  let tokenA: string;

  async function makePartnerWithWorkspace(label: string) {
    const [partner] = await db
      .insert(schema.partners)
      .values({
        skoolMemberId: `test:${randomUUID()}`,
        email: `test-cv-${label}-${randomUUID()}@test.dev`,
        displayName: `Test CV ${label}`,
      })
      .returning({ id: schema.partners.id });
    createdPartners.push(partner.id);

    await crm.ensureDefaultStages(partner.id);
    const snapshot = await crm.getCrmSnapshot(partner.id);
    const wonStageId = snapshot.stages.find((s) => s.isWon)!.id;

    const dealId = await crm.createDeal(partner.id, {
      title: `Cliente ${label}`,
      value: 1000,
      stageId: snapshot.stages.find((s) => !s.isWon)!.id,
    });
    // El workspace lo crea el trigger al entrar en una etapa is_won.
    await crm.moveDealStage(partner.id, dealId, wonStageId, 0);
    const list = await ws.getWorkspaces(partner.id);
    return {
      partnerId: partner.id,
      workspaceId: list.find((w) => w.dealId === dealId)!.id,
    };
  }

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    crm = await import("@/modules/crm/service");
    ws = await import("./service");

    const a = await makePartnerWithWorkspace("a");
    const b = await makePartnerWithWorkspace("b");
    partnerA = a.partnerId;
    workspaceA = a.workspaceId;
    partnerB = b.partnerId;
    workspaceB = b.workspaceId;

    columnA = (await ws.getWorkspaceSnapshot(partnerA, workspaceA)).columns[0].id;
    tokenA = await ws.rotateClientViewToken(partnerA, workspaceA);
    await ws.setClientViewEnabled(partnerA, workspaceA, true);
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
        await db
          .delete(schema.kanbanCards)
          .where(inArray(schema.kanbanCards.workspaceId, wsIds));
        await db
          .delete(schema.kanbanColumns)
          .where(inArray(schema.kanbanColumns.workspaceId, wsIds));
        await db
          .delete(schema.workspaceProfiles)
          .where(inArray(schema.workspaceProfiles.workspaceId, wsIds));
        await db.delete(schema.workspaces).where(inArray(schema.workspaces.id, wsIds));
      }
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
      await db.delete(schema.deals).where(eq(schema.deals.partnerId, partnerId));
      await db
        .delete(schema.pipelineStages)
        .where(eq(schema.pipelineStages.partnerId, partnerId));
      await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
    }
  });

  it("defaults new cards to private (fail-closed)", async () => {
    await ws.createCard(partnerA, workspaceA, { columnId: columnA, title: "Privada" });

    const view = await ws.getClientViewByToken(tokenA);
    expect(view).not.toBeNull();
    expect(view!.columns.flatMap((c) => c.cards)).toHaveLength(0);
  });

  it("exposes only cards explicitly marked visible", async () => {
    const visibleId = await ws.createCard(partnerA, workspaceA, {
      columnId: columnA,
      title: "Visible para el cliente",
      description: "Avance publicado",
      assignee: "Ana (interno)",
      dueDate: "2026-08-14",
    });
    await ws.setCardClientVisibility(partnerA, visibleId, true);

    const view = await ws.getClientViewByToken(tokenA);
    const cards = view!.columns.flatMap((c) => c.cards);

    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("Visible para el cliente");
    expect(cards[0].description).toBe("Avance publicado");
    expect(cards[0].dueDate).toBe("2026-08-14");
    // Regla #7: `assignee` es operación interna y no debe existir en el payload.
    expect(cards[0]).not.toHaveProperty("assignee");
    expect(JSON.stringify(view)).not.toContain("Ana (interno)");
  });

  it("never leaks another partner's cards through a token", async () => {
    const columnB = (await ws.getWorkspaceSnapshot(partnerB, workspaceB)).columns[0].id;
    const foreignId = await ws.createCard(partnerB, workspaceB, {
      columnId: columnB,
      title: "Secreto del partner B",
    });
    await ws.setCardClientVisibility(partnerB, foreignId, true);

    const view = await ws.getClientViewByToken(tokenA);
    expect(JSON.stringify(view)).not.toContain("Secreto del partner B");
    expect(view!.clientName).toBe("Cliente a");
  });

  it("rejects unknown, empty and rotated tokens", async () => {
    await expect(ws.getClientViewByToken("")).resolves.toBeNull();
    await expect(ws.getClientViewByToken("no-existe")).resolves.toBeNull();
    await expect(ws.getClientViewByToken(randomUUID())).resolves.toBeNull();

    // Rotar invalida el enlace anterior de inmediato.
    const oldToken = tokenA;
    tokenA = await ws.rotateClientViewToken(partnerA, workspaceA);
    expect(tokenA).not.toBe(oldToken);
    await expect(ws.getClientViewByToken(oldToken)).resolves.toBeNull();
    await expect(ws.getClientViewByToken(tokenA)).resolves.not.toBeNull();
  });

  it("returns null while the link is disabled, and again when re-enabled", async () => {
    await ws.setClientViewEnabled(partnerA, workspaceA, false);
    await expect(ws.getClientViewByToken(tokenA)).resolves.toBeNull();

    await ws.setClientViewEnabled(partnerA, workspaceA, true);
    await expect(ws.getClientViewByToken(tokenA)).resolves.not.toBeNull();
  });

  it("cuts the public link when the owning partner is frozen (regla #2)", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.partners)
      .set({ status: "frozen" })
      .where(eq(schema.partners.id, partnerA));

    await expect(ws.getClientViewByToken(tokenA)).resolves.toBeNull();

    await db
      .update(schema.partners)
      .set({ status: "active" })
      .where(eq(schema.partners.id, partnerA));
    await expect(ws.getClientViewByToken(tokenA)).resolves.not.toBeNull();
  });

  it("scopes share management by partner", async () => {
    await expect(ws.rotateClientViewToken(partnerB, workspaceA)).rejects.toThrow();
    await expect(ws.setClientViewEnabled(partnerB, workspaceA, false)).rejects.toThrow();
    await expect(ws.getClientViewShareState(partnerB, workspaceA)).rejects.toThrow();

    // El enlace de A sigue vivo tras los intentos de B.
    await expect(ws.getClientViewByToken(tokenA)).resolves.not.toBeNull();
  });

  it("refuses to enable a workspace that has no token yet", async () => {
    await expect(ws.setClientViewEnabled(partnerB, workspaceB, true)).rejects.toThrow();

    const state = await ws.getClientViewShareState(partnerB, workspaceB);
    expect(state.enabled).toBe(false);
    expect(state.hasToken).toBe(false);
  });
});
