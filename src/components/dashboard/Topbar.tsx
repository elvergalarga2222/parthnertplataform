"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Clock, Mail, Search } from "lucide-react";
import type { InvoiceAlert, InvoiceAlerts } from "@/modules/finance/types";
import { formatMoney } from "@/lib/format";

const EMPTY_ALERTS: InvoiceAlerts = { overdue: [], upcoming: [], total: 0 };

function alertLabel(a: InvoiceAlert): string {
  if (a.kind === "vencido") {
    const days = Math.abs(a.daysUntilDue);
    if (a.daysUntilDue >= 0) return "Vence hoy";
    return `Vencido hace ${days} ${days === 1 ? "día" : "días"}`;
  }
  if (a.daysUntilDue === 0) return "Vence hoy";
  return `Vence en ${a.daysUntilDue} ${a.daysUntilDue === 1 ? "día" : "días"}`;
}

function AlertRow({ a }: { a: InvoiceAlert }) {
  const overdue = a.kind === "vencido";
  const Icon = overdue ? AlertTriangle : Clock;
  return (
    <li className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          overdue
            ? "bg-negative/15 text-negative"
            : "bg-amber-500/15 text-amber-400"
        }`}
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-ink">
            {a.clientName}
          </span>
          <span className="shrink-0 text-[12.5px] font-semibold text-ink">
            {formatMoney(a.amount, a.currency)}
          </span>
        </span>
        <span
          className={`text-[11.5px] ${overdue ? "text-negative" : "text-amber-400"}`}
        >
          {alertLabel(a)}
        </span>
      </span>
    </li>
  );
}

export default function Topbar({
  displayName,
  alerts = EMPTY_ALERTS,
  /** "Colaborador de {partner}" — presente solo cuando actúa un colaborador (PR-8). */
  collaboratorOfPartnerName,
}: {
  displayName: string;
  alerts?: InvoiceAlerts;
  collaboratorOfPartnerName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = alerts.total;

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="flex items-center gap-4 px-6 pb-2 pt-5 max-md:flex-wrap">
      <label className="relative min-w-0 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          placeholder="Buscar clientes, oportunidades, tareas…"
          className="w-full rounded-full border border-edge bg-surface py-2.5 pl-11 pr-4 text-[13px] text-ink placeholder:text-ink-muted outline-none transition-all duration-150 focus:border-primary/60 focus:shadow-glow"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Mensajes"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-ink-secondary transition-colors duration-150 hover:border-primary/50 hover:text-primary-soft"
        >
          <Mail size={16} />
        </button>

        <div ref={ref} className="relative">
          <button
            type="button"
            aria-label={
              count > 0
                ? `Notificaciones: ${count} cobros por atender`
                : "Notificaciones"
            }
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full border bg-surface transition-colors duration-150 hover:border-primary/50 hover:text-primary-soft ${
              open
                ? "border-primary/60 text-primary-soft"
                : "border-edge text-ink-secondary"
            }`}
          >
            <Bell size={16} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[9.5px] font-bold text-white">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-2xl border border-edge bg-surface shadow-card-hover">
              <header className="flex items-center justify-between border-b border-edge px-4 py-3">
                <h3 className="text-[13px] font-bold tracking-tight">Cobros</h3>
                {count > 0 && (
                  <span className="rounded-full bg-primary-faint px-2 py-0.5 text-[10.5px] font-semibold text-primary-soft">
                    {count} por atender
                  </span>
                )}
              </header>

              {count === 0 ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
                  No hay cobros vencidos ni próximos a vencer.
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {alerts.overdue.length > 0 && (
                    <>
                      <p className="bg-surface-2 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-ink-muted">
                        Vencidos
                      </p>
                      <ul className="divide-y divide-edge">
                        {alerts.overdue.map((a) => (
                          <AlertRow key={a.id} a={a} />
                        ))}
                      </ul>
                    </>
                  )}
                  {alerts.upcoming.length > 0 && (
                    <>
                      <p className="bg-surface-2 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-ink-muted">
                        Próximos a vencer
                      </p>
                      <ul className="divide-y divide-edge">
                        {alerts.upcoming.map((a) => (
                          <AlertRow key={a.id} a={a} />
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-strong text-[12px] font-bold text-white">
          {displayName[0]?.toUpperCase() ?? "·"}
        </span>
        <span className="flex flex-col max-sm:hidden">
          <span className="text-[13.5px] font-semibold leading-tight text-ink">
            {displayName}
          </span>
          {collaboratorOfPartnerName && (
            <span className="text-[10.5px] leading-tight text-ink-muted">
              Colaborador de {collaboratorOfPartnerName}
            </span>
          )}
        </span>
      </div>
    </header>
  );
}
