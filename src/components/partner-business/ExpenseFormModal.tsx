"use client";

import { useState } from "react";
import Modal from "@/components/system/Modal";
import {
  createExpenseAction,
  updateExpenseAction,
} from "@/modules/finance/actions";
import type {
  Currency,
  ExpenseCategory,
  ExpenseView,
} from "@/modules/finance/types";
import { CURRENCIES, EXPENSE_CATEGORIES } from "@/modules/finance/types";
import { CATEGORY_LABELS, inputClass, labelClass } from "./labels";
import type { RunFinanceAction } from "./PartnerBusinessView";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function ExpenseFormModal({
  mode,
  expense,
  defaultCurrency,
  runAction,
  onClose,
}: {
  mode: "create" | "edit";
  expense: ExpenseView | null;
  defaultCurrency: Currency;
  runAction: RunFinanceAction;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "otro",
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(
    expense?.currency ?? defaultCurrency,
  );
  const [incurredAt, setIncurredAt] = useState(expense?.incurredAt ?? todayIso());
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      category,
      description: description || null,
      amount: Number(amount || "0"),
      currency,
      incurredAt,
    };
    const ok = await runAction(() =>
      mode === "create"
        ? createExpenseAction(payload)
        : updateExpenseAction({ expenseId: expense!.id, ...payload }),
    );
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={mode === "create" ? "Nuevo gasto" : "Editar gasto"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Categoría
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className={inputClass}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Descripción
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Suscripción mensual"
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Monto
            <input
              type="number"
              required
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
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
        </div>
        <label className={labelClass}>
          Fecha
          <input
            type="date"
            required
            min="1970-01-01"
            max="2100-12-31"
            value={incurredAt}
            onChange={(e) => setIncurredAt(e.target.value)}
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={saving}
          className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft disabled:opacity-60"
        >
          {saving ? "Guardando…" : mode === "create" ? "Crear gasto" : "Guardar cambios"}
        </button>
      </form>
    </Modal>
  );
}
