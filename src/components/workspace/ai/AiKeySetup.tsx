"use client";

import { useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import type { AiKeyStatus } from "@/modules/ai/types";
import { deleteKeyAction, setKeyAction } from "@/modules/ai/actions";

// BYOK: el partner pega su propia API key (regla #6). La key se cifra en el
// servidor; aquí solo se muestra el hint (últimos 4 caracteres).
export default function AiKeySetup({
  status,
  onChanged,
}: {
  status: AiKeyStatus;
  onChanged: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await setKeyAction({ apiKey: value });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setValue("");
    onChanged();
  };

  const remove = async () => {
    if (!window.confirm("¿Eliminar tu API key de IA?")) return;
    setBusy(true);
    await deleteKeyAction();
    setBusy(false);
    onChanged();
  };

  return (
    <div className="rounded-2xl border border-edge bg-surface p-5">
      <header className="flex items-center gap-2">
        <KeyRound size={16} className="text-primary-soft" />
        <h3 className="text-[14px] font-bold">Tu API key de Anthropic (BYOK)</h3>
      </header>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-secondary">
        La plataforma nunca paga los tokens de IA: usa tu propia API key. Se
        guarda cifrada y solo tú la usas.
      </p>

      {status.hasKey ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-edge bg-surface-2 px-3.5 py-2.5">
          <span className="text-[13px] font-medium">
            Key configurada ·{" "}
            <span className="font-mono text-ink-secondary">
              ****{status.keyHint}
            </span>
          </span>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-negative/10 hover:text-negative"
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-4 flex flex-col gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
          />
          {error && <p className="text-[12px] text-negative">{error}</p>}
          <button
            type="submit"
            disabled={busy || value.length < 20}
            className="w-fit rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-soft disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar API key"}
          </button>
        </form>
      )}
    </div>
  );
}
