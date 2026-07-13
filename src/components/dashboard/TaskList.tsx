"use client";

import { Check } from "lucide-react";
import type { TaskView } from "@/modules/tasks/types";

function detailFor(task: TaskView): string {
  if (task.dueDate) {
    const d = new Date(`${task.dueDate}T00:00:00Z`);
    const label = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return task.overdue ? `Venció el ${label}` : `Vence el ${label}`;
  }
  if (task.deal) return task.deal.title;
  if (task.workspace) return task.workspace.clientName;
  return "Sin fecha";
}

export default function TaskList({
  tasks,
  onToggle,
}: {
  tasks: TaskView[];
  onToggle: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-[12.5px] text-ink-muted">No tienes tareas abiertas.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const done = task.status === "hecha";
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onToggle(task.id)}
              aria-pressed={done}
              className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-surface-2 px-3.5 py-3 text-left transition-all duration-150 hover:border-primary/40 hover:bg-surface-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-ink-muted ring-1 ring-edge">
                {task.title[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[12.5px] font-medium transition-colors ${
                    done ? "text-ink-muted line-through" : "text-ink"
                  }`}
                >
                  {task.title}
                </span>
                <span
                  className={`block truncate text-[11px] ${task.overdue && !done ? "text-negative" : "text-ink-muted"}`}
                >
                  {detailFor(task)}
                </span>
              </span>
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                  done
                    ? "border-primary bg-primary text-white"
                    : "border-edge-strong text-transparent"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
