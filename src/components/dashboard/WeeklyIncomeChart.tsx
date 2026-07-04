"use client";

import { useState } from "react";
import type { WeeklyIncome } from "@/modules/dashboard/types";
import { formatEuro } from "@/modules/dashboard/data";

export default function WeeklyIncomeChart({ data }: { data: WeeklyIncome[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.amount));
  const best = data.reduce((a, b) => (b.amount > a.amount ? b : a));

  return (
    <div className="relative">
      <div className="relative h-28">
        {/* Grid horizontal recesivo */}
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="absolute left-0 right-0 border-t border-dashed border-edge"
            style={{ top: `${(i / 2) * 100}%` }}
          />
        ))}
        <div className="absolute inset-0 flex items-end gap-3 px-1">
          {data.map((d, i) => {
            const isBest = d.week === best.week;
            return (
              <button
                type="button"
                key={d.week}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.week}: ${formatEuro(d.amount)}`}
                className="flex h-full flex-1 items-end"
              >
                <span
                  className={`w-full rounded-t transition-colors duration-150 ${
                    isBest || hover === i ? "bg-primary" : "bg-primary/40"
                  }`}
                  style={{ height: `${(d.amount / max) * 100}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-3 px-1">
        {data.map((d) => (
          <span
            key={d.week}
            className="flex-1 text-center text-[10px] text-ink-muted"
          >
            {d.week}
          </span>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-edge bg-surface-3 px-2.5 py-1 text-[11px] shadow-card"
          style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
        >
          <span className="text-ink-muted">{data[hover].week} · </span>
          <span className="font-semibold text-ink">
            {formatEuro(data[hover].amount)}
          </span>
        </div>
      )}
    </div>
  );
}
