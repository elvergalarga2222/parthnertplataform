"use client";

import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import Modal from "@/components/system/Modal";
import { createFeedbackAction } from "@/modules/feedback/actions";

type FeedbackType = "bug" | "sugerencia";

export default function FeedbackModal({
  route,
  onClose,
}: {
  route: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<FeedbackType>("bug");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createFeedbackAction({ type, description, route });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
    setTimeout(onClose, 1400);
  };

  const chipClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors ${
      active
        ? "border-primary/60 bg-primary-faint text-primary-soft"
        : "border-edge bg-surface-2 text-ink-secondary hover:border-primary/40"
    }`;

  if (sent) {
    return (
      <Modal title="¡Gracias!" onClose={onClose}>
        <p className="py-4 text-center text-[14px] font-medium text-positive">
          ¡Gracias! Quedó registrado.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title="Reportar bug o sugerencia" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("bug")}
            className={chipClass(type === "bug")}
          >
            <Bug size={14} /> Bug
          </button>
          <button
            type="button"
            onClick={() => setType("sugerencia")}
            className={chipClass(type === "sugerencia")}
          >
            <Lightbulb size={14} /> Sugerencia
          </button>
        </div>

        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          Descripción
          <textarea
            autoFocus
            required
            minLength={10}
            maxLength={4000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿Qué pasó? ¿Qué esperabas que pasara?"
            className="resize-y rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
          Estás reportando sobre
          <input
            readOnly
            value={route}
            className="rounded-xl border border-edge bg-surface-3 px-3 py-2.5 font-mono text-[12.5px] text-ink-muted"
          />
        </label>

        {error && (
          <p className="text-[12.5px] font-medium text-negative">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || description.trim().length < 10}
          className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </Modal>
  );
}
