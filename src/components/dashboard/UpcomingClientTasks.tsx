import Link from "next/link";
import { CheckSquare } from "lucide-react";
import type { TaskView } from "@/modules/tasks/types";

function formatDue(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default function UpcomingClientTasks({ tasks }: { tasks: TaskView[] }) {
  return (
    <section className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <header className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold tracking-tight">Próximas tareas de clientes</h2>
        <Link
          href="/tareas"
          className="text-[12px] font-semibold text-primary-soft transition-colors hover:text-primary"
        >
          Ver todas
        </Link>
      </header>

      {tasks.length === 0 ? (
        <p className="mt-4 text-[12.5px] text-ink-muted">
          No hay tareas abiertas vinculadas a clientes o espacios.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-edge/60 bg-surface-2/40 px-3.5 py-2.5"
            >
              <CheckSquare
                size={14}
                className={task.overdue ? "shrink-0 text-negative" : "shrink-0 text-ink-muted"}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{task.title}</span>
              <span className="shrink-0 truncate rounded-full bg-primary-faint px-2 py-0.5 text-[10.5px] font-medium text-primary-soft">
                {task.deal?.title ?? task.workspace?.clientName}
              </span>
              {task.dueDate && (
                <span
                  className={`shrink-0 text-[11px] font-medium ${task.overdue ? "text-negative" : "text-ink-muted"}`}
                >
                  {formatDue(task.dueDate)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
