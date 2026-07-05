"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type {
  WorkspaceCardView,
  WorkspaceColumnView,
} from "@/modules/workspace/types";
import {
  createCardAction,
  deleteCardAction,
  updateCardAction,
} from "@/modules/workspace/actions";
import Modal from "@/components/clientes/Modal";
import type { RunAction } from "./WorkspaceView";

const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
const labelClass =
  "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";

export default function CardFormModal({
  mode,
  card,
  workspaceId,
  columns,
  defaultColumnId,
  runAction,
  onClose,
}: {
  mode: "create" | "edit";
  card: WorkspaceCardView | null;
  workspaceId: string;
  columns: WorkspaceColumnView[];
  defaultColumnId: string | null;
  runAction: RunAction;
  onClose: () => void;
}) {
  const orderedColumns = [...columns].sort((a, b) => a.position - b.position);
  const [title, setTitle] = useState(card?.title ?? "");
  const [description, setDescription] = useState(card?.description ?? "");
  const [assignee, setAssignee] = useState(card?.assignee ?? "");
  const [dueDate, setDueDate] = useState(card?.dueDate ?? "");
  const [columnId, setColumnId] = useState(
    card?.columnId ?? defaultColumnId ?? orderedColumns[0]?.id ?? "",
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") {
      await runAction(
        (d) => d, // la tarjeta real (con id) llega con el refresh
        () =>
          createCardAction({
            workspaceId,
            columnId,
            title,
            description: description || null,
            assignee: assignee || null,
            dueDate: dueDate || null,
          }),
      );
    } else if (card) {
      await runAction(
        (d) => ({
          ...d,
          cards: d.cards.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  title,
                  description: description || null,
                  assignee: assignee || null,
                  dueDate: dueDate || null,
                }
              : c,
          ),
        }),
        () =>
          updateCardAction({
            cardId: card.id,
            title,
            description: description || null,
            assignee: assignee || null,
            dueDate: dueDate || null,
          }),
      );
    }
    onClose();
  };

  const remove = async () => {
    if (!card) return;
    if (!window.confirm(`¿Eliminar la tarjeta «${card.title}»?`)) return;
    await runAction(
      (d) => ({ ...d, cards: d.cards.filter((c) => c.id !== card.id) }),
      () => deleteCardAction(card.id),
    );
    onClose();
  };

  return (
    <Modal
      title={mode === "create" ? "Nueva tarjeta" : "Editar tarjeta"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Título
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Configurar píxel de Meta"
            className={inputClass}
          />
        </label>
        {mode === "create" && (
          <label className={labelClass}>
            Columna
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className={inputClass}
            >
              {orderedColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={labelClass}>
          Descripción
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Detalle o checklist de la tarea (opcional)"
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>
            Responsable
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Nombre"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Fecha límite
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-1.5 rounded-xl border border-negative/40 px-3.5 py-2.5 text-[12.5px] font-semibold text-negative transition-colors duration-150 hover:bg-negative/10"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
          <button
            type="submit"
            className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
          >
            {mode === "create" ? "Crear tarjeta" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
