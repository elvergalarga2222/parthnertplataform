"use client";

import { useState } from "react";
import type { WeeklyIncome } from "@/modules/dashboard/dashboard-service";

export function WeeklyChart({ data }: { data: WeeklyIncome[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.amount), 1);

  return (
    <div>
      <div className="flex h-28 items-end gap-3">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex flex-1 flex-col items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="relative flex w-full flex-1 items-end">
              {hover === i && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/90 px-2 py-0.5 text-[11px] text-white">
                  €{Math.round(d.amount).toLocaleString("es-ES")}
                </div>
              )}
              <div
                className="w-full rounded-lg transition-all duration-300"
                style={{
                  height: `${Math.max((d.amount / max) * 100, 4)}%`,
                  background:
                    hover === i
                      ? "linear-gradient(180deg,#a78bfa,#7c3aed)"
                      : "linear-gradient(180deg,#8b5cf6,#5b21b6)",
                }}
              />
            </div>
            <span className="text-[10px] text-zinc-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
