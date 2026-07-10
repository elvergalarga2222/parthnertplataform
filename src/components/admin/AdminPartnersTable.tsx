"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Snowflake, Sun } from "lucide-react";
import Modal from "@/components/system/Modal";
import {
  freezePartnerAction,
  unfreezePartnerAction,
} from "@/modules/admin/actions";
import type { AdminPartnerRow } from "@/modules/admin/service";
import { formatMoney } from "@/lib/format";

type Row = AdminPartnerRow & { isAdmin: boolean };

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

export default function AdminPartnersTable({ partners }: { partners: Row[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [freezing, setFreezing] = useState<Row | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const runAction = async (action: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  };

  const confirmFreeze = async () => {
    if (!freezing) return;
    const ok = await runAction(() => freezePartnerAction(freezing.id));
    if (ok) {
      setFreezing(null);
      setConfirmEmail("");
    }
  };

  const unfreeze = async (row: Row) => {
    if (!window.confirm(`¿Descongelar a ${row.email}? Podrá volver a entrar.`)) return;
    await runAction(() => unfreezePartnerAction(row.id));
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-edge bg-surface shadow-card">
      <table className="w-full min-w-[880px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-edge text-[11px] uppercase tracking-widest text-ink-muted">
            <th className="px-4 py-3 font-semibold">Partner</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Alta</th>
            <th className="px-4 py-3 font-semibold">Último login</th>
            <th className="px-4 py-3 font-semibold">Espacios</th>
            <th className="px-4 py-3 font-semibold">Deals</th>
            <th className="px-4 py-3 font-semibold">IA 30d</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {partners.map((row) => (
            <tr
              key={row.id}
              className="border-b border-edge/60 transition-colors last:border-0 hover:bg-surface-2/50"
            >
              <td className="px-4 py-3">
                <span className="font-semibold text-ink">
                  {row.displayName ?? row.email}
                </span>
                <span className="block text-[11.5px] text-ink-muted">{row.email}</span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    row.status === "active"
                      ? "bg-positive/15 text-positive"
                      : "bg-negative/15 text-negative"
                  }`}
                >
                  {row.status === "active" ? "Activo" : "Congelado"}
                </span>
              </td>
              <td className="px-4 py-3 text-ink-secondary">
                {new Date(row.createdAt).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-ink-secondary">{since(row.lastLoginAt)}</td>
              <td className="px-4 py-3 text-ink-secondary">{row.workspaces}</td>
              <td className="px-4 py-3 text-ink-secondary">{row.deals}</td>
              <td className="px-4 py-3 text-ink-secondary">
                {row.aiTokens30d.toLocaleString("es-ES")} tok ·{" "}
                {formatMoney(row.aiCostUsd30d, "USD")}
              </td>
              <td className="px-4 py-3">
                {row.isAdmin ? (
                  <span
                    title="Cuenta de operador (ADMIN_EMAILS) — no se puede congelar"
                    className="text-[11px] text-ink-muted"
                  >
                    operador
                  </span>
                ) : row.status === "active" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setFreezing(row)}
                    className="flex items-center gap-1.5 rounded-xl border border-negative/40 px-3 py-1.5 text-[12px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
                  >
                    <Snowflake size={13} /> Congelar
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => unfreeze(row)}
                    className="flex items-center gap-1.5 rounded-xl border border-positive/40 px-3 py-1.5 text-[12px] font-semibold text-positive transition-colors hover:bg-positive/10 disabled:opacity-50"
                  >
                    <Sun size={13} /> Descongelar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {freezing && (
        <Modal
          title="Congelar partner"
          onClose={() => {
            setFreezing(null);
            setConfirmEmail("");
          }}
        >
          <div className="flex flex-col gap-4">
            <p className="text-[13px] leading-relaxed text-ink-secondary">
              Se bloqueará el acceso de <strong className="text-ink">{freezing.email}</strong>{" "}
              al instante (sesiones revocadas). Sus datos se conservan íntegros y podrás
              descongelarlo cuando quieras.
            </p>
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
              Escribe el email del partner para confirmar
              <input
                autoFocus
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={freezing.email}
                className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-negative/60"
              />
            </label>
            <button
              type="button"
              disabled={busy || confirmEmail.trim().toLowerCase() !== freezing.email.toLowerCase()}
              onClick={confirmFreeze}
              className="ml-auto rounded-xl bg-negative px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-negative/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Congelar acceso
            </button>
          </div>
        </Modal>
      )}

      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-negative/40 bg-surface-3 px-4 py-2.5 text-[13px] font-medium text-negative shadow-card-hover"
        >
          {error}
        </div>
      )}
    </div>
  );
}
