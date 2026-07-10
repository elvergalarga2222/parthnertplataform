"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LayoutDashboard, Plus, Receipt, Wallet } from "lucide-react";
import type { PartnerBusinessSnapshot } from "@/modules/finance/snapshot";
import type { ActionResult } from "@/modules/finance/actions";
import type { Currency, ExpenseView, InvoiceView } from "@/modules/finance/types";
import { CURRENCIES } from "@/modules/finance/types";
import SummarySection from "./SummarySection";
import CollectionsCalendar from "./CollectionsCalendar";
import InvoicesTable from "./InvoicesTable";
import InvoiceFormModal from "./InvoiceFormModal";
import ExpensesTable from "./ExpensesTable";
import ExpenseFormModal from "./ExpenseFormModal";

type Tab = "resumen" | "calendario" | "facturas" | "gastos";

const TABS: { id: Tab; label: string; icon: typeof Receipt }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
  { id: "facturas", label: "Facturas", icon: Receipt },
  { id: "gastos", label: "Gastos", icon: Wallet },
];

export type RunFinanceAction = (action: () => Promise<ActionResult>) => Promise<boolean>;

export default function PartnerBusinessView({
  snapshot,
}: {
  snapshot: PartnerBusinessSnapshot;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("resumen");
  const [error, setError] = useState<string | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<
    { mode: "create" } | { mode: "edit"; invoice: InvoiceView } | null
  >(null);
  const [expenseModal, setExpenseModal] = useState<
    { mode: "create" } | { mode: "edit"; expense: ExpenseView } | null
  >(null);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  // Ejecuta la action y re-sincroniza desde el servidor; devuelve si funcionó
  // para que los modales decidan si cerrarse o mostrar el error inline.
  const runAction: RunFinanceAction = async (action) => {
    const result = await action();
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const navigate = (currency: Currency, month: string) => {
    router.replace(`/partner-business?currency=${currency}&month=${month}`);
  };

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
      active
        ? "bg-primary-faint text-primary-soft"
        : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 pt-4">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">Partner Business</h1>
        <div className="flex items-center gap-1 rounded-xl border border-edge bg-surface p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={tabClass(tab === id)}
              onClick={() => setTab(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Moneda activa"
            value={snapshot.currency}
            onChange={(e) => navigate(e.target.value as Currency, snapshot.month)}
            className="rounded-xl border border-edge bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink-secondary outline-none transition-colors hover:border-primary/50"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {tab === "gastos" ? (
            <button
              type="button"
              onClick={() => setExpenseModal({ mode: "create" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
            >
              <Plus size={14} /> Nuevo gasto
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setInvoiceModal({ mode: "create" })}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
            >
              <Plus size={14} /> Nueva factura
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {tab === "resumen" && (
          <SummarySection snapshot={snapshot} runAction={runAction} />
        )}
        {tab === "calendario" && (
          <CollectionsCalendar
            snapshot={snapshot}
            onNavigateMonth={(month) => navigate(snapshot.currency, month)}
            onOpenInvoice={(invoice) => setInvoiceModal({ mode: "edit", invoice })}
          />
        )}
        {tab === "facturas" && (
          <InvoicesTable
            snapshot={snapshot}
            runAction={runAction}
            onOpenInvoice={(invoice) => setInvoiceModal({ mode: "edit", invoice })}
          />
        )}
        {tab === "gastos" && (
          <ExpensesTable
            expenses={snapshot.expenses}
            runAction={runAction}
            onOpenExpense={(expense) => setExpenseModal({ mode: "edit", expense })}
          />
        )}
      </div>

      {invoiceModal && (
        <InvoiceFormModal
          mode={invoiceModal.mode}
          invoice={invoiceModal.mode === "edit" ? invoiceModal.invoice : null}
          defaultCurrency={snapshot.currency}
          workspaceOptions={snapshot.workspaceOptions}
          runAction={runAction}
          onClose={() => setInvoiceModal(null)}
        />
      )}
      {expenseModal && (
        <ExpenseFormModal
          mode={expenseModal.mode}
          expense={expenseModal.mode === "edit" ? expenseModal.expense : null}
          defaultCurrency={snapshot.currency}
          runAction={runAction}
          onClose={() => setExpenseModal(null)}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-negative/40 bg-surface-3 px-4 py-2.5 text-[13px] font-medium text-negative shadow-card-hover"
        >
          {error}
        </div>
      )}
    </div>
  );
}
