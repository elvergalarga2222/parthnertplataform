"use client";

import { useEffect, useState } from "react";

const SIZE = 148;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function GoalRing({ pct }: { pct: number }) {
  // Anima el anillo de 0 → pct al montar.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div
      className="relative"
      role="img"
      aria-label={`${pct}% de la meta trimestral cumplida`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#232330"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="#8b7cf6"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress / 100)}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-tight">
        {pct}%
      </span>
    </div>
  );
}
