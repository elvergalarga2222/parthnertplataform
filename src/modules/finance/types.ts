// Partner Business (Fase 4) — domain types. Amounts are always paired with a
// currency; there is no cross-currency conversion (regla del módulo).

export type Currency = "COP" | "USD" | "EUR";
export const CURRENCIES: Currency[] = ["COP", "USD", "EUR"];

export type ExpenseCategory =
  | "ia"
  | "produccion_video"
  | "hosting_vps"
  | "freelancer"
  | "herramientas_saas"
  | "otro";
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "ia",
  "produccion_video",
  "hosting_vps",
  "freelancer",
  "herramientas_saas",
  "otro",
];

export type InvoiceStatus = "pendiente" | "pagado" | "vencido";
export const INVOICE_STATUSES: InvoiceStatus[] = [
  "pendiente",
  "pagado",
  "vencido",
];

// Tipo de ingreso — base de la regla 70/30 (ARQUITECTURA §4.5).
export type InvoiceKind = "proyecto" | "asesoria_mensual" | "otro";
export const INVOICE_KINDS: InvoiceKind[] = [
  "proyecto",
  "asesoria_mensual",
  "otro",
];

// One (partner, month, currency) row of the aggregation views.
export interface MonthlyRevenueRow {
  month: string; // YYYY-MM-DD (first of month)
  currency: Currency;
  revenue: number;
}
export interface MonthlyProfitRow {
  month: string;
  currency: Currency;
  revenue: number;
  expenses: number;
  iaCost: number;
  profit: number;
}

// A near-due or overdue invoice surfaced as an in-app alert.
export type InvoiceAlertKind = "vencido" | "por_vencer";
export interface InvoiceAlert {
  id: string;
  clientName: string;
  amount: number;
  currency: Currency;
  dueDate: string | null; // YYYY-MM-DD
  status: InvoiceStatus;
  kind: InvoiceAlertKind;
  // Days until due date; negative when already overdue.
  daysUntilDue: number;
}
export interface InvoiceAlerts {
  overdue: InvoiceAlert[];
  upcoming: InvoiceAlert[];
  total: number;
}

// --- Partner Business UI views (PR-4b) ---------------------------------------

export interface InvoiceView {
  id: string;
  clientName: string;
  description: string | null;
  amount: number;
  currency: Currency;
  /** Status EFECTIVO: 'pendiente' con due_date pasado se reporta 'vencido'. */
  status: InvoiceStatus;
  kind: InvoiceKind;
  issuedAt: string; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  paidAt: string | null; // ISO
  workspaceId: string | null;
  workspaceName: string | null;
  /** Idempotency ref de n8n; no editable y bloquea el borrado desde la UI. */
  externalRef: string | null;
}

export interface ExpenseView {
  id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  currency: Currency;
  incurredAt: string; // YYYY-MM-DD
}

export interface BudgetView {
  month: string; // YYYY-MM-01
  projectedRevenue: number;
  budgetExpenses: number;
  targetProfit: number;
  currency: Currency;
}

export interface CalendarInvoice {
  id: string;
  clientName: string;
  amount: number;
  currency: Currency;
  dueDate: string; // YYYY-MM-DD
  effectiveStatus: InvoiceStatus;
}

// Regla 70/30: ventana móvil de 90 días sobre facturas pagadas de una moneda.
export interface SeventyThirty {
  recurringPct: number; // fracción 0..1 de asesoría recurrente sobre lo cobrado
  totalPaid: number;
  recurringPaid: number;
  currency: Currency;
  breached: boolean; // recurringPct > 0.30
}

// Meta mensual (PR-4b §8): budget_projections como meta con % de avance.
export interface MonthlyGoalProgress {
  month: string; // YYYY-MM-01
  currency: Currency;
  revenueGoal: number;
  revenueActual: number;
  revenuePct: number; // 0 si goal = 0
  profitGoal: number | null; // null si target_profit = 0 (sin meta)
  profitActual: number;
  profitPct: number | null;
}

// Payload accepted by the protected n8n webhook to create/update an invoice.
export interface InvoiceWebhookInput {
  externalRef: string;
  clientName: string;
  amount: number;
  currency?: Currency;
  status?: InvoiceStatus;
  issuedAt?: string;
  dueDate?: string | null;
  paidAt?: string | null;
  description?: string | null;
  workspaceId?: string | null;
}
