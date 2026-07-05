"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import type { AiPromptView } from "@/modules/ai/types";
import { generateAction } from "@/modules/ai/actions";

type Turn = { role: "user" | "assistant"; content: string };

// Multi-turn chat for the Diagnóstico sub-module. Sends the full conversation
// history each call so the model has context (server is stateless).
export default function AiDiagnosticoChat({
  workspaceId,
  prompts,
  onGenerated,
}: {
  workspaceId: string;
  prompts: AiPromptView[];
  onGenerated: () => void;
}) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const promptId = prompts[0]?.id ?? null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const nextHistory: Turn[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    setBusy(true);
    setError(null);

    const result = await generateAction({
      type: "diagnostico",
      promptId,
      workspaceId,
      messages: nextHistory,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages([
      ...nextHistory,
      { role: "assistant", content: result.data.outputText ?? "" },
    ]);
    onGenerated();
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-edge bg-surface">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-[13px] text-ink-muted">
            Inicia el diagnóstico: describe el negocio del cliente y sus
            síntomas. El copiloto hará preguntas y propondrá un diagnóstico.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-white"
                  : "border border-edge bg-surface-2 text-ink"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-edge bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-muted">
              <Loader2 size={14} className="animate-spin" /> Pensando…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-edge px-4 py-2 text-[12px] text-negative">
          {error}
        </p>
      )}

      <form onSubmit={send} className="flex items-center gap-2 border-t border-edge p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu mensaje…"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-primary/60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Enviar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-soft disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
