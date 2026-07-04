"use client";

import { ArrowUpRight } from "lucide-react";
import type { Opportunity, OpportunityStatus } from "@/modules/dashboard/types";
import { formatEuro } from "@/modules/dashboard/data";

const STATUS_STYLES: Record<OpportunityStatus, string> = {
  Descubrimiento: "bg-surface-3 text-ink-secondary",
  Propuesta: "bg-primary-faint text-primary-soft",
  Negociación: "bg-primary/25 text-primary-soft",
  Cierre: "bg-positive/15 text-positive",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function OpportunityCard({ opp }: { opp: Opportunity }) {
  return (
    <article className="group flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-edge bg-surface shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover">
      <div
        className="relative h-28"
        style={{
          background: `linear-gradient(135deg, ${opp.accent}33 0%, ${opp.accent}0d 55%, transparent 100%), #1a1a24`,
        }}
      >
        <span
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-bold text-white shadow-card"
          style={{ backgroundColor: opp.accent }}
        >
          {opp.companyInitial}
        </span>
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${STATUS_STYLES[opp.status]}`}
        >
          {opp.status}
        </span>
        <span className="absolute bottom-3 left-4 text-[11px] font-medium text-ink-secondary">
          {opp.company}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[14px] font-semibold leading-snug">
            {opp.title}
          </h3>
          <ArrowUpRight
            size={16}
            className="mt-0.5 shrink-0 text-ink-muted opacity-0 transition-all duration-200 group-hover:text-primary-soft group-hover:opacity-100"
          />
        </div>
        <p className="mt-1 text-lg font-bold tracking-tight text-primary-soft">
          {formatEuro(opp.amount)}
        </p>

        <div className="mt-4 flex items-center gap-2.5 border-t border-edge pt-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-primary-soft ring-1 ring-edge">
            {initials(opp.ownerName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium">{opp.ownerName}</p>
            <p className="truncate text-[10.5px] text-ink-muted">
              {opp.ownerRole}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
