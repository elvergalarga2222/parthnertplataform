import { and, asc, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  budgetProjections,
  deals,
  expenses,
  invoices,
  pipelineStages,
  workspaces,
} from "@/db/schema";
import { daysBetween, toIsoOrNull } from "@/lib/dates";
import {
  buildWeekBuckets,
  effectiveStatus,
  goalPct,
  monthEndIso,
  monthStartIso,
} from "./helpers";
import type {
  BudgetView,
  CalendarInvoice,
  Currency,
  ExpenseCategory,
  ExpenseView,
  InvoiceAlert,
  InvoiceAlerts,
  InvoiceKind,
  InvoiceStatus,
  InvoiceView,
  InvoiceWebhookInput,
  MonthlyGoalProgress,
  MonthlyProfitRow,
  MonthlyRevenueRow,
  SeventyThirty,
} from "./types";
import { CURRENCIES } from "./types";

// Partner Business (Fase 4). Multi-tenant rule (CLAUDE.md #3): every query
// filters by partnerId. Amounts never cross currencies — the aggregation views
// group by currency and callers read the partner's default_currency. This module
// exposes raw finance data; the dashboard composition layer assembles the KPIs.

export class FinanceError extends Error {}

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as string[]).includes(value);
}

// --- Aggregation views ------------------------------------------------------

/** Rows of v_monthly_revenue for a partner+currency, oldest first. */
export async function getMonthlyRevenue(
  partnerId: string,
  currency: Currency,
): Promise<MonthlyRevenueRow[]> {
  const rows = await db.execute<{
    month: string;
    currency: string;
    revenue: string | number;
  }>(sql`
    SELECT month::text AS month, currency, revenue
    FROM v_monthly_revenue
    WHERE partner_id = ${partnerId} AND currency = ${currency}
    ORDER BY month ASC
  `);
  return Array.from(rows).map((r) => ({
    month: r.month,
    currency: isCurrency(r.currency) ? r.currency : currency,
    revenue: toNumber(r.revenue),
  }));
}

/** Rows of v_monthly_profit for a partner+currency, oldest first. */
export async function getMonthlyProfit(
  partnerId: string,
  currency: Currency,
): Promise<MonthlyProfitRow[]> {
  const rows = await db.execute<{
    month: string;
    currency: string;
    revenue: string | number;
    expenses: string | number;
    ia_cost: string | number;
    profit: string | number;
  }>(sql`
    SELECT month::text AS month, currency, revenue, expenses, ia_cost, profit
    FROM v_monthly_profit
    WHERE partner_id = ${partnerId} AND currency = ${currency}
    ORDER BY month ASC
  `);
  return Array.from(rows).map((r) => ({
    month: r.month,
    currency: isCurrency(r.currency) ? r.currency : currency,
    revenue: toNumber(r.revenue),
    expenses: toNumber(r.expenses),
    iaCost: toNumber(r.ia_cost),
    profit: toNumber(r.profit),
  }));
}

// --- Open pipeline (from CRM) ----------------------------------------------

export interface PipelineOpen {
  total: number;
  dealsOpen: number;
  currency: Currency;
  stages: { name: string; amount: number; deals: number }[];
}

/**
 * Sum of open deals (stage not won and not lost) for the partner's currency,
 * broken down by stage. Feeds the "Pipeline Abierto" KPI funnel.
 */
export async function getPipelineOpen(
  partnerId: string,
  currency: Currency,
): Promise<PipelineOpen> {
  const rows = await db
    .select({
      stageId: pipelineStages.id,
      name: pipelineStages.name,
      position: pipelineStages.position,
      amount: sql<string>`COALESCE(SUM(${deals.value}), 0)`,
      count: sql<string>`COUNT(${deals.id})`,
    })
    .from(pipelineStages)
    .leftJoin(
      deals,
      and(
        eq(deals.stageId, pipelineStages.id),
        eq(deals.partnerId, partnerId),
        eq(deals.currency, currency),
      ),
    )
    .where(
      and(
        eq(pipelineStages.partnerId, partnerId),
        eq(pipelineStages.isWon, false),
        eq(pipelineStages.isLost, false),
      ),
    )
    .groupBy(pipelineStages.id, pipelineStages.name, pipelineStages.position)
    .orderBy(asc(pipelineStages.position));

  const stages = rows.map((r) => ({
    name: r.name,
    amount: toNumber(r.amount),
    deals: toNumber(r.count),
  }));
  return {
    total: stages.reduce((sum, s) => sum + s.amount, 0),
    dealsOpen: stages.reduce((sum, s) => sum + s.deals, 0),
    currency,
    stages,
  };
}

// --- In-app alerts ----------------------------------------------------------

const NEAR_DUE_DAYS = 3;

/**
 * Overdue and near-due (within 3 days) invoices for the topbar/dashboard alert.
 * Overdue = status 'vencido' OR a pending invoice past its due date; a partner
 * never needs to manually flip the status for the alert to fire.
 */
export async function getInvoiceAlerts(
  partnerId: string,
  now = new Date(),
): Promise<InvoiceAlerts> {
  const rows = await db
    .select({
      id: invoices.id,
      clientName: invoices.clientName,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.partnerId, partnerId),
        sql`${invoices.status} <> 'pagado'`,
        isNotNull(invoices.dueDate),
      ),
    );

  const overdue: InvoiceAlert[] = [];
  const upcoming: InvoiceAlert[] = [];

  for (const row of rows) {
    if (!row.dueDate) continue;
    const days = daysBetween(now, row.dueDate);
    const base = {
      id: row.id,
      clientName: row.clientName,
      amount: toNumber(row.amount),
      currency: (isCurrency(row.currency) ? row.currency : "USD") as Currency,
      dueDate: row.dueDate,
      status: row.status as InvoiceStatus,
      daysUntilDue: days,
    };
    if (row.status === "vencido" || days < 0) {
      overdue.push({ ...base, kind: "vencido" });
    } else if (days <= NEAR_DUE_DAYS) {
      upcoming.push({ ...base, kind: "por_vencer" });
    }
  }

  overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  return { overdue, upcoming, total: overdue.length + upcoming.length };
}

// --- Invoices CRUD -----------------------------------------------------------

export interface InvoiceInput {
  clientName: string;
  description?: string | null;
  amount: number;
  currency: Currency;
  status: InvoiceStatus;
  kind: InvoiceKind;
  issuedAt: string; // YYYY-MM-DD
  dueDate?: string | null;
  workspaceId?: string | null;
}

/** El workspace vinculado debe ser del partner (regla #3). */
async function requireOwnWorkspace(
  partnerId: string,
  workspaceId: string,
): Promise<void> {
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)));
  if (!ws) throw new FinanceError("Espacio no encontrado.");
}

function toInvoiceView(
  row: typeof invoices.$inferSelect,
  workspaceName: string | null,
  now: Date,
): InvoiceView {
  return {
    id: row.id,
    clientName: row.clientName,
    description: row.description,
    amount: toNumber(row.amount),
    currency: isCurrency(row.currency) ? row.currency : "USD",
    status: effectiveStatus(row.status as InvoiceStatus, row.dueDate, now),
    kind: row.kind as InvoiceKind,
    issuedAt: row.issuedAt,
    dueDate: row.dueDate,
    paidAt: toIsoOrNull(row.paidAt),
    workspaceId: row.workspaceId,
    workspaceName,
    externalRef: row.externalRef,
  };
}

/**
 * Invoices of the partner, newest due first is left to the UI; default order is
 * due date ascending (nulls last), then issued date. The `status` filter matches
 * the EFFECTIVE status, so "vencido" includes overdue pending invoices.
 */
export async function listInvoices(
  partnerId: string,
  filter?: {
    status?: InvoiceStatus | "todas";
    currency?: Currency;
    month?: string; // YYYY-MM sobre issued_at
  },
  now: Date = new Date(),
): Promise<InvoiceView[]> {
  const conditions = [eq(invoices.partnerId, partnerId)];
  if (filter?.currency) conditions.push(eq(invoices.currency, filter.currency));
  if (filter?.month) {
    conditions.push(gte(invoices.issuedAt, monthStartIso(filter.month)));
    conditions.push(lte(invoices.issuedAt, monthEndIso(filter.month)));
  }

  const rows = await db
    .select({ invoice: invoices, workspaceName: workspaces.clientName })
    .from(invoices)
    .leftJoin(workspaces, eq(invoices.workspaceId, workspaces.id))
    .where(and(...conditions))
    .orderBy(
      sql`${invoices.dueDate} ASC NULLS LAST`,
      asc(invoices.issuedAt),
      asc(invoices.createdAt),
    );

  const views = rows.map(({ invoice, workspaceName }) =>
    toInvoiceView(invoice, workspaceName, now),
  );
  if (!filter?.status || filter.status === "todas") return views;
  return views.filter((v) => v.status === filter.status);
}

export async function createInvoice(
  partnerId: string,
  input: InvoiceInput,
): Promise<string> {
  if (input.workspaceId) await requireOwnWorkspace(partnerId, input.workspaceId);
  const [row] = await db
    .insert(invoices)
    .values({
      partnerId,
      clientName: input.clientName,
      description: input.description ?? null,
      amount: String(input.amount),
      currency: input.currency,
      status: input.status,
      kind: input.kind,
      issuedAt: input.issuedAt,
      dueDate: input.dueDate ?? null,
      // Crear directamente como pagada fija el cobro en este instante.
      paidAt: input.status === "pagado" ? new Date() : null,
      workspaceId: input.workspaceId ?? null,
    })
    .returning({ id: invoices.id });
  return row.id;
}

export async function updateInvoice(
  partnerId: string,
  invoiceId: string,
  patch: Partial<InvoiceInput>,
): Promise<void> {
  if (patch.workspaceId) await requireOwnWorkspace(partnerId, patch.workspaceId);

  const [current] = await db
    .select({ status: invoices.status, paidAt: invoices.paidAt })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.partnerId, partnerId)));
  if (!current) throw new FinanceError("Factura no encontrada.");

  // Coherencia status ↔ paid_at al editar: marcar 'pagado' sella el cobro
  // ahora (si no lo tenía); salir de 'pagado' limpia paid_at.
  let paidAtPatch: { paidAt: Date | null } | Record<string, never> = {};
  if (patch.status && patch.status !== current.status) {
    if (patch.status === "pagado" && !current.paidAt) {
      paidAtPatch = { paidAt: new Date() };
    } else if (patch.status !== "pagado") {
      paidAtPatch = { paidAt: null };
    }
  }

  const result = await db
    .update(invoices)
    .set({
      ...(patch.clientName !== undefined ? { clientName: patch.clientName } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description ?? null }
        : {}),
      ...(patch.amount !== undefined ? { amount: String(patch.amount) } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.issuedAt !== undefined ? { issuedAt: patch.issuedAt } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ?? null } : {}),
      ...(patch.workspaceId !== undefined
        ? { workspaceId: patch.workspaceId ?? null }
        : {}),
      ...paidAtPatch,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.partnerId, partnerId)))
    .returning({ id: invoices.id });
  if (result.length === 0) throw new FinanceError("Factura no encontrada.");
}

/**
 * Deletes a manual invoice. Automation-created invoices (external_ref) cannot
 * be deleted from the UI: an n8n replay would recreate them and confuse the
 * partner — regla de producto de PR-4b §4.
 */
export async function deleteInvoice(
  partnerId: string,
  invoiceId: string,
): Promise<void> {
  const [row] = await db
    .select({ externalRef: invoices.externalRef })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.partnerId, partnerId)));
  if (!row) throw new FinanceError("Factura no encontrada.");
  if (row.externalRef !== null) {
    throw new FinanceError("Las facturas automáticas no se pueden eliminar.");
  }
  await db
    .delete(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.partnerId, partnerId)));
}

export async function markInvoicePaid(
  partnerId: string,
  invoiceId: string,
  paidAt: Date = new Date(),
): Promise<void> {
  const result = await db
    .update(invoices)
    .set({ status: "pagado", paidAt, updatedAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.partnerId, partnerId)))
    .returning({ id: invoices.id });
  if (result.length === 0) throw new FinanceError("Factura no encontrada.");
}

// --- Expenses CRUD -----------------------------------------------------------

export interface ExpenseInput {
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
  currency: Currency;
  incurredAt: string; // YYYY-MM-DD
}

export async function listExpenses(
  partnerId: string,
  filter?: { currency?: Currency; month?: string },
): Promise<ExpenseView[]> {
  const conditions = [eq(expenses.partnerId, partnerId)];
  if (filter?.currency) conditions.push(eq(expenses.currency, filter.currency));
  if (filter?.month) {
    conditions.push(gte(expenses.incurredAt, monthStartIso(filter.month)));
    conditions.push(lte(expenses.incurredAt, monthEndIso(filter.month)));
  }
  const rows = await db
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(desc(expenses.incurredAt), desc(expenses.createdAt));
  return rows.map((r) => ({
    id: r.id,
    category: r.category as ExpenseCategory,
    description: r.description,
    amount: toNumber(r.amount),
    currency: isCurrency(r.currency) ? r.currency : "USD",
    incurredAt: r.incurredAt,
  }));
}

export async function createExpense(
  partnerId: string,
  input: ExpenseInput,
): Promise<string> {
  const [row] = await db
    .insert(expenses)
    .values({
      partnerId,
      category: input.category,
      description: input.description ?? null,
      amount: String(input.amount),
      currency: input.currency,
      incurredAt: input.incurredAt,
    })
    .returning({ id: expenses.id });
  return row.id;
}

export async function updateExpense(
  partnerId: string,
  expenseId: string,
  patch: Partial<ExpenseInput>,
): Promise<void> {
  const result = await db
    .update(expenses)
    .set({
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description ?? null }
        : {}),
      ...(patch.amount !== undefined ? { amount: String(patch.amount) } : {}),
      ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
      ...(patch.incurredAt !== undefined ? { incurredAt: patch.incurredAt } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.id, expenseId), eq(expenses.partnerId, partnerId)))
    .returning({ id: expenses.id });
  if (result.length === 0) throw new FinanceError("Gasto no encontrado.");
}

export async function deleteExpense(
  partnerId: string,
  expenseId: string,
): Promise<void> {
  const result = await db
    .delete(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.partnerId, partnerId)))
    .returning({ id: expenses.id });
  if (result.length === 0) throw new FinanceError("Gasto no encontrado.");
}

// --- Budget -------------------------------------------------------------------

export async function getBudget(
  partnerId: string,
  month: string, // YYYY-MM
): Promise<BudgetView | null> {
  const [row] = await db
    .select()
    .from(budgetProjections)
    .where(
      and(
        eq(budgetProjections.partnerId, partnerId),
        eq(budgetProjections.month, monthStartIso(month)),
      ),
    );
  if (!row) return null;
  return {
    month: row.month,
    projectedRevenue: toNumber(row.projectedRevenue),
    budgetExpenses: toNumber(row.budgetExpenses),
    targetProfit: toNumber(row.targetProfit),
    currency: isCurrency(row.currency) ? row.currency : "USD",
  };
}

export async function upsertBudget(
  partnerId: string,
  input: {
    month: string; // YYYY-MM
    projectedRevenue: number;
    budgetExpenses: number;
    targetProfit: number;
    currency: Currency;
  },
): Promise<void> {
  await db
    .insert(budgetProjections)
    .values({
      partnerId,
      month: monthStartIso(input.month),
      projectedRevenue: String(input.projectedRevenue),
      budgetExpenses: String(input.budgetExpenses),
      targetProfit: String(input.targetProfit),
      currency: input.currency,
    })
    .onConflictDoUpdate({
      target: [budgetProjections.partnerId, budgetProjections.month],
      set: {
        projectedRevenue: String(input.projectedRevenue),
        budgetExpenses: String(input.budgetExpenses),
        targetProfit: String(input.targetProfit),
        currency: input.currency,
        updatedAt: new Date(),
      },
    });
}

// --- Calendario de cobros ------------------------------------------------------

/** Facturas con due_date dentro del mes (YYYY-MM), cualquier status. */
export async function getCollectionsCalendar(
  partnerId: string,
  month: string,
  now: Date = new Date(),
): Promise<CalendarInvoice[]> {
  const rows = await db
    .select({
      id: invoices.id,
      clientName: invoices.clientName,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      dueDate: invoices.dueDate,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.partnerId, partnerId),
        isNotNull(invoices.dueDate),
        gte(invoices.dueDate, monthStartIso(month)),
        lte(invoices.dueDate, monthEndIso(month)),
      ),
    )
    .orderBy(asc(invoices.dueDate));
  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    amount: toNumber(r.amount),
    currency: (isCurrency(r.currency) ? r.currency : "USD") as Currency,
    dueDate: r.dueDate!,
    effectiveStatus: effectiveStatus(r.status as InvoiceStatus, r.dueDate, now),
  }));
}

// --- Regla 70/30 ----------------------------------------------------------------

const SEVENTY_THIRTY_WINDOW_DAYS = 90;
export const SEVENTY_THIRTY_MAX_RECURRING = 0.3;

/**
 * Ventana móvil de 90 días sobre facturas PAGADAS de la moneda dada: qué
 * fracción del cobro es asesoría recurrente. breached cuando supera el 30%
 * (la regla 70/30 de ARQUITECTURA §4.5).
 */
export async function getSeventyThirty(
  partnerId: string,
  currency: Currency,
  now: Date = new Date(),
): Promise<SeventyThirty> {
  const windowStart = new Date(
    now.getTime() - SEVENTY_THIRTY_WINDOW_DAYS * 86_400_000,
  );
  const rows = await db
    .select({
      kind: invoices.kind,
      total: sql<string>`COALESCE(SUM(${invoices.amount}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.partnerId, partnerId),
        eq(invoices.currency, currency),
        eq(invoices.status, "pagado"),
        isNotNull(invoices.paidAt),
        gte(invoices.paidAt, windowStart),
      ),
    )
    .groupBy(invoices.kind);

  let totalPaid = 0;
  let recurringPaid = 0;
  for (const r of rows) {
    const amount = toNumber(r.total);
    totalPaid += amount;
    if (r.kind === "asesoria_mensual") recurringPaid += amount;
  }
  const recurringPct = totalPaid > 0 ? recurringPaid / totalPaid : 0;
  return {
    recurringPct,
    totalPaid,
    recurringPaid,
    currency,
    breached: recurringPct > SEVENTY_THIRTY_MAX_RECURRING,
  };
}

// --- Meta mensual (PR-4b §8) -----------------------------------------------------

/**
 * Convierte el presupuesto del mes en una meta con % de avance real. null si no
 * hay presupuesto para ese mes o su moneda no es la seleccionada (la UI muestra
 * el CTA "Define tu meta"). El % usa SOLO la moneda dada — nunca se mezclan.
 */
export async function getMonthlyGoalProgress(
  partnerId: string,
  currency: Currency,
  month: string, // YYYY-MM
): Promise<MonthlyGoalProgress | null> {
  const budget = await getBudget(partnerId, month);
  if (!budget || budget.currency !== currency) return null;

  const monthKey = monthStartIso(month);
  const [revenueRows, profitRows] = await Promise.all([
    getMonthlyRevenue(partnerId, currency),
    getMonthlyProfit(partnerId, currency),
  ]);
  const revenueActual =
    revenueRows.find((r) => r.month === monthKey)?.revenue ?? 0;
  const profitActual = profitRows.find((r) => r.month === monthKey)?.profit ?? 0;

  const profitGoal = budget.targetProfit > 0 ? budget.targetProfit : null;
  return {
    month: monthKey,
    currency,
    revenueGoal: budget.projectedRevenue,
    revenueActual,
    revenuePct: goalPct(revenueActual, budget.projectedRevenue),
    profitGoal,
    profitActual,
    profitPct: profitGoal === null ? null : goalPct(profitActual, profitGoal),
  };
}

// --- Ingresos semanales del mes (dashboard) ------------------------------------

export interface WeeklyRevenue {
  week: string; // etiqueta "1-7 jul"
  amount: number;
}

/**
 * Ingresos cobrados (facturas pagadas, por paid_at) del mes de `now`,
 * agrupados en los buckets semanales de buildWeekBuckets, en la moneda dada.
 * Misma shape que consumía el WeeklyIncomeChart demo.
 */
export async function getWeeklyRevenue(
  partnerId: string,
  currency: Currency,
  now: Date = new Date(),
): Promise<WeeklyRevenue[]> {
  const buckets = buildWeekBuckets(now);
  const monthStart = new Date(`${buckets[0].start}T00:00:00.000Z`);
  const monthEnd = new Date(`${buckets.at(-1)!.end}T23:59:59.999Z`);

  const rows = await db
    .select({ amount: invoices.amount, paidAt: invoices.paidAt })
    .from(invoices)
    .where(
      and(
        eq(invoices.partnerId, partnerId),
        eq(invoices.currency, currency),
        eq(invoices.status, "pagado"),
        isNotNull(invoices.paidAt),
        gte(invoices.paidAt, monthStart),
        lte(invoices.paidAt, monthEnd),
      ),
    );

  const totals = buckets.map(() => 0);
  for (const row of rows) {
    const day = toIsoOrNull(row.paidAt)?.slice(0, 10);
    if (!day) continue;
    const idx = buckets.findIndex((b) => day >= b.start && day <= b.end);
    if (idx >= 0) totals[idx] += toNumber(row.amount);
  }
  return buckets.map((b, i) => ({ week: b.label, amount: totals[i] }));
}

// --- Webhook: idempotent invoice upsert -------------------------------------

/**
 * Creates or updates an invoice from the external automation (n8n), keyed by
 * (partnerId, externalRef) so replays never duplicate. When the incoming status
 * is 'pagado' without an explicit paidAt, the payment time defaults to now.
 * Returns whether a row was created and the resulting invoice id.
 */
export async function upsertInvoiceFromWebhook(
  partnerId: string,
  input: InvoiceWebhookInput,
  defaultCurrency: Currency = "USD",
): Promise<{ id: string; created: boolean }> {
  const currency = input.currency ?? defaultCurrency;
  const status: InvoiceStatus = input.status ?? "pendiente";
  const paidAt =
    input.paidAt != null
      ? new Date(input.paidAt)
      : status === "pagado"
        ? new Date()
        : null;

  const values = {
    partnerId,
    externalRef: input.externalRef,
    clientName: input.clientName,
    description: input.description ?? null,
    amount: String(input.amount),
    currency,
    status,
    dueDate: input.dueDate ?? null,
    paidAt,
    workspaceId: input.workspaceId ?? null,
    ...(input.issuedAt ? { issuedAt: input.issuedAt } : {}),
  };

  const [row] = await db
    .insert(invoices)
    .values(values)
    .onConflictDoUpdate({
      target: [invoices.partnerId, invoices.externalRef],
      set: {
        clientName: values.clientName,
        description: values.description,
        amount: values.amount,
        currency: values.currency,
        status: values.status,
        dueDate: values.dueDate,
        paidAt: values.paidAt,
        workspaceId: values.workspaceId,
        updatedAt: new Date(),
      },
    })
    // xmax = 0 for freshly inserted rows; non-zero when the ON CONFLICT path
    // updated an existing row — the canonical "was it created?" signal.
    .returning({ id: invoices.id, created: sql<boolean>`(xmax = 0)` });

  return { id: row.id, created: Boolean(row.created) };
}
