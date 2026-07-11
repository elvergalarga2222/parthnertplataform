"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import Modal from "@/components/system/Modal";
import { inviteCollaboratorAction } from "@/modules/team/actions";

const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
const labelClass = "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";

export default function InviteModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [permission, setPermission] = useState<"editor" | "lector">("editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await inviteCollaboratorAction({
      email,
      roleTitle: roleTitle.trim() || null,
      permission,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInviteUrl(result.inviteUrl ?? null);
    onDone();
  };

  const copy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(`${window.location.origin}${inviteUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal title="Invitar colaborador" onClose={onClose}>
      {inviteUrl ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            Comparte este link con <strong className="text-ink">{email}</strong> (WhatsApp,
            Slack, correo — como prefieras). Expira en 7 días.
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-edge bg-surface-2 px-3 py-2.5">
            <code className="flex-1 truncate text-[12px] text-ink-secondary">
              {`${typeof window !== "undefined" ? window.location.origin : ""}${inviteUrl}`}
            </code>
            <button
              type="button"
              onClick={copy}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl border border-edge px-4 py-2 text-[13px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft"
          >
            Listo
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className={labelClass}>
            Email
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colaborador@ejemplo.com"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Cargo (opcional, solo visual)
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Head of Sales"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Permiso
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as "editor" | "lector")}
              className={inputClass}
            >
              <option value="editor">Editor — puede crear y editar</option>
              <option value="lector">Lector — solo lectura</option>
            </select>
          </label>

          {error && <p className="text-[12.5px] text-negative">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="ml-auto rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Generando…" : "Generar link de invitación"}
          </button>
        </form>
      )}
    </Modal>
  );
}
