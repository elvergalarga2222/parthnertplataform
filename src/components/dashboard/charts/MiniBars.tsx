"use client";

import { useState } from "react";
import type { KpiTrendPoint } from "@/modules/dashboard/types";
import { formatMoney } from "@/modules/dashboard/data";

export default function MiniBars({
  points,
  currency,
}: {
  points: KpiTrendPoint[];
  currency?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value));

  return (
    <div className="relative">
      <div className="flex h-16 items-end gap-1.5">
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <button
              type="button"
              key={p.label}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${p.label}: ${formatMoney(p.value, currency)}`}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={`w-full rounded-t transition-colors duration-150 ${
                  isLast
                    ? "bg-primary"
                    : hover === i
                      ? "bg-primary/70"
                      : "bg-primary/35"
                }`}
                style={{ height: `${(p.value / max) * 100}%` }}
              />
            </button>
          );
        })}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-edge bg-surface-3 px-2.5 py-1 text-[11px] shadow-card"
          style={{
            left: `${((hover + 0.5) / points.length) * 100}%`,
          }}
        >
          <span className="text-ink-muted">{points[hover].label} · </span>
          <span className="font-semibold text-ink">
            {formatMoney(points[hover].value, currency)}
          </span>
        </div>
      )}
    </div>
  );
}
