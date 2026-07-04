"use client";

import { useState } from "react";
import type { PipelineStage } from "@/modules/dashboard/types";
import { formatEuro } from "@/modules/dashboard/data";

// Rampa secuencial de un solo tono (etapas ordenadas del pipeline),
// con etiqueta directa por etapa — la identidad nunca depende solo del color.
const STAGE_COLORS = ["#c4b5fd", "#8b7cf6", "#6a58d8"];

export default function MiniFunnel({ stages }: { stages: PipelineStage[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...stages.map((s) => s.amount));

  return (
    <div>
      <div className="flex h-14 items-end gap-1.5">
        {stages.map((s, i) => (
          <button
            type="button"
            key={s.name}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${s.name}: ${formatEuro(s.amount)}, ${s.deals} negocios`}
            className="flex h-full flex-1 items-end"
          >
            <span
              className="w-full rounded-t transition-opacity duration-150"
              style={{
                height: `${(s.amount / max) * 100}%`,
                backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </button>
        ))}
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {stages.map((s, i) => (
          <li
            key={s.name}
            className={`flex items-center justify-between gap-2 rounded px-1 text-[11px] transition-colors duration-150 ${
              hover === i ? "text-ink" : "text-ink-secondary"
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }}
              />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="shrink-0 font-medium text-ink">
              {formatEuro(s.amount)}{" "}
              <span className="font-normal text-ink-muted">({s.deals})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
