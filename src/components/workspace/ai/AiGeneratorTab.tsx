"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type {
  AiGenerationView,
  AiPromptView,
  AiType,
} from "@/modules/ai/types";
import { generateAction } from "@/modules/ai/actions";

// Single-shot generator used by Guiones and Estrategia: pick a prompt template,
// write the input, generate, see the result. Not multi-turn (that's Diagnóstico).
export default function AiGeneratorTab({
  type,
  workspaceId,
  prompts,
  recent,
  placeholder,
  onGenerated,
}: {
  type: AiType;
  workspaceId: string;
  prompts: AiPromptView[];
  recent: AiGenerationView[];
  placeholder: string;
  onGenerated: () => void;
}) {
  const [promptId, setPromptId] = useState(prompts[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(
    recent[0]?.outputText ?? null,
  );

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await generateAction({
      type,
      promptId: promptId || null,
      workspaceId,
      messages: [{ role: "user", content: input }],
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOutput(result.data.outputText);
    onGenerated();
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <form onSubmit={run} className="flex flex-col gap-3">
        {prompts.length > 0 && (
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
            Plantilla
            <select
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
              className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none focus:border-primary/60"
            >
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isGlobal ? "" : " (tuya)"}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-1 flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          Entrada
          <textarea
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            placeholder={placeholder}
            className="min-h-40 flex-1 rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none focus:border-primary/60"
          />
        </label>
        {error && (
          <p className="rounded-lg border border-negative/40 bg-negative/10 px-3 py-2 text-[12px] text-negative">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-soft disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? "Generando…" : "Generar"}
        </button>
      </form>

      <div className="rounded-2xl border border-edge bg-surface-2 p-4">
        <h4 className="text-[12px] font-semibold uppercase tracking-widest text-ink-muted">
          Resultado
        </h4>
        {output ? (
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {output}
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-ink-muted">
            El contenido generado aparecerá aquí.
          </p>
        )}
      </div>
    </div>
  );
}
