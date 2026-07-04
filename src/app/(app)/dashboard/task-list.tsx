"use client";

import { useState } from "react";
import type { DashboardTask } from "@/modules/dashboard/dashboard-service";

export function TaskList({ tasks }: { tasks: DashboardTask[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(tasks.map((t) => [t.id, t.done])),
  );

  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const done = state[t.id];
        return (
          <li
            key={t.id}
            className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition hover:border-white/10"
          >
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm ${done ? "text-zinc-500 line-through" : "text-zinc-100"}`}
              >
                {t.title}
              </p>
              <p className="truncate text-xs text-zinc-500">{t.subtitle}</p>
            </div>
            <button
              onClick={() => setState((s) => ({ ...s, [t.id]: !s[t.id] }))}
              aria-label="Marcar tarea"
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                done
                  ? "border-violet-500 bg-violet-500 text-white"
                  : "border-zinc-600 text-transparent hover:border-violet-400"
              }`}
            >
              ✓
            </button>
          </li>
        );
      })}
    </ul>
  );
}
