"use client";

import type { AiUsageView } from "@/modules/ai/types";

// Shows the partner's monthly token consumption (regla #6: control de costo).
export default function AiUsageBanner({ usage }: { usage: AiUsageView }) {
  const danger = usage.pct >= 90;
  const warn = usage.pct >= 70 && usage.pct < 90;
  const barColor = danger
    ? "bg-negative"
    : warn
      ? "bg-amber-400"
      : "bg-primary";

  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-semibold text-ink-secondary">
          Consumo de IA (mes)
        </span>
        <span className="text-ink-muted">
          {usage.tokensUsedThisMonth.toLocaleString("es-ES")} /{" "}
          {usage.monthlyTokenLimit.toLocaleString("es-ES")} tokens · {usage.pct}%
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(100, usage.pct)}%` }}
        />
      </div>
      {danger && (
        <p className="mt-1.5 text-[11px] font-medium text-negative">
          Estás cerca de tu límite mensual. Al superarlo, la generación se
          bloquea hasta el próximo mes.
        </p>
      )}
    </div>
  );
}
