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

  // --- PR-4b: CRUD, calendario, presupuesto, 70/30 y meta mensual ------------

  it("creates, lists (effective status), updates and deletes an invoice", async () => {
    const id = await finance.createInvoice(partnerA, {
      clientName: "CRUD Cliente",
      amount: 700,
      currency: "COP",
      status: "pendiente",
      kind: "proyecto",
      issuedAt: isoDay(-10),
      dueDate: isoDay(-1), // vencida en lectura, sin job
    });

    const list = await finance.listInvoices(partnerA, { currency: "COP" });
    const created = list.find((i) => i.id === id);
    expect(created).toBeDefined();
    expect(created!.status).toBe("vencido"); // status efectivo derivado
    expect(created!.kind).toBe("proyecto");

    // El filtro de status usa el status EFECTIVO.
    const vencidas = await finance.listInvoices(partnerA, {
      currency: "COP",
      status: "vencido",
    });
    expect(vencidas.some((i) => i.id === id)).toBe(true);

    await finance.updateInvoice(partnerA, id, {
      kind: "asesoria_mensual",
      dueDate: isoDay(5),
    });
    const [after] = await finance.listInvoices(partnerA, { currency: "COP" });
    expect(after.kind).toBe("asesoria_mensual");
    expect(after.status).toBe("pendiente"); // ya no está vencida

    await finance.deleteInvoice(partnerA, id);
    expect(
      (await finance.listInvoices(partnerA, { currency: "COP" })).length,
    ).toBe(0);
  });

  it("markInvoicePaid feeds v_monthly_revenue", async () => {
    const id = await finance.createInvoice(partnerA, {
      clientName: "Pago directo",
      amount: 2000,
      currency: "COP",
      status: "pendiente",
      kind: "proyecto",
      issuedAt: isoDay(0),
    });
    const before = await finance.getMonthlyRevenue(partnerA, "COP");
    const beforeTotal = before.reduce((s, r) => s + r.revenue, 0);

    await finance.markInvoicePaid(partnerA, id);

    const [row] = await finance.listInvoices(partnerA, { currency: "COP" });
    expect(row.status).toBe("pagado");
    expect(row.paidAt).not.toBeNull();

    const revenue = await finance.getMonthlyRevenue(partnerA, "COP");
    expect(revenue.reduce((s, r) => s + r.revenue, 0)).toBe(beforeTotal + 2000);

    await finance.deleteInvoice(partnerA, id);
  });

  it("never deletes automation invoices (external_ref)", async () => {
    const { id } = await finance.upsertInvoiceFromWebhook(partnerA, {
      externalRef: `ext-del-${randomUUID()}`,
      clientName: "Automática",
      amount: 100,
      currency: "USD",
    });
    await expect(finance.deleteInvoice(partnerA, id)).rejects.toThrow(
      /automáticas/,
    );
  });

  it("isolates invoice/expense mutations between partners", async () => {
    const invoiceId = await finance.createInvoice(partnerA, {
      clientName: "Solo de A",
      amount: 10,
      currency: "EUR",
      status: "pendiente",
      kind: "otro",
      issuedAt: isoDay(0),
    });
    const expenseId = await finance.createExpense(partnerA, {
      category: "ia",
      amount: 5,
      currency: "EUR",
      incurredAt: isoDay(0),
    });

    await expect(
      finance.updateInvoice(partnerB, invoiceId, { amount: 999 }),
    ).rejects.toThrow(/no encontrada/);
    await expect(finance.deleteInvoice(partnerB, invoiceId)).rejects.toThrow(
      /no encontrada/,
    );
    await expect(
      finance.markInvoicePaid(partnerB, invoiceId),
    ).rejects.toThrow(/no encontrada/);
    await expect(
      finance.updateExpense(partnerB, expenseId, { amount: 999 }),
    ).rejects.toThrow(/no encontrado/);
    await expect(finance.deleteExpense(partnerB, expenseId)).rejects.toThrow(
      /no encontrado/,
    );
    // B tampoco puede colgar una factura de un workspace de A: no hay
    // workspaces de B, así que basta validar el propio.
    await expect(
      finance.createInvoice(partnerB, {
        clientName: "Cruzada",
        amount: 1,
        currency: "EUR",
        status: "pendiente",
        kind: "proyecto",
        issuedAt: isoDay(0),
        workspaceId: randomUUID(),
      }),
    ).rejects.toThrow(/Espacio no encontrado/);

    await finance.deleteInvoice(partnerA, invoiceId);
    await finance.deleteExpense(partnerA, expenseId);
  });

  it("upserts the monthly budget without duplicating", async () => {
    const month = "2031-05";
    await finance.upsertBudget(partnerA, {
      month,
      projectedRevenue: 80_000_000,
      budgetExpenses: 10_000_000,
      targetProfit: 40_000_000,
      currency: "COP",
    });
    await finance.upsertBudget(partnerA, {
      month,
      projectedRevenue: 90_000_000,
      budgetExpenses: 12_000_000,
      targetProfit: 45_000_000,
      currency: "COP",
    });

    const budget = await finance.getBudget(partnerA, month);
    expect(budget).not.toBeNull();
    expect(budget!.projectedRevenue).toBe(90_000_000);
    expect(budget!.targetProfit).toBe(45_000_000);

    const { and, eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(schema.budgetProjections)
      .where(
        and(
          eq(schema.budgetProjections.partnerId, partnerA),
          eq(schema.budgetProjections.month, `${month}-01`),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it("returns the collections calendar for a month, any status", async () => {
    const ids = await Promise.all([
      finance.createInvoice(partnerA, {
        clientName: "Mayo pendiente", amount: 100, currency: "COP",
        status: "pendiente", kind: "proyecto", issuedAt: "2031-04-20", dueDate: "2031-05-10",
      }),
      finance.createInvoice(partnerA, {
        clientName: "Mayo pagada", amount: 200, currency: "COP",
        status: "pagado", kind: "proyecto", issuedAt: "2031-04-20", dueDate: "2031-05-25",
      }),
      finance.createInvoice(partnerA, {
        clientName: "Junio", amount: 300, currency: "COP",
        status: "pendiente", kind: "proyecto", issuedAt: "2031-04-20", dueDate: "2031-06-02",
      }),
    ]);

    const calendar = await finance.getCollectionsCalendar(partnerA, "2031-05");
    expect(calendar.map((c) => c.clientName).sort()).toEqual([
      "Mayo pagada",
      "Mayo pendiente",
    ]);
    // Con due_date futuro respecto a now, la pendiente sigue pendiente.
    expect(
      calendar.find((c) => c.clientName === "Mayo pendiente")!.effectiveStatus,
    ).toBe("pendiente");

    for (const id of ids) await finance.deleteInvoice(partnerA, id);
  });

  it("computes the 70/30 rule over paid invoices of the window", async () => {
    const mk = (kind: "proyecto" | "asesoria_mensual", amount: number) =>
      finance.createInvoice(partnerB, {
        clientName: `70/30 ${kind} ${amount}`,
        amount,
        currency: "EUR",
        status: "pagado",
        kind,
        issuedAt: isoDay(-5),
      });
    const ids = await Promise.all([
      mk("proyecto", 600),
      mk("asesoria_mensual", 400),
    ]);

    const result = await finance.getSeventyThirty(partnerB, "EUR");
    expect(result.totalPaid).toBe(1000);
    expect(result.recurringPaid).toBe(400);
    expect(result.recurringPct).toBeCloseTo(0.4);
    expect(result.breached).toBe(true); // 40% > 30%

    for (const id of ids) await finance.deleteInvoice(partnerB, id);

    // Sin facturas pagadas: 0% y sin brecha (nunca división por cero).
    const empty = await finance.getSeventyThirty(partnerB, "COP");
    expect(empty.recurringPct).toBe(0);
    expect(empty.breached).toBe(false);
  });

  it("computes monthly goal progress from the budget (25% case)", async () => {
    const month = "2031-08";
    await finance.upsertBudget(partnerA, {
      month,
      projectedRevenue: 80_000_000,
      budgetExpenses: 0,
      targetProfit: 40_000_000,
      currency: "COP",
    });
    const id = await finance.createInvoice(partnerA, {
      clientName: "Meta agosto",
      amount: 20_000_000,
      currency: "COP",
      status: "pendiente",
      kind: "proyecto",
      issuedAt: `${month}-01`,
    });
    await finance.markInvoicePaid(partnerA, id, new Date("2031-08-15T12:00:00Z"));

    const goal = await finance.getMonthlyGoalProgress(partnerA, "COP", month);
    expect(goal).not.toBeNull();
    expect(goal!.revenueGoal).toBe(80_000_000);
    expect(goal!.revenueActual).toBe(20_000_000);
    expect(goal!.revenuePct).toBe(25);
    expect(goal!.profitGoal).toBe(40_000_000);
    expect(goal!.profitPct).toBe(50); // profit = revenue (sin gastos del mes)

    // Sin presupuesto para el mes → null (la UI muestra el CTA).
    expect(await finance.getMonthlyGoalProgress(partnerA, "COP", "2031-09")).toBeNull();
    // Presupuesto en otra moneda → null (nunca mezclar monedas).
    expect(await finance.getMonthlyGoalProgress(partnerA, "EUR", month)).toBeNull();

    await finance.deleteInvoice(partnerA, id);
  });
});
