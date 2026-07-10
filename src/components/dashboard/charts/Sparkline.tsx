"use client";

import { useMemo, useState } from "react";
import type { KpiTrendPoint } from "@/modules/dashboard/types";
import { formatMoney } from "@/lib/format";

const W = 240;
const H = 64;
const PAD = 4;

export default function Sparkline({
  points,
  currency,
}: {
  points: KpiTrendPoint[];
  currency?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const coords = useMemo(() => {
    const max = Math.max(...points.map((p) => p.value));
    const min = Math.min(...points.map((p) => p.value));
    const span = max - min || 1;
    const step = (W - PAD * 2) / (points.length - 1);
    return points.map((p, i) => ({
      x: PAD + i * step,
      y: PAD + (H - PAD * 2) * (1 - (p.value - min) / span),
    }));
  }, [points]);

  const linePath = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`)
    .join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${H} L${coords[0].x},${H} Z`;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.x - x) < Math.abs(coords[nearest].x - x)) nearest = i;
    });
    setHover(nearest);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-16 w-full cursor-crosshair"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Tendencia: ${points.map((p) => `${p.label} ${formatMoney(p.value, currency)}`).join(", ")}`}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b7cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b7cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-fill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#8b7cf6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {hover !== null && (
          <>
            <line
              x1={coords[hover].x}
              x2={coords[hover].x}
              y1={0}
              y2={H}
              stroke="#33334a"
              strokeWidth="1"
            />
            <circle
              cx={coords[hover].x}
              cy={coords[hover].y}
              r="4"
              fill="#8b7cf6"
              stroke="#12121a"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-edge bg-surface-3 px-2.5 py-1 text-[11px] shadow-card"
          style={{ left: `${(coords[hover].x / W) * 100}%` }}
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
