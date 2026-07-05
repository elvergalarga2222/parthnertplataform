"use client";

import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import {
  getAiBootstrapAction,
  type AiBootstrap,
} from "@/modules/ai/actions";
import AiUsageBanner from "./AiUsageBanner";
import AiKeySetup from "./AiKeySetup";
import AiGeneratorTab from "./AiGeneratorTab";
import AiDiagnosticoChat from "./AiDiagnosticoChat";

type SubTab = "guiones" | "estrategia" | "diagnostico" | "imagenes";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "guiones", label: "Guiones" },
  { id: "estrategia", label: "Estrategia" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "imagenes", label: "Imágenes" },
];

// Lazily loads its own data (usage, key status, prompts) when the IA tab opens,
// so opening a workspace doesn't pay AI queries unless the tab is used.
export default function AiPanel({ workspaceId }: { workspaceId: string }) {
  const [boot, setBoot] = useState<AiBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<SubTab>("guiones");

  // Refresh callback for child components after a mutation.
  const load = useCallback(async () => {
    const result = await getAiBootstrapAction(workspaceId);
    if (result.ok) setBoot(result.data);
    else setError(result.error);
  }, [workspaceId]);

  // Initial fetch on mount, guarded against updates after unmount.
  useEffect(() => {
    let cancelled = false;
    getAiBootstrapAction(workspaceId).then((result) => {
      if (cancelled) return;
      if (result.ok) setBoot(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-negative/40 bg-surface p-6 text-[13px] text-negative">
        {error}
      </div>
    );
  }
  if (!boot) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-[13px] text-ink-muted">
        <Loader2 size={16} className="animate-spin" /> Cargando módulo de IA…
      </div>
    );
  }

  const needsKey = boot.requiresKey && !boot.keyStatus.hasKey;

  const subTabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-150 ${
      active
        ? "bg-primary-faint text-primary-soft"
        : "text-ink-secondary hover:bg-surface-2 hover:text-ink"
    }`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <AiUsageBanner usage={boot.usage} />

      {/* La configuración de key siempre visible en la parte superior */}
      <AiKeySetup status={boot.keyStatus} onChanged={load} />

      {needsKey ? (
        <div className="rounded-2xl border border-edge bg-surface p-6 text-center text-[13px] text-ink-secondary">
          Configura tu API key arriba para empezar a generar contenido con IA.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 rounded-xl border border-edge bg-surface p-1">
            {SUBTABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={subTabClass(sub === t.id)}
                onClick={() => setSub(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1">
            {sub === "guiones" && (
              <AiGeneratorTab
                type="guion"
                workspaceId={workspaceId}
                prompts={boot.promptsByType.guion}
                recent={boot.recentByType.guion}
                placeholder="Describe el producto/servicio y el ángulo. La IA generará el guion."
                onGenerated={load}
              />
            )}
            {sub === "estrategia" && (
              <AiGeneratorTab
                type="estrategia"
                workspaceId={workspaceId}
                prompts={boot.promptsByType.estrategia}
                recent={boot.recentByType.estrategia}
                placeholder="Describe el objetivo de negocio y el contexto del cliente."
                onGenerated={load}
              />
            )}
            {sub === "diagnostico" && (
              <div className="h-[28rem]">
                <AiDiagnosticoChat
                  workspaceId={workspaceId}
                  prompts={boot.promptsByType.diagnostico}
                  onGenerated={load}
                />
              </div>
            )}
            {sub === "imagenes" && (
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-edge bg-surface p-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-faint text-primary-soft">
                  <ImageIcon size={24} />
                </span>
                <p className="text-[15px] font-semibold">Imágenes con IA</p>
                <p className="max-w-md text-[13px] leading-relaxed text-ink-secondary">
                  La generación de imágenes es de menor prioridad y llega en una
                  fase posterior.
                </p>
                <span className="rounded-full border border-edge bg-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
                  Próximamente
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
