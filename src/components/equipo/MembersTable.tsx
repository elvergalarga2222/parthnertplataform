"use client";

import { useState } from "react";
import { Link2, Power, PowerOff } from "lucide-react";
import type { CollaboratorView } from "@/modules/team/types";
import {
  deactivateCollaboratorAction,
  reactivateCollaboratorAction,
  regenerateInviteAction,
  updateCollaboratorAction,
} from "@/modules/team/actions";
import type { RunAction } from "./EquipoView";

const STATUS_LABEL: Record<CollaboratorView["status"], string> = {
  invitado: "Invitado",
  activo: "Activo",
  desactivado: "Desactivado",
};

const STATUS_CLASS: Record<CollaboratorView["status"], string> = {
  invitado: "bg-amber-400/15 text-amber-300",
  activo: "bg-positive/15 text-positive",
  desactivado: "bg-negative/15 text-negative",
};

function since(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 30) return `hace ${days} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function MembersTable({
  collaborators,
  isPartner,
  busy,
  runAction,
}: {
  collaborators: CollaboratorView[];
  isPartner: boolean;
  busy: boolean;
  runAction: RunAction;
}) {
  const [linkFor, setLinkFor] = useState<string | null>(null);

  const copyLink = async (collaboratorId: string) => {
    const ok = await runAction(async () => {
      const result = await regenerateInviteAction(collaboratorId);
      if (result.ok && result.inviteUrl) {
        const url = `${window.location.origin}${result.inviteUrl}`;
        await navigator.clipboard.writeText(url);
        setLinkFor(collaboratorId);
        setTimeout(() => setLinkFor(null), 3000);
      }
      return result;
    });
    return ok;
  };

  if (collaborators.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface p-8 text-center text-[13px] text-ink-muted shadow-card">
        Todavía no invitaste a nadie a tu equipo.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-edge bg-surface shadow-card">
      <table className="w-full min-w-[820px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-edge text-[11px] uppercase tracking-widest text-ink-muted">
            <th className="px-4 py-3 font-semibold">Nombre</th>
            <th className="px-4 py-3 font-semibold">Cargo</th>
            <th className="px-4 py-3 font-semibold">Permiso</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Último acceso</th>
            {isPartner && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {collaborators.map((c) => (
            <tr
              key={c.id}
              className="border-b border-edge/60 transition-colors last:border-0 hover:bg-surface-2/50"
            >
              <td className="px-4 py-3">
                <span className="font-semibold text-ink">{c.displayName ?? c.email}</span>
                <span className="block text-[11.5px] text-ink-muted">{c.email}</span>
              </td>
              <td className="px-4 py-3 text-ink-secondary">
                {isPartner ? (
                  <input
                    defaultValue={c.roleTitle ?? ""}
                    placeholder="Cargo (opcional)"
                    disabled={busy}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value === (c.roleTitle ?? "")) return;
                      runAction(() =>
                        updateCollaboratorAction({
                          collaboratorId: c.id,
                          roleTitle: value || null,
                        }),
                      );
                    }}
                    className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[12.5px] text-ink-secondary outline-none transition-colors hover:border-edge focus:border-primary/60 focus:bg-surface-2"
                  />
                ) : (
                  (c.roleTitle ?? "—")
                )}
              </td>
              <td className="px-4 py-3">
                {isPartner ? (
                  <select
                    defaultValue={c.permission}
                    disabled={busy}
                    onChange={(e) =>
                      runAction(() =>
                        updateCollaboratorAction({
                          collaboratorId: c.id,
                          permission: e.target.value as "editor" | "lector",
                        }),
                      )
                    }
                    className="rounded-lg border border-edge bg-surface-2 px-2 py-1 text-[12px] text-ink outline-none focus:border-primary/60"
                  >
                    <option value="editor">Editor</option>
                    <option value="lector">Lector</option>
                  </select>
                ) : (
                  <span className="capitalize">{c.permission}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_CLASS[c.status]}`}
                >
                  {STATUS_LABEL[c.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-secondary">{since(c.lastLoginAt)}</td>
              {isPartner && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {c.status !== "desactivado" && (
                      <button
                        type="button"
                        disabled={busy}
                        title="Copiar link de invitación / acceso"
                        onClick={() => copyLink(c.id)}
                        className="flex items-center gap-1 rounded-lg border border-edge px-2 py-1.5 text-[11.5px] font-medium text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft disabled:opacity-50"
                      >
                        <Link2 size={12} />
                        {linkFor === c.id ? "¡Copiado!" : "Link"}
                      </button>
                    )}
                    {c.status === "desactivado" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => runAction(() => reactivateCollaboratorAction(c.id))}
                        className="flex items-center gap-1 rounded-lg border border-positive/40 px-2 py-1.5 text-[11.5px] font-semibold text-positive transition-colors hover:bg-positive/10 disabled:opacity-50"
                      >
                        <Power size={12} /> Reactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `¿Desactivar a ${c.displayName ?? c.email}? Perderá acceso al instante.`,
                            )
                          )
                            return;
                          runAction(() => deactivateCollaboratorAction(c.id));
                        }}
                        className="flex items-center gap-1 rounded-lg border border-negative/40 px-2 py-1.5 text-[11.5px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
                      >
                        <PowerOff size={12} /> Desactivar
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
