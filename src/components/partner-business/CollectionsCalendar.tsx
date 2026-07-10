"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { buildMonthGrid } from "@/modules/finance/helpers";
import type { PartnerBusinessSnapshot } from "@/modules/finance/snapshot";
import type { InvoiceView } from "@/modules/finance/types";
import { STATUS_CHIP, formatMonthLabel, shiftMonth } from "./labels";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

export default function CollectionsCalendar({
  snapshot,
  onNavigateMonth,
  onOpenInvoice,
}: {
  snapshot: PartnerBusinessSnapshot;
  onNavigateMonth: (month: string) => void;
  onOpenInvoice: (invoice: InvoiceView) => void;
}) {
  const { month, currency, calendar, invoices } = snapshot;
  const grid = buildMonthGrid(month);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Solo cobros de la moneda activa (criterio 5: nunca mezclar monedas).
  const byDay = new Map<string, typeof calendar>();
  for (const item of calendar) {
    if (item.currency !== currency) continue;
    const list = byDay.get(item.dueDate) ?? [];
    list.push(item);
    byDay.set(item.dueDate, list);
  }

  const openById = (id: string) => {
    const invoice = invoices.find((i) => i.id === id);
    if (invoice) onOpenInvoice(invoice);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => onNavigateMonth(shiftMonth(month, -1))}
          className="rounded-lg border border-edge p-1.5 text-ink-secondary transition-colors hover:border-primary/50 hover:text-ink"
        >
          <ChevronLeft size={15} />
        </button>
        <h3 className="min-w-40 text-center text-[13.5px] font-bold capitalize tracking-tight">
          {formatMonthLabel(month)}
        </h3>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => onNavigateMonth(shiftMonth(month, 1))}
          className="rounded-lg border border-edge p-1.5 text-ink-secondary transition-colors hover:border-primary/50 hover:text-ink"
        >
          <ChevronRight size={15} />
        </button>
        <span className="ml-auto text-[11.5px] text-ink-muted">
          Cobros por fecha de vencimiento · {currency}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="pb-1 text-center text-[10.5px] font-semibold uppercase tracking-widest text-ink-muted"
          >
            {d}
          </div>
        ))}
        {grid.map((cell) => {
          const items = byDay.get(cell.date) ?? [];
          const isToday = cell.date === todayIso;
          return (
            <div
              key={cell.date}
              className={`min-h-24 rounded-xl border p-1.5 ${
                cell.inMonth
                  ? "border-edge bg-surface"
                  : "border-transparent bg-surface/40 opacity-50"
              } ${isToday ? "border-primary/60" : ""}`}
            >
              <span
                className={`text-[10.5px] font-semibold ${
                  isToday ? "text-primary-soft" : "text-ink-muted"
                }`}
              >
                {Number(cell.date.slice(8, 10))}
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openById(item.id)}
                    title={`${item.clientName} — ${formatMoney(item.amount, item.currency)}`}
                    className={`truncate rounded-md border px-1.5 py-0.5 text-left text-[10.5px] font-medium transition-colors hover:bg-surface-2 ${STATUS_CHIP[item.effectiveStatus]}`}
                  >
                    {item.clientName} · {formatMoney(item.amount, item.currency)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
