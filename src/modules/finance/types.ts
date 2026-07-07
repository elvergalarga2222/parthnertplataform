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
