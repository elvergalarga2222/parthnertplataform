"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { deleteExpenseAction } from "@/modules/finance/actions";
import type { ExpenseView } from "@/modules/finance/types";
import { CATEGORY_LABELS, formatDay } from "./labels";
import type { RunFinanceAction } from "./PartnerBusinessView";

export default function ExpensesTable({
  expenses,
  runAction,
  onOpenExpense,
}: {
  expenses: ExpenseView[];
  runAction: RunFinanceAction;
  onOpenExpense: (expense: ExpenseView) => void;
}) {
  const remove = async (expense: ExpenseView) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    await runAction(() => deleteExpenseAction(expense.id));
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-edge bg-surface shadow-card">
      <table className="w-full min-w-[640px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-edge text-[11px] uppercase tracking-widest text-ink-muted">
            <th className="px-4 py-3 font-semibold">Categoría</th>
            <th className="px-4 py-3 font-semibold">Descripción</th>
            <th className="px-4 py-3 font-semibold">Monto</th>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                Sin gastos registrados en esta moneda.
              </td>
            </tr>
          )}
          {expenses.map((expense) => (
            <tr
              key={expense.id}
              className="border-b border-edge/60 transition-colors last:border-0 hover:bg-surface-2/50"
            >
              <td className="px-4 py-3">
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10.5px] font-semibold text-ink-secondary">
                  {CATEGORY_LABELS[expense.category]}
                </span>
              </td>
              <td className="max-w-72 truncate px-4 py-3 text-ink-secondary">
                {expense.description ?? "—"}
              </td>
              <td className="px-4 py-3 font-semibold">
                {formatMoney(expense.amount, expense.currency)}
              </td>
              <td className="px-4 py-3 text-ink-secondary">
                {formatDay(expense.incurredAt)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    title="Editar"
                    onClick={() => onOpenExpense(expense)}
                    className="rounded-lg p-1.5 text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    title="Eliminar"
                    onClick={() => remove(expense)}
                    className="rounded-lg p-1.5 text-negative transition-colors hover:bg-negative/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
