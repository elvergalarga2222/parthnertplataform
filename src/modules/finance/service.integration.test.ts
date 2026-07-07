import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Integration tests against a real Postgres (needs the finance views migration).
// Run only when DATABASE_URL is set; CI has no database and skips them.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("finance service (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let finance: typeof import("./service");

  let partnerA: string;
  let partnerB: string;
  const createdPartners: string[] = [];

  const isoDay = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    finance = await import("./service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-fin-${label}-${randomUUID()}@test.dev`,
          displayName: `Test Fin ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;
  });

  afterAll(async () => {
    if (!hasDb || createdPartners.length === 0) return;
    const { eq, inArray } = await import("drizzle-orm");
    for (const partnerId of createdPartners) {
      await db.delete(schema.invoices).where(eq(schema.invoices.partnerId, partnerId));
      await db.delete(schema.expenses).where(eq(schema.expenses.partnerId, partnerId));
      await db
        .delete(schema.budgetProjections)
        .where(eq(schema.budgetProjections.partnerId, partnerId));
      await db
        .delete(schema.aiGenerations)
        .where(eq(schema.aiGenerations.partnerId, partnerId));
      // The won-stage deal auto-creates a workspace via trigger; tear its tree
      // down before the partner to satisfy the FK.
      const wsRows = await db
        .select({ id: schema.workspaces.id })
        .from(schema.workspaces)
        .where(eq(schema.workspaces.partnerId, partnerId));
      const wsIds = wsRows.map((w) => w.id);
      if (wsIds.length) {
        await db.delete(schema.kanbanCards).where(inArray(schema.kanbanCards.workspaceId, wsIds));
        await db.delete(schema.kanbanColumns).where(inArray(schema.kanbanColumns.workspaceId, wsIds));
        await db
          .delete(schema.workspaceProfiles)
          .where(inArray(schema.workspaceProfiles.workspaceId, wsIds));
        await db.delete(schema.workspaces).where(inArray(schema.workspaces.id, wsIds));
      }
      await db.delete(schema.deals).where(eq(schema.deals.partnerId, partnerId));
      await db
        .delete(schema.pipelineStages)
        .where(eq(schema.pipelineStages.partnerId, partnerId));
      await db.delete(schema.partners).where(eq(schema.partners.id, partnerId));
    }
  });

  it("separates revenue by currency (no cross-currency mixing)", async () => {
    await db.insert(schema.invoices).values([
      { partnerId: partnerA, clientName: "EUR client 1", amount: "1000", currency: "EUR", status: "pagado", paidAt: new Date() },
      { partnerId: partnerA, clientName: "EUR client 2", amount: "500", currency: "EUR", status: "pagado", paidAt: new Date() },
      { partnerId: partnerA, clientName: "USD client", amount: "800", currency: "USD", status: "pagado", paidAt: new Date() },
      // Pending invoices are NOT revenue yet.
      { partnerId: partnerA, clientName: "Pending", amount: "9999", currency: "EUR", status: "pendiente", dueDate: isoDay(10) },
    ]);

    const eur = await finance.getMonthlyRevenue(partnerA, "EUR");
    const usd = await finance.getMonthlyRevenue(partnerA, "USD");

    const eurTotal = eur.reduce((s, r) => s + r.revenue, 0);
    const usdTotal = usd.reduce((s, r) => s + r.revenue, 0);
    expect(eurTotal).toBe(1500); // 1000 + 500, pending excluded
    expect(usdTotal).toBe(800);
    // Every returned row is the requested currency — never a mix.
    expect(eur.every((r) => r.currency === "EUR")).toBe(true);
    expect(usd.every((r) => r.currency === "USD")).toBe(true);
  });

  it("subtracts expenses (same currency) and AI cost only from the USD row", async () => {
    // EUR: revenue 1500 (from previous test) - expense 300 = 1200, AI cost 0.
    await db.insert(schema.expenses).values({
      partnerId: partnerA, category: "ia", amount: "300", currency: "EUR", incurredAt: isoDay(0),
    });
    // AI cost is in USD (ai_generations.cost_usd) → only the USD profit row.
    await db.insert(schema.aiGenerations).values({
      partnerId: partnerA, type: "guion", costUsd: "50", tokensInput: 10, tokensOutput: 10,
    });

    const eur = await finance.getMonthlyProfit(partnerA, "EUR");
    const usd = await finance.getMonthlyProfit(partnerA, "USD");

    const eurRow = eur.find((r) => r.revenue > 0) ?? eur[0];
    expect(eurRow.expenses).toBe(300);
    expect(eurRow.iaCost).toBe(0); // AI cost never hits the EUR row
    expect(eurRow.profit).toBe(1200); // 1500 - 300 - 0

    const usdRow = usd.find((r) => r.revenue > 0 || r.iaCost > 0) ?? usd[0];
    expect(usdRow.iaCost).toBe(50);
    expect(usdRow.profit).toBe(750); // 800 - 0 - 50
  });

  it("sums open pipeline from the CRM, excluding won/lost, by currency", async () => {
    const [open] = await db
      .insert(schema.pipelineStages)
      .values({ partnerId: partnerA, name: "Propuesta", position: 0 })
      .returning({ id: schema.pipelineStages.id });
    const [won] = await db
      .insert(schema.pipelineStages)
      .values({ partnerId: partnerA, name: "Ganado", position: 1, isWon: true })
      .returning({ id: schema.pipelineStages.id });

    await db.insert(schema.deals).values([
      { partnerId: partnerA, title: "Open EUR", value: "4000", currency: "EUR", stageId: open.id },
      { partnerId: partnerA, title: "Won EUR", value: "9000", currency: "EUR", stageId: won.id },
      { partnerId: partnerA, title: "Open USD", value: "2000", currency: "USD", stageId: open.id },
    ]);

    const eur = await finance.getPipelineOpen(partnerA, "EUR");
    expect(eur.total).toBe(4000); // won excluded, USD excluded
    expect(eur.dealsOpen).toBe(1);
  });

  it("classifies overdue and near-due invoices as alerts", async () => {
    await db.insert(schema.invoices).values([
      { partnerId: partnerB, clientName: "Overdue pending", amount: "100", currency: "USD", status: "pendiente", dueDate: isoDay(-5) },
      { partnerId: partnerB, clientName: "Explicit vencido", amount: "200", currency: "USD", status: "vencido", dueDate: isoDay(-1) },
      { partnerId: partnerB, clientName: "Near due", amount: "300", currency: "USD", status: "pendiente", dueDate: isoDay(2) },
      { partnerId: partnerB, clientName: "Future", amount: "400", currency: "USD", status: "pendiente", dueDate: isoDay(30) },
      { partnerId: partnerB, clientName: "Paid", amount: "500", currency: "USD", status: "pagado", dueDate: isoDay(-3), paidAt: new Date() },
    ]);

    const alerts = await finance.getInvoiceAlerts(partnerB);
    expect(alerts.overdue.map((a) => a.clientName).sort()).toEqual([
      "Explicit vencido",
      "Overdue pending",
    ]);
    expect(alerts.upcoming.map((a) => a.clientName)).toEqual(["Near due"]);
    expect(alerts.total).toBe(3); // Future and Paid excluded
  });

  it("upserts invoices from the webhook idempotently by external_ref", async () => {
    const input = {
      externalRef: `ext-${randomUUID()}`,
      clientName: "Webhook client",
      amount: 1234,
      currency: "USD" as const,
      status: "pagado" as const,
    };

    const first = await finance.upsertInvoiceFromWebhook(partnerB, input);
    expect(first.created).toBe(true);

    // Replay with the same ref → updates, never duplicates.
    const second = await finance.upsertInvoiceFromWebhook(partnerB, {
      ...input,
      clientName: "Webhook client (renamed)",
      amount: 2000,
    });
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);

    const { and, eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.partnerId, partnerB),
          eq(schema.invoices.externalRef, input.externalRef),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].clientName).toBe("Webhook client (renamed)");
    expect(Number(rows[0].amount)).toBe(2000);
    // status 'pagado' without explicit paidAt defaults the payment time.
    expect(rows[0].paidAt).not.toBeNull();
  });

  it("isolates finance data between partners", async () => {
    // partnerA's revenue never appears under partnerB and vice versa.
    const revB = await finance.getMonthlyRevenue(partnerB, "EUR");
    expect(revB.reduce((s, r) => s + r.revenue, 0)).toBe(0);

    const alertsA = await finance.getInvoiceAlerts(partnerA);
    // A has only a pending EUR invoice due in +10 days → not an alert.
    expect(alertsA.total).toBe(0);
  });
});
