"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { requirePartner } from "@/modules/auth/require-partner";
import { FinanceService } from "@/modules/finance/finance-service";

function service() {
  return new FinanceService(getDb());
}

const revenueSchema = z.object({
  kind: z.enum(["consultoria", "asesoria_mensual"]),
  concept: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Monto inválido"),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addRevenueAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = revenueSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    await service().addRevenue(partner.id, parsed.data);
  }
  revalidatePath("/finanzas");
  redirect("/finanzas");
}

const expenseSchema = z.object({
  category: z.string().min(1),
  concept: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isRecurring: z.string().optional(),
});

export async function addExpenseAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    const { isRecurring, ...rest } = parsed.data;
    await service().addExpense(partner.id, {
      ...rest,
      isRecurring: isRecurring === "on",
    });
  }
  revalidatePath("/finanzas");
  redirect("/finanzas");
}

const receivableSchema = z.object({
  concept: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recurrence: z.enum(["", "monthly"]).optional(),
});

export async function addReceivableAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = receivableSchema.safeParse(Object.fromEntries(formData));
  if (parsed.success) {
    const { recurrence, ...rest } = parsed.data;
    await service().addReceivable(partner.id, {
      ...rest,
      recurrence: recurrence || null,
    });
  }
  revalidatePath("/finanzas");
  redirect("/finanzas");
}

export async function markPaidAction(formData: FormData) {
  const partner = await requirePartner();
  const id = z.string().uuid().safeParse(formData.get("receivableId"));
  if (id.success) {
    await service().markReceivablePaid(partner.id, id.data);
  }
  revalidatePath("/finanzas");
  redirect("/finanzas");
}
