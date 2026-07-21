"use client";

import { useState } from "react";
import { Check, Copy, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import type { ClientViewShareState } from "@/modules/workspace/types";
import {
  rotateClientViewTokenAction,
  setClientViewEnabledAction,
} from "@/modules/workspace/actions";
import type { RunAction } from "./WorkspaceView";

/**
 * Gestión del enlace público (regla #7). El token en claro solo existe en el
 * valor devuelto por la action: no se guarda en BD ni viaja en el snapshot, así
 * que se muestra una vez y se pierde al recargar. Por eso la UI insiste en
 * copiarlo antes de salir.
 */
export default function ClientViewSharePanel({
  workspaceId,
  state,
  runAction,
}: {
  workspaceId: string;
  state: ClientViewShareState;
  runAction: RunAction;
}) {
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl = freshToken
    ? `${window.location.origin}/vista-cliente/${freshToken}`
    : null;

  const generate = async () => {
    // Rotar invalida el enlace anterior: el cliente que ya lo tenga verá un 404.
    if (
      state.hasToken &&
      !window.confirm(
        "Generar un enlace nuevo invalida el anterior de inmediato. " +
          "Quien ya lo tenga dejará de ver el tablero. ¿Continuar?",
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    const result = await rotateClientViewTokenAction(workspaceId);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFreshToken(result.token);
    setCopied(false);

    // Un enlace recién generado no sirve de nada apagado: se enciende solo la
    // primera vez, para no reactivar en silencio uno que el Partner apagó.
    if (!state.enabled && !state.hasToken) {
      await runAction(
        (d) => ({
          ...d,
          clientView: { ...d.clientView, enabled: true, hasToken: true },
        }),
        () => setClientViewEnabledAction({ workspaceId, enabled: true }),
      );
    }
  };

  const toggle = async (enabled: boolean) => {
    setError(null);
    await runAction(
      (d) => ({ ...d, clientView: { ...d.clientView, enabled } }),
      () => setClientViewEnabledAction({ workspaceId, enabled }),
    );
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  };

  return (
    <section className="rounded-2xl border border-edge bg-surface p-5">
      <header className="flex flex-wrap items-center gap-2">
        <Link2 size={15} className="text-ink-secondary" />
        <h2 className="text-[13.5px] font-bold text-ink">Vista de cliente</h2>
        {state.hasToken && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              state.enabled
                ? "bg-positive/15 text-positive"
                : "bg-surface-2 text-ink-muted"
            }`}
          >
            {state.enabled ? "Activo" : "Desactivado"}
          </span>
        )}
      </header>

      <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
        Enlace público de solo lectura. Muestra únicamente las tarjetas marcadas
        como «visible para el cliente» — ahora mismo{" "}
        <strong className="font-semibold text-ink">
          {state.visibleCardCount}
        </strong>
        . Nunca expone responsables, SOPs, la ficha ni las finanzas.
      </p>

      {!state.hasToken && !freshToken ? (
        <div className="mt-4 rounded-xl border border-dashed border-edge px-4 py-5 text-center">
          <p className="text-[12.5px] font-semibold text-ink">
            Todavía no hay enlace
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
            Genera un enlace para compartir el tablero con tu cliente.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {freshToken ? (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink">
                <TriangleAlert size={13} className="text-primary" />
                Copia el enlace ahora: no podrás volver a verlo
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-2 text-[11.5px] text-ink">
                  {shareUrl}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11.5px] font-semibold text-white transition-colors hover:bg-primary-soft"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              {!state.enabled && (
                <p className="mt-2 text-[11px] text-ink-secondary">
                  El enlace está desactivado: actívalo abajo para que tu cliente
                  pueda abrirlo.
                </p>
              )}
            </div>
          ) : (
            // Sin token en memoria no se puede reconstruir la URL (solo se
            // guarda su hash). Se muestra el estado, no un enlace falso.
            <p className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
              {state.enabled
                ? "Hay un enlace activo. Por seguridad no se puede volver a mostrar; si lo perdiste, genera uno nuevo."
                : "Hay un enlace generado pero está desactivado: quien lo abra verá un error. Actívalo o genera uno nuevo."}
            </p>
          )}

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={state.enabled}
              onChange={(e) => toggle(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-[12px] font-medium text-ink">
              Enlace activo
            </span>
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-edge px-3.5 py-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:border-primary/50 hover:text-primary-soft disabled:opacity-50"
        >
          <RefreshCw size={14} />
          {state.hasToken ? "Generar enlace nuevo" : "Generar enlace"}
        </button>
        {state.hasToken && (
          <span className="text-[11px] text-ink-muted">
            Invalida el enlace anterior
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 text-[12px] font-medium text-negative">{error}</p>
      )}
    </section>
  );
}
