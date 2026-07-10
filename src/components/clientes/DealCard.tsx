"use client";

import { Building2, CalendarClock, FileWarning } from "lucide-react";
import type { DealView } from "@/modules/crm/types";
import { formatMoney } from "@/modules/crm/helpers";
import FitBadge from "./FitBadge";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function DealCard({
  deal,
  overlay = false,
}: {
  deal: DealView;
  overlay?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border bg-surface-2 p-3.5 transition-all duration-150 ${
        overlay
          ? "rotate-2 border-primary/60 shadow-card-hover"
          : "border-edge hover:border-primary/40 hover:shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13px] font-semibold leading-snug">{deal.title}</h3>
        <span className="flex shrink-0 items-center gap-1.5">
          {deal.isNewClient && !deal.brief?.trim() && (
            <FileWarning
              size={13}
              className="text-amber-400"
              aria-label="Brief pendiente"
            >
              <title>Brief pendiente — cliente nuevo sin diagnóstico</title>
            </FileWarning>
          )}
          <FitBadge fit={deal.fit} />
        </span>
      </div>

      <p className="mt-1.5 text-[15px] font-bold tracking-tight text-primary-soft">
        {formatMoney(deal.value, deal.currency)}
      </p>

      {(deal.companyName || deal.contactName) && (
        <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-ink-secondary">
          {deal.contactName && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9px] font-bold text-primary-soft ring-1 ring-edge">
              {initials(deal.contactName)}
            </span>
          )}
          <span className="flex min-w-0 items-center gap-1 truncate">
            {deal.companyName && (
              <>
                <Building2 size={11} className="shrink-0 text-ink-muted" />
                <span className="truncate">{deal.companyName}</span>
              </>
            )}
            {!deal.companyName && deal.contactName && (
              <span className="truncate">{deal.contactName}</span>
            )}
          </span>
        </div>
      )}

      {deal.nextActivity && (
        <p className="mt-2.5 flex items-center gap-1.5 border-t border-edge pt-2.5 text-[11px] text-ink-muted">
          <CalendarClock size={11} className="shrink-0" />
          <span className="truncate">{deal.nextActivity}</span>
        </p>
      )}
    </article>
  );
}
