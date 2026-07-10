"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentPartner } from "@/modules/auth/service";
import {
  FinanceError,
  createExpense,
  createInvoice,
  deleteExpense,
  deleteInvoice,
  markInvoicePaid,
  updateExpense,
  updateInvoice,
  upsertBudget,
} from "./service";
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  INVOICE_KINDS,
  INVOICE_STATUSES,
} from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requirePartnerId(): Promise<string> {
  const partner = await getCurrentPartner();
  if (!partner) throw new FinanceError("Sesión no válida.");
  return partner.id;
}

async function run(fn: (partnerId: string) => Promise<void>): Promise<ActionResult> {
  try {
    const partnerId = await requirePartnerId();
    await fn(partnerId);
    revalidatePath("/partner-business");
    // Los KPIs del dashboard leen las mismas vistas de agregación.
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (err) {
    if (err instanceof FinanceError) return { ok: false, error: err.message };
    console.error("Finance action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Invoices

// Solo fechas YYYY-MM-DD de <input type="date"> — nunca datetimes libres
// (cierra la clase de bug de /clientes) — y acotadas al rango útil de negocio.
const formDate = z
  .string()
  .date()
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 1970 && year <= 2100;
  }, "La fecha no es válida.");

const invoiceSchema = z.object({
  clientName: z.string().trim().min(1, "El cliente es obligatorio.").max(200),
  description: z.string().trim().max(2000).nullish(),
  amount: z.number().nonnegative().max(1_000_000_000),
  currency: z.enum(CURRENCIES),
  status: z.enum(INVOICE_STATUSES),
  kind: z.enum(INVOICE_KINDS),
  issuedAt: formDate,
  dueDate: formDate.nullish(),
  workspaceId: z.string().uuid().nullish(),
});

export async function createInvoiceAction(
  input: z.input<typeof invoiceSchema>,
): Promise<ActionResult> {
  const parsed = invoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return run(async (partnerId) => {
    await createInvoice(partnerId, parsed.data);
  });
}

const invoicePatchSchema = invoiceSchema.partial().extend({
  invoiceId: z.string().uuid(),
});

export async function updateInvoiceAction(
  input: z.input<typeof invoicePatchSchema>,
): Promise<ActionResult> {
  const parsed = invoicePatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { invoiceId, ...patch } = parsed.data;
  return run((partnerId) => updateInvoice(partnerId, invoiceId, patch));
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(invoiceId);
  if (!parsed.success) return { ok: false, error: "Factura inválida." };
  return run((partnerId) => deleteInvoice(partnerId, parsed.data));
}

export async function markInvoicePaidAction(
  invoiceId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(invoiceId);
  if (!parsed.success) return { ok: false, error: "Factura inválida." };
  return run((partnerId) => markInvoicePaid(partnerId, parsed.data));
}

// ---------------------------------------------------------------------------
// Expenses

const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().max(2000).nullish(),
  amount: z.number().nonnegative().max(1_000_000_000),
  currency: z.enum(CURRENCIES),
  incurredAt: formDate,
});

export async function createExpenseAction(
  input: z.input<typeof expenseSchema>,
): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return run(async (partnerId) => {
    await createExpense(partnerId, parsed.data);
  });
}

const expensePatchSchema = expenseSchema.partial().extend({
  expenseId: z.string().uuid(),
});

export async function updateExpenseAction(
  input: z.input<typeof expensePatchSchema>,
): Promise<ActionResult> {
  const parsed = expensePatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { expenseId, ...patch } = parsed.data;
  return run((partnerId) => updateExpense(partnerId, expenseId, patch));
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(expenseId);
  if (!parsed.success) return { ok: false, error: "Gasto inválido." };
  return run((partnerId) => deleteExpense(partnerId, parsed.data));
}

// ---------------------------------------------------------------------------
// Budget

const budgetSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido.")
    .refine((value) => {
      const year = Number(value.slice(0, 4));
      return year >= 1970 && year <= 2100;
    }, "Mes inválido."),
  projectedRevenue: z.number().nonnegative().max(1_000_000_000_000),
  budgetExpenses: z.number().nonnegative().max(1_000_000_000_000),
  targetProfit: z.number().nonnegative().max(1_000_000_000_000),
  currency: z.enum(CURRENCIES),
});

export async function upsertBudgetAction(
  input: z.input<typeof budgetSchema>,
): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return run((partnerId) => upsertBudget(partnerId, parsed.data));
}
