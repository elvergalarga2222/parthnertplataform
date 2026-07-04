"use client";

import { useEffect, useState } from "react";

export function GoalRing({ pct, name }: { pct: number; name: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setShown(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);

  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (shown / 100) * c;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#1f1f27" strokeWidth="12" />
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c4b5fd" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#ring)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-2xl font-semibold text-white">{shown}%</span>
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-medium text-white">
        ¡Buen trabajo, {name}!
      </p>
      <p className="text-center text-xs text-zinc-500">
        Meta trimestral de ventas lograda
      </p>
    </div>
  );
}
