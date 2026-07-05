"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { WorkspaceColumnView } from "@/modules/workspace/types";
import {
  createColumnAction,
  deleteColumnAction,
  reorderColumnsAction,
  updateColumnAction,
} from "@/modules/workspace/actions";
import Modal from "@/components/clientes/Modal";
import type { RunAction } from "./WorkspaceView";

export default function ColumnsModal({
  workspaceId,
  columns,
  runAction,
  onClose,
}: {
  workspaceId: string;
  columns: WorkspaceColumnView[];
  runAction: RunAction;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const ordered = [...columns].sort((a, b) => a.position - b.position);

  const rename = (column: WorkspaceColumnView, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) return;
    runAction(
      (d) => ({
        ...d,
        columns: d.columns.map((c) =>
          c.id === column.id ? { ...c, name: trimmed } : c,
        ),
      }),
      () => updateColumnAction({ columnId: column.id, name: trimmed }),
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const ids = ordered.map((c) => c.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    runAction(
      (d) => ({
        ...d,
        columns: d.columns.map((c) => ({ ...c, position: ids.indexOf(c.id) })),
      }),
      () => reorderColumnsAction({ workspaceId, orderedIds: ids }),
    );
  };

  const remove = (column: WorkspaceColumnView) => {
    if (
      !window.confirm(
        `¿Eliminar la columna «${column.name}»? Sus tarjetas se moverán a la primera columna restante.`,
      )
    ) {
      return;
    }
    const fallback = ordered.find((c) => c.id !== column.id);
    runAction(
      (d) => ({
        ...d,
        columns: d.columns
          .filter((c) => c.id !== column.id)
          .map((c, i) => ({ ...c, position: i })),
        cards: fallback
          ? d.cards.map((card) =>
              card.columnId === column.id
                ? { ...card, columnId: fallback.id }
                : card,
            )
          : d.cards,
      }),
      () => deleteColumnAction(column.id),
    );
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    runAction(
      (d) => d, // el id real llega con el refresh
      () => createColumnAction({ workspaceId, name }),
    );
  };

  return (
    <Modal title="Columnas del tablero" onClose={onClose} wide>
      <ul className="flex flex-col gap-2">
        {ordered.map((column, index) => (
          <li
            key={column.id}
            className="flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-3 py-2"
          >
            <input
              defaultValue={column.name}
              aria-label={`Nombre de la columna ${column.name}`}
              onBlur={(e) => rename(column, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-medium text-ink outline-none transition-colors hover:border-edge focus:border-primary/60"
            />
            {column.sopContent && (
              <span className="rounded-full bg-primary-faint px-2 py-0.5 text-[10px] font-semibold text-primary-soft">
                SOP
              </span>
            )}
            <div className="flex items-center">
              <button
                type="button"
                aria-label="Subir columna"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label="Bajar columna"
                disabled={index === ordered.length - 1}
                onClick={() => move(index, 1)}
                className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30"
              >
                <ArrowDown size={14} />
              </button>
              <button
                type="button"
                aria-label={`Eliminar columna ${column.name}`}
                onClick={() => remove(column)}
                className="ml-1 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="mt-4 flex items-center gap-2 border-t border-edge pt-4">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nueva columna…"
          aria-label="Nombre de la nueva columna"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
        />
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
        >
          <Plus size={14} /> Añadir
        </button>
      </form>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        El SOP de cada columna se edita desde el panel inferior del kanban,
        seleccionando la columna.
      </p>
    </Modal>
  );
}
