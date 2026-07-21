"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/system/Modal";
import type { CollaboratorView } from "@/modules/team/types";
import { TASK_PRIORITIES, type TaskView } from "@/modules/tasks/types";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/modules/tasks/actions";
import type { RunAction } from "./TareasView";

const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
const labelClass = "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";

export default function TaskFormModal({
  mode,
  task,
  deals,
  workspaces,
  collaborators,
  runAction,
  onClose,
}: {
  mode: "create" | "edit";
  task: TaskView | null;
  deals: { id: string; title: string }[];
  workspaces: { id: string; clientName: string }[];
  collaborators: CollaboratorView[];
  runAction: RunAction;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assignee?.id ?? "");
  const [dealId, setDealId] = useState(task?.deal?.id ?? "");
  const [workspaceId, setWorkspaceId] = useState(task?.workspace?.id ?? "");
  const [dateError, setDateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dueDate) {
      const year = new Date(`${dueDate}T00:00:00Z`).getUTCFullYear();
      if (year < 1970 || year > 2100) {
        setDateError("La fecha no es válida (usa un año entre 1970 y 2100).");
        return;
      }
    }
    setDateError(null);
    setBusy(true);

    const payload = {
      title,
      description: description.trim() || null,
      priority: (priority || null) as (typeof TASK_PRIORITIES)[number] | null,
      dueDate: dueDate || null,
      assigneeCollaboratorId: assigneeId || null,
      dealId: dealId || null,
      workspaceId: workspaceId || null,
    };

    const ok = await runAction(() =>
      mode === "create"
        ? createTaskAction(payload)
        : updateTaskAction({ taskId: task!.id, ...payload }),
    );
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!task) return;
    if (!window.confirm(`¿Eliminar la tarea «${task.title}»?`)) return;
    setBusy(true);
    const ok = await runAction(() => deleteTaskAction(task.id));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title={mode === "create" ? "Nueva tarea" : "Editar tarea"} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Título
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Descripción (opcional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Prioridad
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              <option value="">Sin prioridad</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p} className="capitalize">
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Vencimiento
            <input
              type="date"
              min="1970-01-01"
              max="2100-12-31"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className={labelClass}>
          Asignado a
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass}>
            <option value="">Yo</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName ?? c.email}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Cliente (deal)
            <select value={dealId} onChange={(e) => setDealId(e.target.value)} className={inputClass}>
              <option value="">Ninguno</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Espacio de trabajo
            <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className={inputClass}>
              <option value="">Ninguno</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.clientName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {dateError && <p className="text-[12.5px] text-negative">{dateError}</p>}

        <div className="flex items-center justify-between">
          {mode === "edit" ? (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="flex items-center gap-1.5 rounded-xl border border-negative/40 px-3.5 py-2 text-[12.5px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Guardando…" : mode === "create" ? "Crear tarea" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
