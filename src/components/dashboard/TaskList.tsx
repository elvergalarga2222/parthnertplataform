"use client";

import { Check } from "lucide-react";
import type { DashboardTask as Task } from "@/modules/dashboard/types";

export default function TaskList({
  tasks,
  onToggle,
}: {
  tasks: Task[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => onToggle(task.id)}
            aria-pressed={task.done}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-surface-2 px-3.5 py-3 text-left transition-all duration-150 hover:border-primary/40 hover:bg-surface-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-ink-muted ring-1 ring-edge">
              {task.title[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[12.5px] font-medium transition-colors ${
                  task.done ? "text-ink-muted line-through" : "text-ink"
                }`}
              >
                {task.title}
              </span>
              <span className="block truncate text-[11px] text-ink-muted">
                {task.detail}
              </span>
            </span>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                task.done
                  ? "border-primary bg-primary text-white"
                  : "border-edge-strong text-transparent"
              }`}
            >
              <Check size={12} strokeWidth={3} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
