import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { deals, invoices, pipelineStages } from "@/db/schema";
import type {
  Currency,
  InvoiceAlert,
  InvoiceAlerts,
  InvoiceStatus,
  InvoiceWebhookInput,
  MonthlyProfitRow,
  MonthlyRevenueRow,
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

/** Whole days from `today` to `dueDate` (negative when overdue). */
function daysBetween(today: Date, dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

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
