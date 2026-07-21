"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import type { TaskView } from "@/modules/tasks/types";

const PRIORITY_CLASS: Record<string, string> = {
  alta: "bg-negative/15 text-negative",
  media: "bg-amber-400/15 text-amber-300",
  baja: "bg-surface-3 text-ink-muted",
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function TaskRow({
  task,
  onToggle,
  onEdit,
}: {
  task: TaskView;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const done = task.status === "hecha";

  return (
    <li className="flex items-center gap-3 rounded-xl border border-edge/60 bg-surface-2/40 px-3.5 py-2.5">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
          done ? "border-primary bg-primary text-white" : "border-edge-strong text-transparent"
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p
          className={`truncate text-[13px] font-medium ${done ? "text-ink-muted line-through" : "text-ink"}`}
        >
          {task.title}
        </p>
      </button>

      {task.priority && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORITY_CLASS[task.priority]}`}
        >
          {task.priority}
        </span>
      )}

      {task.assignee && (
        <span
          title={task.assignee.name}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[9.5px] font-bold text-primary-soft ring-1 ring-edge"
        >
          {initials(task.assignee.name)}
        </span>
      )}

      {task.deal && (
        <Link
          href="/clientes"
          className="shrink-0 truncate rounded-full bg-primary-faint px-2 py-0.5 text-[10.5px] font-medium text-primary-soft hover:underline"
        >
          {task.deal.title}
        </Link>
      )}
      {task.workspace && (
        <Link
          href={`/espacios/${task.workspace.id}`}
          className="shrink-0 truncate rounded-full bg-primary-faint px-2 py-0.5 text-[10.5px] font-medium text-primary-soft hover:underline"
        >
          {task.workspace.clientName}
        </Link>
      )}

      {task.dueDate && (
        <span
          className={`shrink-0 text-[11.5px] font-medium ${task.overdue ? "text-negative" : "text-ink-muted"}`}
        >
          {formatDate(task.dueDate)}
        </span>
      )}
    </li>
  );
}
