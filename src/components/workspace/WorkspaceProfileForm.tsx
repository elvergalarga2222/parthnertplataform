"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { WorkspaceProfileView } from "@/modules/workspace/types";
import { updateProfileAction } from "@/modules/workspace/actions";
import type { RunAction } from "./WorkspaceView";

const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
const labelClass =
  "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";

// Client profile: fixed fields + free key/value pairs stored in jsonb `extra`
// — the partner adds structure fields without any migration.
export default function WorkspaceProfileForm({
  workspaceId,
  profile,
  runAction,
}: {
  workspaceId: string;
  profile: WorkspaceProfileView;
  runAction: RunAction;
}) {
  const [businessName, setBusinessName] = useState(profile.businessName ?? "");
  const [industry, setIndustry] = useState(profile.industry ?? "");
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? "");
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [extraRows, setExtraRows] = useState<{ key: string; value: string }[]>(
    Object.entries(profile.extra).map(([key, value]) => ({ key, value })),
  );
  const [saved, setSaved] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const extra: Record<string, string> = {};
    for (const row of extraRows) {
      const key = row.key.trim();
      if (key) extra[key] = row.value;
    }
    const next: WorkspaceProfileView = {
      businessName: businessName || null,
      industry: industry || null,
      contactEmail: contactEmail || null,
      contactPhone: contactPhone || null,
      notes: notes || null,
      // La estrategia se edita en su propia sección; aquí se preserva.
      strategyDoc: profile.strategyDoc,
      extra,
    };
    await runAction(
      (d) => ({ ...d, profile: next }),
      () => updateProfileAction({ workspaceId, ...next, extra }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form
      onSubmit={submit}
      className="max-w-3xl rounded-2xl border border-edge bg-surface p-6"
    >
      <h2 className="text-[15px] font-bold tracking-tight">
        Ficha del cliente
      </h2>
      <p className="mt-1 text-[12px] text-ink-muted">
        Datos y estructura del negocio. Los campos libres se guardan sin tocar
        el esquema.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Nombre del negocio
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Industria
          <input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Email de contacto
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Teléfono
          <input
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className={`${labelClass} mt-4`}>
        Notas
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Contexto del negocio, acuerdos, accesos…"
          className={inputClass}
        />
      </label>

      <fieldset className="mt-5 rounded-xl border border-edge p-4">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          Campos libres
        </legend>
        <div className="flex flex-col gap-2">
          {extraRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={row.key}
                onChange={(e) =>
                  setExtraRows((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)),
                  )
                }
                placeholder="Campo (ej: Instagram)"
                aria-label={`Nombre del campo libre ${i + 1}`}
                className={`${inputClass} w-44`}
              />
              <input
                value={row.value}
                onChange={(e) =>
                  setExtraRows((rows) =>
                    rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                  )
                }
                placeholder="Valor"
                aria-label={`Valor del campo libre ${i + 1}`}
                className={`${inputClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                aria-label="Eliminar campo libre"
                onClick={() =>
                  setExtraRows((rows) => rows.filter((_, j) => j !== i))
                }
                className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-negative/10 hover:text-negative"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExtraRows((rows) => [...rows, { key: "", value: "" }])}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-edge-strong px-3 py-2 text-[12px] font-semibold text-ink-muted transition-colors hover:border-primary/60 hover:text-primary-soft"
          >
            <Plus size={13} /> Añadir campo
          </button>
        </div>
      </fieldset>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
        >
          <Save size={14} /> Guardar ficha
        </button>
        {saved && (
          <span className="text-[12px] font-semibold text-positive">
            Guardado ✓
          </span>
        )}
      </div>
    </form>
  );
}
