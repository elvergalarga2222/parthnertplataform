"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FIELD_TYPES, type FieldType } from "@/modules/crm/types";
import { createCustomFieldAction } from "@/modules/crm/actions";
import type { RunAction } from "./ClientesView";
import Modal from "@/components/system/Modal";

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto",
  number: "Número",
  select: "Selección",
  date: "Fecha",
  boolean: "Sí / No",
};

// Creates a custom_field on the fly; the new column appears in the table and
// as an editable field on the deal card without any schema migration.
export default function AddColumnButton({ runAction }: { runAction: RunAction }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [optionsRaw, setOptionsRaw] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const options =
      fieldType === "select"
        ? optionsRaw
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : null;
    await runAction(
      (d) => d, // sin cambio optimista: el id real llega con el refresh
      () => createCustomFieldAction({ label, fieldType, options }),
    );
    setOpen(false);
    setLabel("");
    setFieldType("text");
    setOptionsRaw("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-dashed border-edge-strong px-2.5 py-1.5 text-[11px] font-semibold normal-case tracking-normal text-ink-muted transition-colors duration-150 hover:border-primary/60 hover:text-primary-soft"
      >
        <Plus size={12} /> Columna
      </button>

      {open && (
        <Modal title="Nueva columna personalizada" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
              Nombre del campo
              <input
                autoFocus
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: Fuente del lead"
                className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
              Tipo
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as FieldType)}
                className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            {fieldType === "select" && (
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
                Opciones (separadas por coma)
                <input
                  required
                  value={optionsRaw}
                  onChange={(e) => setOptionsRaw(e.target.value)}
                  placeholder="Referido, Instagram, Web"
                  className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
                />
              </label>
            )}
            <button
              type="submit"
              className="rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
            >
              Crear columna
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
