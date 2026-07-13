"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { CollaboratorView } from "@/modules/team/types";
import type { TaskView } from "@/modules/tasks/types";
import { createTaskAction, setTaskStatusAction, type ActionResult } from "@/modules/tasks/actions";
import TaskRow from "./TaskRow";
import TaskFormModal from "./TaskFormModal";

export type RunAction = (action: () => Promise<ActionResult>) => Promise<boolean>;

type EstadoFilter = "abiertas" | "todas" | "hechas";
type VencimientoFilter = "vencidas" | "hoy" | "semana" | "todas";

interface DealOption {
  id: string;
  title: string;
}
interface WorkspaceOption {
  id: string;
  clientName: string;
}

// Fuera del componente: agrupar depende de "ahora" (impuro) — un helper
// aparte evita el error de react-hooks/purity por llamar Date.now() en render.
interface Filters {
  estado: EstadoFilter;
  asignado: string;
  vencimiento: VencimientoFilter;
  clienteId: string;
  selfCollaboratorId: string | null;
}

// Fuera del componente por la misma razón que groupTasks: depende de "hoy".
function matchesFilters(t: TaskView, f: Filters): boolean {
  if (f.estado === "abiertas" && t.status === "hecha") return false;
  if (f.estado === "hechas" && t.status !== "hecha") return false;

  if (f.asignado === "yo") {
    const mine = f.selfCollaboratorId
      ? t.assignee?.id === f.selfCollaboratorId
      : t.assignee === null;
    if (!mine) return false;
  } else if (f.asignado !== "todos" && t.assignee?.id !== f.asignado) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  if (f.vencimiento === "vencidas" && !t.overdue) return false;
  if (f.vencimiento === "hoy" && t.dueDate !== today) return false;
  if (f.vencimiento === "semana") {
    const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    if (!t.dueDate || t.dueDate < today || t.dueDate > week) return false;
  }

  if (f.clienteId !== "todos" && t.deal?.id !== f.clienteId) return false;

  return true;
}

function groupTasks(list: TaskView[]) {
  const vencidas = list.filter((t) => t.overdue);
  const hoy = list.filter((t) => {
    if (t.overdue || t.status === "hecha" || !t.dueDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return t.dueDate === today;
  });
  const proximas = list.filter((t) => {
    if (t.overdue || t.status === "hecha" || !t.dueDate) return false;
    const today = new Date().toISOString().slice(0, 10);
    return t.dueDate > today;
  });
  const sinFecha = list.filter((t) => t.status !== "hecha" && !t.dueDate && !t.overdue);
  const hechas = list.filter((t) => t.status === "hecha");
  return { vencidas, hoy, proximas, sinFecha, hechas };
}

export default function TareasView({
  tasks,
  deals,
  workspaces,
  collaborators,
  selfCollaboratorId,
}: {
  tasks: TaskView[];
  deals: DealOption[];
  workspaces: WorkspaceOption[];
  collaborators: CollaboratorView[];
  selfCollaboratorId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [taskModal, setTaskModal] = useState<
    { mode: "create" } | { mode: "edit"; task: TaskView } | null
  >(null);
  const [showHechas, setShowHechas] = useState(false);

  const [estado, setEstado] = useState<EstadoFilter>("abiertas");
  const [asignado, setAsignado] = useState<string>("todos"); // "todos" | "yo" | collaboratorId
  const [vencimiento, setVencimiento] = useState<VencimientoFilter>("todas");
  const [clienteId, setClienteId] = useState<string>("todos");

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const runAction: RunAction = async (action) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const filtered = tasks.filter((t) =>
    matchesFilters(t, { estado, asignado, vencimiento, clienteId, selfCollaboratorId }),
  );

  const { vencidas, hoy, proximas, sinFecha, hechas } = groupTasks(filtered);

  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    const ok = await runAction(() => createTaskAction({ title }));
    if (ok) setQuickTitle("");
  };

  const toggleDone = (task: TaskView) =>
    runAction(() =>
      setTaskStatusAction({
        taskId: task.id,
        status: task.status === "hecha" ? "pendiente" : "hecha",
      }),
    );

  const selectClass =
    "rounded-xl border border-edge bg-surface-2 px-3 py-2 text-[12.5px] text-ink outline-none focus:border-primary/60";

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-6 pt-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-bold tracking-tight text-ink">Tareas</h1>
          <p className="text-[12.5px] text-ink-muted">
            Lo que tienes que hacer tú y tu equipo — distinto del tablero de entrega del cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTaskModal({ mode: "create" })}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-glow transition-colors hover:bg-primary-strong"
        >
          <Plus size={14} /> Nueva tarea
        </button>
      </header>

      <form onSubmit={quickAdd} className="flex gap-2">
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Añadir tarea…"
          disabled={busy}
          className="flex-1 rounded-xl border border-edge bg-surface px-4 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={busy || !quickTitle.trim()}
          className="rounded-xl border border-edge bg-surface px-4 py-2.5 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft disabled:opacity-50"
        >
          Añadir
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoFilter)}
          className={selectClass}
        >
          <option value="abiertas">Abiertas</option>
          <option value="todas">Todas</option>
          <option value="hechas">Hechas</option>
        </select>
        <select value={asignado} onChange={(e) => setAsignado(e.target.value)} className={selectClass}>
          <option value="todos">Todos</option>
          <option value="yo">Yo</option>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.displayName ?? c.email}
            </option>
          ))}
        </select>
        <select
          value={vencimiento}
          onChange={(e) => setVencimiento(e.target.value as VencimientoFilter)}
          className={selectClass}
        >
          <option value="todas">Cualquier fecha</option>
          <option value="vencidas">Vencidas</option>
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
        </select>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={selectClass}>
          <option value="todos">Todos los clientes</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-5">
        {vencidas.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-negative">
              Vencidas
            </p>
            <ul className="flex flex-col gap-1.5">
              {vencidas.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onEdit={() => setTaskModal({ mode: "edit", task: t })} />
              ))}
            </ul>
          </section>
        )}
        {hoy.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Hoy</p>
            <ul className="flex flex-col gap-1.5">
              {hoy.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onEdit={() => setTaskModal({ mode: "edit", task: t })} />
              ))}
            </ul>
          </section>
        )}
        {proximas.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Próximas
            </p>
            <ul className="flex flex-col gap-1.5">
              {proximas.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onEdit={() => setTaskModal({ mode: "edit", task: t })} />
              ))}
            </ul>
          </section>
        )}
        {sinFecha.length > 0 && (
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Sin fecha
            </p>
            <ul className="flex flex-col gap-1.5">
              {sinFecha.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onEdit={() => setTaskModal({ mode: "edit", task: t })} />
              ))}
            </ul>
          </section>
        )}
        {hechas.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowHechas((v) => !v)}
              className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted hover:text-ink-secondary"
            >
              Hechas ({hechas.length}) {showHechas ? "▲" : "▼"}
            </button>
            {showHechas && (
              <ul className="flex flex-col gap-1.5">
                {hechas.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={() => toggleDone(t)} onEdit={() => setTaskModal({ mode: "edit", task: t })} />
                ))}
              </ul>
            )}
          </section>
        )}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-edge bg-surface p-8 text-center text-[13px] text-ink-muted shadow-card">
            No hay tareas con estos filtros.
          </div>
        )}
      </div>

      {taskModal && (
        <TaskFormModal
          mode={taskModal.mode}
          task={taskModal.mode === "edit" ? taskModal.task : null}
          deals={deals}
          workspaces={workspaces}
          collaborators={collaborators}
          runAction={runAction}
          onClose={() => setTaskModal(null)}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-negative/40 bg-surface-3 px-4 py-2.5 text-[13px] font-medium text-negative shadow-card-hover"
        >
          {error}
        </div>
      )}
    </div>
  );
}
