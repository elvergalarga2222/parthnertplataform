import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import {
  getBudget,
  getCollectionsCalendar,
  getInvoiceAlerts,
  getMonthlyGoalProgress,
  getMonthlyProfit,
  getSeventyThirty,
  isCurrency,
  listExpenses,
  listInvoices,
} from "./service";
import type {
  BudgetView,
  CalendarInvoice,
  Currency,
  ExpenseView,
  InvoiceAlerts,
  InvoiceView,
  MonthlyGoalProgress,
  MonthlyProfitRow,
  SeventyThirty,
} from "./types";

// Capa de composición de /partner-business (precedente: dashboard/kpis.ts).
// Reúne en paralelo todo lo que la vista necesita para el mes/moneda activos.

export interface WorkspaceOption {
  id: string;
  clientName: string;
}

export interface PartnerBusinessSnapshot {
  currency: Currency; // moneda activa (default del partner o ?currency=)
  month: string; // YYYY-MM activo (hoy o ?month=)
  invoices: InvoiceView[];
  expenses: ExpenseView[];
  budget: BudgetView | null;
  calendar: CalendarInvoice[];
  monthlyProfit: MonthlyProfitRow[]; // últimos meses, para el resumen
  alerts: InvoiceAlerts;
  seventyThirty: SeventyThirty;
  goal: MonthlyGoalProgress | null;
  workspaceOptions: WorkspaceOption[]; // espacios activos para el form de factura
}

export function currentMonthUtc(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getPartnerBusinessSnapshot(
  partner: { id: string; defaultCurrency: string },
  options?: { currency?: string; month?: string },
): Promise<PartnerBusinessSnapshot> {
  const currency: Currency =
    options?.currency && isCurrency(options.currency)
      ? options.currency
      : isCurrency(partner.defaultCurrency)
        ? partner.defaultCurrency
        : "USD";
  const month =
    options?.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(options.month)
      ? options.month
      : currentMonthUtc();

  const [
    invoices,
    expenses,
    budget,
    calendar,
    monthlyProfit,
    alerts,
    seventyThirty,
    goal,
    workspaceRows,
  ] = await Promise.all([
    listInvoices(partner.id, { currency }),
    listExpenses(partner.id, { currency }),
    getBudget(partner.id, month),
    getCollectionsCalendar(partner.id, month),
    getMonthlyProfit(partner.id, currency),
    getInvoiceAlerts(partner.id),
    getSeventyThirty(partner.id, currency),
    getMonthlyGoalProgress(partner.id, currency, month),
    db
      .select({ id: workspaces.id, clientName: workspaces.clientName })
      .from(workspaces)
      .where(eq(workspaces.partnerId, partner.id))
      .orderBy(asc(workspaces.clientName)),
  ]);

  return {
    currency,
    month,
    invoices,
    expenses,
    budget,
    calendar,
    monthlyProfit,
    alerts,
    seventyThirty,
    goal,
    workspaceOptions: workspaceRows,
  };
}
