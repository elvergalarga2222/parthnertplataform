"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { TaskView } from "@/modules/tasks/types";
import {
  createTaskAction,
  getTasksForDeal,
  getTasksForWorkspace,
  setTaskStatusAction,
} from "@/modules/tasks/actions";

/**
 * Panel embebido (deal o workspace) — patrón on-demand como getDealActivity:
 * no engorda el snapshot principal de CRM/Workspace, se consulta al abrir.
 * Pasa exactamente uno de dealId/workspaceId.
 */
export default function TaskMiniList({
  dealId,
  workspaceId,
}: {
  dealId?: string;
  workspaceId?: string;
}) {
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga inicial — patrón AiPanel: fetch inline en el efecto con guarda de
  // cancelación (no una función compartida con los handlers de abajo, para
  // que el linter no la trate como "setState directo en efecto").
  useEffect(() => {
    let cancelled = false;
    const fetcher = dealId
      ? getTasksForDeal(dealId)
      : workspaceId
        ? getTasksForWorkspace(workspaceId)
        : Promise.resolve([]);
    fetcher.then((result) => {
      if (!cancelled) setTasks(result);
    });
    return () => {
      cancelled = true;
    };
  }, [dealId, workspaceId]);

  const refetch = async () => {
    const result = dealId
      ? await getTasksForDeal(dealId)
      : workspaceId
        ? await getTasksForWorkspace(workspaceId)
        : [];
    setTasks(result);
  };

  const toggle = async (task: TaskView) => {
    setBusy(true);
    const result = await setTaskStatusAction({
      taskId: task.id,
      status: task.status === "hecha" ? "pendiente" : "hecha",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refetch();
  };

  const quickAdd = async () => {
    const title = quickTitle.trim();
    if (!title) return;
    setBusy(true);
    const result = await createTaskAction({ title, dealId, workspaceId });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuickTitle("");
    await refetch();
  };

  if (tasks === null) {
    return <p className="text-[12.5px] text-ink-muted">Cargando tareas…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sin <form>: este componente se embebe dentro del <form> de
          DealFormModal (Clientes) — anidar <form> no es HTML válido y rompe
          el envío. Enter en el input dispara el quick-add igual. */}
      <div className="flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              quickAdd();
            }
          }}
          placeholder="Añadir tarea…"
          disabled={busy}
          className="flex-1 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-[12.5px] text-ink outline-none transition-colors focus:border-primary/60"
        />
        <button
          type="button"
          onClick={quickAdd}
          disabled={busy || !quickTitle.trim()}
          className="rounded-lg border border-edge px-3 py-2 text-[11.5px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft disabled:opacity-50"
        >
          Añadir
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">Sin tareas todavía.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2.5 rounded-lg border border-edge/60 bg-surface-2/40 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => toggle(t)}
                disabled={busy}
                aria-pressed={t.status === "hecha"}
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
                  t.status === "hecha"
                    ? "border-primary bg-primary text-white"
                    : "border-edge-strong text-transparent"
                }`}
              >
                <Check size={10} strokeWidth={3} />
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-[12.5px] ${
                  t.status === "hecha" ? "text-ink-muted line-through" : "text-ink"
                }`}
              >
                {t.title}
              </span>
              {t.dueDate && (
                <span className={`shrink-0 text-[11px] ${t.overdue ? "text-negative" : "text-ink-muted"}`}>
                  {t.dueDate.slice(5)}
                </span>
              )}
              {t.assignee && (
                <span className="shrink-0 text-[11px] text-ink-muted">{t.assignee.name}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-[11.5px] text-negative">{error}</p>}
    </div>
  );
}
