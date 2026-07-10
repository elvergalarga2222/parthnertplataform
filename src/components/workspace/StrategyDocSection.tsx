"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { updateProfileAction } from "@/modules/workspace/actions";
import type { WorkspaceSnapshot } from "@/modules/workspace/types";
import type { RunAction } from "./WorkspaceView";

// Documento vivo de estrategia del cliente ("un lugar donde se GUARDA la
// estrategia"): textarea persistente, sembrable desde la última generación IA.

export default function StrategyDocSection({
  workspaceId,
  strategyDoc,
  latestStrategyGeneration,
  runAction,
}: {
  workspaceId: string;
  strategyDoc: string | null;
  latestStrategyGeneration: WorkspaceSnapshot["latestStrategyGeneration"];
  runAction: RunAction;
}) {
  const [value, setValue] = useState(strategyDoc ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await runAction(
      (d) => ({
        ...d,
        profile: { ...d.profile, strategyDoc: value.trim() || null },
      }),
      () =>
        updateProfileAction({ workspaceId, strategyDoc: value.trim() || null }),
    );
    setSaving(false);
    setSaved(true);
  };

  const useAiGeneration = () => {
    if (!latestStrategyGeneration) return;
    setValue(latestStrategyGeneration.outputText);
    setSaved(false);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-edge bg-surface p-5 shadow-card">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-bold tracking-tight">
          Documento de estrategia
        </h3>
        <button
          type="button"
          disabled={!latestStrategyGeneration}
          title={
            latestStrategyGeneration
              ? "Copia la última generación de IA de tipo estrategia (editable antes de guardar)"
              : "Aún no hay generaciones de IA de tipo estrategia en este espacio"
          }
          onClick={useAiGeneration}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-edge bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkles size={13} /> Usar última generación de IA
        </button>
      </header>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={12}
        maxLength={50_000}
        placeholder={
          "# Estrategia\n\nContexto, objetivos y plan del cliente…\n\n## Fases\n- Descubrimiento\n- Implementación"
        }
        className="resize-y rounded-xl border border-edge bg-surface-2 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-ink outline-none transition-colors focus:border-primary/60"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar estrategia"}
        </button>
        {saved && (
          <span className="text-[12px] font-medium text-positive">
            Estrategia guardada.
          </span>
        )}
        <span className="ml-auto text-[11px] text-ink-muted">
          Soporta títulos (#), listas (-) y **negritas** en el export.
        </span>
      </div>
    </section>
  );
}
