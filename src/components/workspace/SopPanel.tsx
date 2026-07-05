"use client";

import { useState } from "react";
import { BookOpenText, PencilLine } from "lucide-react";
import type { WorkspaceColumnView } from "@/modules/workspace/types";
import { updateColumnAction } from "@/modules/workspace/actions";
import type { RunAction } from "./WorkspaceView";

// Shows the SOP (guide) of the selected kanban column. The SOP tells the
// partner exactly how to execute the work of that phase.
export default function SopPanel({
  column,
  runAction,
}: {
  column: WorkspaceColumnView | null;
  runAction: RunAction;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!column) return null;

  const save = () => {
    setEditing(false);
    const sopContent = draft.trim() || null;
    runAction(
      (d) => ({
        ...d,
        columns: d.columns.map((c) =>
          c.id === column.id ? { ...c, sopContent } : c,
        ),
      }),
      () => updateColumnAction({ columnId: column.id, sopContent }),
    );
  };

  return (
    <section
      aria-label={`SOP de la columna ${column.name}`}
      className="shrink-0 rounded-2xl border border-edge bg-surface p-4"
    >
      <header className="flex items-center gap-2">
        <BookOpenText size={14} className="text-primary-soft" />
        <h2 className="text-[12.5px] font-bold">
          SOP · {column.name}
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(column.sopContent ?? "");
              setEditing(true);
            }}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-primary-soft"
          >
            <PencilLine size={11} /> {column.sopContent ? "Editar" : "Añadir SOP"}
          </button>
        )}
      </header>

      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder="Describe el procedimiento estándar de esta fase: pasos, checklist, criterios de salida…"
            className="w-full rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink outline-none transition-colors focus:border-primary/60"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary-soft"
            >
              Guardar SOP
            </button>
          </div>
        </div>
      ) : column.sopContent ? (
        <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-secondary">
          {column.sopContent}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-ink-muted">
          Esta columna aún no tiene SOP. Añade la guía de ejecución para que
          cualquiera del equipo sepa exactamente qué hacer en esta fase.
        </p>
      )}
    </section>
  );
}
