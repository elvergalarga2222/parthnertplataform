"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, Trash2, Zap } from "lucide-react";
import { formatMoney } from "@/lib/format";
import {
  deleteInvoiceAction,
  markInvoicePaidAction,
} from "@/modules/finance/actions";
import type { PartnerBusinessSnapshot } from "@/modules/finance/snapshot";
import type { InvoiceStatus, InvoiceView } from "@/modules/finance/types";
import {
  KIND_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
  formatDay,
} from "./labels";
import type { RunFinanceAction } from "./PartnerBusinessView";

const STATUS_FILTERS: (InvoiceStatus | "todas")[] = [
  "todas",
  "pendiente",
  "pagado",
  "vencido",
];

export default function InvoicesTable({
  snapshot,
  runAction,
  onOpenInvoice,
}: {
  snapshot: PartnerBusinessSnapshot;
  runAction: RunFinanceAction;
  onOpenInvoice: (invoice: InvoiceView) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "todas">("todas");

  // El snapshot ya viene filtrado por la moneda activa; aquí solo status.
  const rows = snapshot.invoices.filter(
    (i) => statusFilter === "todas" || i.status === statusFilter,
  );

  const markPaid = (invoice: InvoiceView) =>
    runAction(() => markInvoicePaidAction(invoice.id));

  const remove = async (invoice: InvoiceView) => {
    if (!window.confirm(`¿Eliminar la factura de «${invoice.clientName}»?`)) return;
    await runAction(() => deleteInvoiceAction(invoice.id));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 self-start rounded-xl border border-edge bg-surface p-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors ${
              statusFilter === s
                ? "bg-primary-faint text-primary-soft"
                : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {s === "todas" ? "Todas" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-edge bg-surface shadow-card">
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-edge text-[11px] uppercase tracking-widest text-ink-muted">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Monto</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Emitida</th>
              <th className="px-4 py-3 font-semibold">Vence</th>
              <th className="px-4 py-3 font-semibold">Pagada</th>
              <th className="px-4 py-3 font-semibold">Espacio</th>
              <th className="px-4 py-3 font-semibold">Origen</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-ink-muted">
                  Sin facturas {statusFilter !== "todas" ? "con ese estado " : ""}en{" "}
                  {snapshot.currency}.
                </td>
              </tr>
            )}
            {rows.map((invoice) => (
              <tr
                key={invoice.id}
                className="border-b border-edge/60 transition-colors last:border-0 hover:bg-surface-2/50"
              >
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink">{invoice.clientName}</span>
                  {invoice.description && (
                    <span className="mt-0.5 block max-w-56 truncate text-[11.5px] text-ink-muted">
                      {invoice.description}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-secondary">
                  {KIND_LABELS[invoice.kind]}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {formatMoney(invoice.amount, invoice.currency)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_BADGE[invoice.status]}`}
                  >
                    {STATUS_LABELS[invoice.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-secondary">{formatDay(invoice.issuedAt)}</td>
                <td className="px-4 py-3 text-ink-secondary">{formatDay(invoice.dueDate)}</td>
                <td className="px-4 py-3 text-ink-secondary">
                  {invoice.paidAt ? formatDay(invoice.paidAt.slice(0, 10)) : "—"}
                </td>
                <td className="px-4 py-3 text-ink-secondary">
                  {invoice.workspaceName ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {invoice.externalRef ? (
                    <span className="flex w-fit items-center gap-1 rounded-full bg-primary-faint px-2 py-0.5 text-[10.5px] font-semibold text-primary-soft">
                      <Zap size={10} /> n8n
                    </span>
                  ) : (
                    <span className="text-ink-muted">manual</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {invoice.status !== "pagado" && (
                      <button
                        type="button"
                        title="Marcar pagada"
                        onClick={() => markPaid(invoice)}
                        className="rounded-lg p-1.5 text-positive transition-colors hover:bg-positive/10"
                      >
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => onOpenInvoice(invoice)}
                      className="rounded-lg p-1.5 text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <Pencil size={14} />
                    </button>
                    {!invoice.externalRef && (
                      <button
                        type="button"
                        title="Eliminar"
                        onClick={() => remove(invoice)}
                        className="rounded-lg p-1.5 text-negative transition-colors hover:bg-negative/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
