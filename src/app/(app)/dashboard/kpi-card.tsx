"use client";

import { useState } from "react";

interface KpiCardProps {
  label: string;
  value: number;
  momPct: number | null;
  spark: number[];
  footer?: React.ReactNode;
  variant?: "area" | "bars";
}

const euro = (n: number) =>
  "€" + Math.round(n).toLocaleString("es-ES");

export function KpiCard({
  label,
  value,
  momPct,
  spark,
  footer,
  variant = "area",
}: KpiCardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const up = (momPct ?? 0) >= 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-b from-[#141418] to-[#0d0d11] p-5 transition hover:border-violet-500/30">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-violet-600/10 blur-2xl transition group-hover:bg-violet-500/20" />

      <p className="text-sm text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
        {euro(value)}
      </p>

      {momPct !== null && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium ${
              up
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            }`}
          >
            {up ? "↑" : "↓"} {Math.abs(momPct)}%
          </span>
          <span className="text-zinc-500">MoM vs. mes anterior</span>
        </div>
      )}

      <div className="relative mt-4 h-14">
        {variant === "area" ? (
          <AreaSpark data={spark} hover={hover} setHover={setHover} />
        ) : (
          <BarSpark data={spark} hover={hover} setHover={setHover} />
        )}
        {hover !== null && spark[hover] !== undefined && (
          <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-md border border-white/10 bg-black/90 px-2 py-0.5 text-[11px] text-white">
            {euro(spark[hover])}
          </div>
        )}
      </div>

      {footer && <div className="mt-3 text-xs text-zinc-400">{footer}</div>}
    </div>
  );
}

function AreaSpark({
  data,
  hover,
  setHover,
}: {
  data: number[];
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 40;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => [i * step, h - (d / max) * (h - 6) - 3]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="kpiArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#kpiArea)" />
      <path d={line} fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle
            cx={p[0]}
            cy={p[1]}
            r={hover === i ? 2.5 : 0}
            fill="#c4b5fd"
          />
          <rect
            x={i * step - step / 2}
            y={0}
            width={step}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      ))}
    </svg>
  );
}

function BarSpark({
  data,
  hover,
  setHover,
}: {
  data: number[];
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-full items-end gap-1.5">
      {data.map((d, i) => (
        <div
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          className="flex-1 cursor-pointer rounded-t transition"
          style={{
            height: `${(d / max) * 100}%`,
            background:
              hover === i
                ? "linear-gradient(180deg,#a78bfa,#7c3aed)"
                : "linear-gradient(180deg,#8b5cf6,#6d28d9)",
            opacity: hover === null || hover === i ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}
