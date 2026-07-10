"use client";

import { useState } from "react";
import { upsertBudgetAction } from "@/modules/finance/actions";
import type { BudgetView, Currency } from "@/modules/finance/types";
import { CURRENCIES } from "@/modules/finance/types";
import { inputClass, labelClass } from "./labels";
import type { RunFinanceAction } from "./PartnerBusinessView";

export default function BudgetForm({
  month,
  budget,
  defaultCurrency,
  runAction,
}: {
  month: string; // YYYY-MM activo
  budget: BudgetView | null;
  defaultCurrency: Currency;
  runAction: RunFinanceAction;
}) {
  const [formMonth, setFormMonth] = useState(month);
  const [projectedRevenue, setProjectedRevenue] = useState(
    budget ? String(budget.projectedRevenue) : "",
  );
  const [budgetExpenses, setBudgetExpenses] = useState(
    budget ? String(budget.budgetExpenses) : "",
  );
  const [targetProfit, setTargetProfit] = useState(
    budget && budget.targetProfit > 0 ? String(budget.targetProfit) : "",
  );
  const [currency, setCurrency] = useState<Currency>(
    budget?.currency ?? defaultCurrency,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const ok = await runAction(() =>
      upsertBudgetAction({
        month: formMonth,
        projectedRevenue: Number(projectedRevenue || "0"),
        budgetExpenses: Number(budgetExpenses || "0"),
        targetProfit: Number(targetProfit || "0"),
        currency,
      }),
    );
    setSaving(false);
    if (ok) setSaved(true);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-edge bg-surface p-5 shadow-card"
    >
      <h3 className="text-[13px] font-bold tracking-tight">Meta del mes</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Mes
          <input
            type="month"
            required
            value={formMonth}
            onChange={(e) => setFormMonth(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Moneda
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
            className={inputClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Meta de facturación del mes
          <input
            type="number"
            min="0"
            step="any"
            value={projectedRevenue}
            onChange={(e) => setProjectedRevenue(e.target.value)}
            placeholder="Ej: 80000000"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Presupuesto de gastos
          <input
            type="number"
            min="0"
            step="any"
            value={budgetExpenses}
            onChange={(e) => setBudgetExpenses(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Meta de profit / sueldo objetivo
          <input
            type="number"
            min="0"
            step="any"
            value={targetProfit}
            onChange={(e) => setTargetProfit(e.target.value)}
            placeholder="Ej: 40000000"
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar meta"}
        </button>
        {saved && (
          <span className="text-[12px] font-medium text-positive">Meta guardada.</span>
        )}
      </div>
    </form>
  );
}
