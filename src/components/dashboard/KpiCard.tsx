"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { Kpi } from "@/modules/dashboard/types";
import { formatMoney } from "@/modules/dashboard/data";
import Sparkline from "./charts/Sparkline";
import MiniBars from "./charts/MiniBars";
import MiniFunnel from "./charts/MiniFunnel";

export default function KpiCard({ kpi }: { kpi: Kpi }) {
  const positive = kpi.momPct >= 0;
  const Trend = positive ? TrendingUp : TrendingDown;

  return (
    <article className="group flex flex-col rounded-2xl border border-edge bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover">
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-[12.5px] font-medium text-ink-secondary">
          {kpi.title}
        </h3>
        {kpi.chart.kind === "funnel" && (
          <span className="rounded-full bg-primary-faint px-2 py-0.5 text-[10.5px] font-semibold text-primary-soft">
            {kpi.chart.dealsOpen} clientes interesados
          </span>
        )}
      </header>

      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight">
        {formatMoney(kpi.value, kpi.currency)}
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-[11.5px]">
        <span
          className={`flex items-center gap-1 font-semibold ${
            positive ? "text-positive" : "text-negative"
          }`}
        >
          <Trend size={13} />
          {positive ? "+" : ""}
          {kpi.momPct.toLocaleString("es-ES")}%
        </span>
        <span className="text-ink-muted">{kpi.momLabel}</span>
      </p>

      <div className="mt-4">
        {kpi.chart.kind === "area" && (
          <Sparkline points={kpi.chart.points} currency={kpi.currency} />
        )}
        {kpi.chart.kind === "bars" && (
          <MiniBars points={kpi.chart.points} currency={kpi.currency} />
        )}
        {kpi.chart.kind === "funnel" && (
          <MiniFunnel stages={kpi.chart.stages} currency={kpi.currency} />
        )}
      </div>

      {kpi.footnote && (
        <p className="mt-3 border-t border-edge pt-3 text-[10.5px] leading-relaxed text-ink-muted">
          {kpi.footnote}
        </p>
      )}
    </article>
  );
}
