"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, RefreshCw, Trash2 } from "lucide-react";
import { clearErrorLogsAction } from "@/modules/admin/actions";
import type { ErrorLogEntry } from "@/modules/admin/service";

interface GroupedEntry {
  entry: ErrorLogEntry;
  count: number;
}

/** Colapsa runs consecutivos del mismo digest (el caso real de /clientes:
 * un mismo deal envenenado repitiendo el mismo error en cada request). */
function groupConsecutive(entries: ErrorLogEntry[]): GroupedEntry[] {
  const groups: GroupedEntry[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last && entry.digest && last.entry.digest === entry.digest) {
      last.count++;
    } else {
      groups.push({ entry, count: 1 });
    }
  }
  return groups;
}

function since(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "hace segundos";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function absoluteTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DigestChip({ digest }: { digest: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(digest).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copiar digest — para cruzar con pm2 logs / docker logs"
      className="flex items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-secondary transition-colors hover:text-primary-soft"
    >
      {digest} <Copy size={10} />
      {copied && <span className="text-positive">✓</span>}
    </button>
  );
}

export default function AdminLogsView({
  entries,
  partnerEmails,
}: {
  entries: ErrorLogEntry[];
  partnerEmails: Record<string, string>;
}) {
  const router = useRouter();
  const [route, setRoute] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [digest, setDigest] = useState("");
  const [clientOnly, setClientOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partnerIdsPresent = useMemo(
    () => Array.from(new Set(entries.map((e) => e.partnerId).filter((id): id is string => Boolean(id)))),
    [entries],
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (route.trim() && !(e.route ?? "").toLowerCase().includes(route.trim().toLowerCase())) {
        return false;
      }
      if (partnerId && e.partnerId !== partnerId) return false;
      if (digest.trim() && !(e.digest ?? "").toLowerCase().includes(digest.trim().toLowerCase())) {
        return false;
      }
      if (clientOnly && e.source !== "client") return false;
      return true;
    });
  }, [entries, route, partnerId, digest, clientOnly]);

  const groups = useMemo(() => groupConsecutive(filtered), [filtered]);

  const vaciar = async () => {
    if (!window.confirm("¿Vaciar el buffer de logs? No se puede deshacer.")) return;
    setBusy(true);
    const result = await clearErrorLogsAction();
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={route}
          onChange={(e) => setRoute(e.target.value)}
          placeholder="Filtrar por ruta…"
          className="rounded-xl border border-edge bg-surface px-3 py-2 text-[12.5px] text-ink outline-none transition-colors focus:border-primary/60"
        />
        <select
          value={partnerId}
          onChange={(e) => setPartnerId(e.target.value)}
          className="rounded-xl border border-edge bg-surface px-3 py-2 text-[12.5px] text-ink-secondary outline-none transition-colors focus:border-primary/60"
        >
          <option value="">Todos los partners</option>
          {partnerIdsPresent.map((id) => (
            <option key={id} value={id}>
              {partnerEmails[id] ?? id}
            </option>
          ))}
        </select>
        <input
          value={digest}
          onChange={(e) => setDigest(e.target.value)}
          placeholder="Digest…"
          className="rounded-xl border border-edge bg-surface px-3 py-2 font-mono text-[12px] text-ink outline-none transition-colors focus:border-primary/60"
        />
        <label className="flex items-center gap-1.5 text-[12px] font-medium text-ink-secondary">
          <input
            type="checkbox"
            checked={clientOnly}
            onChange={(e) => setClientOnly(e.target.checked)}
            className="accent-[#8b7cf6]"
          />
          Solo errores de cliente
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3 py-2 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft"
          >
            <RefreshCw size={13} /> Actualizar
          </button>
          <button
            type="button"
            disabled={busy || entries.length === 0}
            onClick={vaciar}
            className="flex items-center gap-1.5 rounded-xl border border-negative/40 px-3 py-2 text-[12px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
          >
            <Trash2 size={13} /> Vaciar buffer
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-negative/40 bg-negative/10 px-3 py-2 text-[12px] text-negative">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-strong px-4 py-10 text-center text-[13px] text-ink-muted">
          Sin errores en el buffer 🎉 (esto no cubre lo anterior al deploy de este
          visor ni lo que exceda las últimas 500 entradas)
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-strong px-4 py-10 text-center text-[13px] text-ink-muted">
          Ningún error coincide con los filtros.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-edge rounded-2xl border border-edge bg-surface shadow-card">
          {groups.map(({ entry, count }, i) => {
            const isOpen = expanded.has(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11.5px] text-ink-muted" title={absoluteTime(entry.time)}>
                      {since(entry.time)}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-ink">
                      {entry.msg}
                    </span>
                    {count > 1 && (
                      <span className="rounded-full bg-negative/15 px-2 py-0.5 text-[10.5px] font-bold text-negative">
                        ×{count}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      className={`ml-auto shrink-0 text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.route && (
                      <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] text-ink-secondary">
                        {entry.route}
                      </span>
                    )}
                    {entry.partnerId && (
                      <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10.5px] text-ink-secondary">
                        {partnerEmails[entry.partnerId] ?? entry.partnerId}
                      </span>
                    )}
                    {entry.source && (
                      <span className="rounded-md bg-primary-faint px-1.5 py-0.5 text-[10.5px] font-semibold text-primary-soft">
                        {entry.source}
                      </span>
                    )}
                    {entry.digest && <DigestChip digest={entry.digest} />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-edge bg-surface-2/50 px-4 py-3">
                    {(entry.errName || entry.errMessage) && (
                      <p className="text-[12.5px] font-semibold text-negative">
                        {entry.errName ?? "Error"}
                        {entry.errMessage ? `: ${entry.errMessage}` : ""}
                      </p>
                    )}
                    {entry.errStack && (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-base p-3 text-[11px] leading-relaxed text-ink-secondary">
                        {entry.errStack}
                      </pre>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-ink-muted">
                        Ver JSON original
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-base p-3 text-[10.5px] text-ink-muted">
                        {entry.raw}
                      </pre>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
