"use client";

import { AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { PartnerBusinessSnapshot } from "@/modules/finance/snapshot";
import { formatMonthLabel } from "./labels";
import BudgetForm from "./BudgetForm";
import type { RunFinanceAction } from "./PartnerBusinessView";

function StatCard({ title, value, tone }: { title: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <article className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <h3 className="text-[12.5px] font-medium text-ink-secondary">{title}</h3>
      <p
        className={`mt-2 text-[24px] font-bold leading-none tracking-tight ${
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : ""
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function ProgressBar({
  label,
  actual,
  goal,
  currency,
}: {
  label: string;
  actual: number;
  goal: number;
  currency: string;
}) {
  const pct = goal > 0 ? Math.round((actual / goal) * 100) : 0;
  const clamped = Math.min(pct, 100);
  const over = pct > 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="font-medium text-ink-secondary">{label}</span>
        <span className={`font-semibold ${over ? "text-positive" : "text-ink"}`}>
          {pct}%
          <span className="ml-2 font-normal text-ink-muted">
            {formatMoney(actual, currency)} de {formatMoney(goal, currency)}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full ${over ? "bg-positive" : "bg-primary"}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export default function SummarySection({
  snapshot,
  runAction,
}: {
  snapshot: PartnerBusinessSnapshot;
  runAction: RunFinanceAction;
}) {
  const { currency, month, monthlyProfit, invoices, budget, seventyThirty, goal } =
    snapshot;

  const monthKey = `${month}-01`;
  const row = monthlyProfit.find((r) => r.month === monthKey);
  const billed = row?.revenue ?? 0;
  const spent = row?.expenses ?? 0;
  const profit = row?.profit ?? 0;
  const pendingTotal = invoices
    .filter((i) => i.status !== "pagado")
    .reduce((sum, i) => sum + i.amount, 0);

  const recurringPctDisplay = Math.round(seventyThirty.recurringPct * 100);

  return (
    <div className="flex flex-col gap-5">
      {seventyThirty.breached && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-negative/40 bg-negative/10 px-4 py-3 text-[13px] font-medium text-negative"
        >
          <AlertTriangle size={16} className="shrink-0" />
          Regla 70/30 en riesgo: la asesoría recurrente es el {recurringPctDisplay}% de
          lo cobrado en los últimos 90 días ({formatMoney(seventyThirty.recurringPaid, currency)}{" "}
          de {formatMoney(seventyThirty.totalPaid, currency)}). El máximo recomendado es 30%.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title={`Facturado (${formatMonthLabel(month)})`} value={formatMoney(billed, currency)} />
        <StatCard title="Pendiente de cobro" value={formatMoney(pendingTotal, currency)} tone={pendingTotal > 0 ? "negative" : undefined} />
        <StatCard title="Gastos del mes" value={formatMoney(spent, currency)} />
        <StatCard title="Profit del mes" value={formatMoney(profit, currency)} tone={profit >= 0 ? "positive" : "negative"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article className="flex flex-col gap-4 rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <h3 className="text-[13px] font-bold tracking-tight">
            Presupuesto vs. real — {formatMonthLabel(month)}
          </h3>
          {goal ? (
            <>
              <ProgressBar
                label="Facturado vs. meta"
                actual={goal.revenueActual}
                goal={goal.revenueGoal}
                currency={currency}
              />
              {goal.profitGoal !== null && (
                <ProgressBar
                  label="Profit vs. meta (sueldo objetivo)"
                  actual={goal.profitActual}
                  goal={goal.profitGoal}
                  currency={currency}
                />
              )}
              {budget && (
                <ProgressBar
                  label="Gasto real vs. presupuesto"
                  actual={spent}
                  goal={budget.budgetExpenses}
                  currency={currency}
                />
              )}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-edge-strong px-4 py-6 text-center text-[12.5px] text-ink-muted">
              Sin meta para este mes en {currency}. Define tu meta de facturación y tu
              sueldo objetivo en el formulario de al lado.
            </p>
          )}
          {!seventyThirty.breached && seventyThirty.totalPaid > 0 && (
            <p className="border-t border-edge pt-3 text-[11.5px] text-ink-muted">
              Regla 70/30 ✓ — asesoría recurrente: {recurringPctDisplay}% de lo cobrado
              (90 días).
            </p>
          )}
        </article>

        <BudgetForm
          month={month}
          budget={budget}
          defaultCurrency={currency}
          runAction={runAction}
        />
      </div>
    </div>
  );
}
