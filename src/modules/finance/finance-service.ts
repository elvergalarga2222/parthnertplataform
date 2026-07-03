import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { expenses, receivables, revenueEntries } from "@/db/schema";
import {
  cashflowSummary,
  marginAlert,
  seventyThirty,
  type CashflowSummary,
  type MarginResult,
  type SeventyThirtyResult,
} from "./metrics";

export interface FinanceDashboard {
  seventyThirty: SeventyThirtyResult;
  margin: MarginResult;
  cashflow: CashflowSummary;
}

export class FinanceService {
  constructor(private db: Db) {}

  async addRevenue(
    partnerId: string,
    input: {
      kind: "consultoria" | "asesoria_mensual";
      concept: string;
      amount: string;
      entryDate: string;
      clientId?: string | null;
    },
  ) {
    const [row] = await this.db
      .insert(revenueEntries)
      .values({ partnerId, ...input })
      .returning();
    return row;
  }

  async addExpense(
    partnerId: string,
    input: {
      category: string;
      concept: string;
      amount: string;
      entryDate: string;
      isRecurring: boolean;
    },
  ) {
    const [row] = await this.db
      .insert(expenses)
      .values({ partnerId, ...input })
      .returning();
    return row;
  }

  async addReceivable(
    partnerId: string,
    input: {
      concept: string;
      amount: string;
      dueDate: string;
      recurrence?: string | null;
      clientId?: string | null;
    },
  ) {
    const [row] = await this.db
      .insert(receivables)
      .values({ partnerId, ...input })
      .returning();
    return row;
  }

  async markReceivablePaid(partnerId: string, receivableId: string) {
    const [row] = await this.db
      .update(receivables)
      .set({ status: "pagado", paidAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(receivables.id, receivableId),
          eq(receivables.partnerId, partnerId),
        ),
      )
      .returning();
    return row ?? null;
  }

  /** Job diario: marca como vencidas las pendientes con fecha pasada. */
  async markOverdue(today: string) {
    return this.db
      .update(receivables)
      .set({ status: "vencido", updatedAt: new Date() })
      .where(
        and(eq(receivables.status, "pendiente"), lt(receivables.dueDate, today)),
      )
      .returning({ id: receivables.id });
  }

  async listRevenue(partnerId: string, limit = 50) {
    return this.db
      .select()
      .from(revenueEntries)
      .where(eq(revenueEntries.partnerId, partnerId))
      .orderBy(desc(revenueEntries.entryDate))
      .limit(limit);
  }

  async listExpenses(partnerId: string, limit = 50) {
    return this.db
      .select()
      .from(expenses)
      .where(eq(expenses.partnerId, partnerId))
      .orderBy(desc(expenses.entryDate))
      .limit(limit);
  }

  async listReceivables(partnerId: string) {
    return this.db
      .select()
      .from(receivables)
      .where(eq(receivables.partnerId, partnerId))
      .orderBy(desc(receivables.dueDate));
  }

  /** Métricas de los últimos 90 días (ventana móvil de la regla 70/30). */
  async dashboard(partnerId: string, today: Date): Promise<FinanceDashboard> {
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() - 90);
    const startStr = windowStart.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const [revenue, expenseRows, receivableRows] = await Promise.all([
      this.db
        .select()
        .from(revenueEntries)
        .where(
          and(
            eq(revenueEntries.partnerId, partnerId),
            gte(revenueEntries.entryDate, startStr),
          ),
        ),
      this.db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.partnerId, partnerId),
            gte(expenses.entryDate, startStr),
          ),
        ),
      this.db
        .select()
        .from(receivables)
        .where(eq(receivables.partnerId, partnerId)),
    ]);

    const revenueLike = revenue.map((r) => ({
      kind: r.kind,
      amount: Number(r.amount),
    }));
    const income = revenueLike.reduce((acc, r) => acc + r.amount, 0);
    const costs = expenseRows.reduce((acc, e) => acc + Number(e.amount), 0);

    return {
      seventyThirty: seventyThirty(revenueLike),
      margin: marginAlert(income, costs),
      cashflow: cashflowSummary(
        receivableRows.map((r) => ({
          amount: Number(r.amount),
          status: r.status,
          dueDate: r.dueDate,
        })),
        todayStr,
      ),
    };
  }
}
