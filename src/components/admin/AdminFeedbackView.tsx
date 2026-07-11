"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bug, ExternalLink, Lightbulb } from "lucide-react";
import { setFeedbackStatusAction } from "@/modules/admin/actions";
import type { FeedbackReportRow } from "@/modules/admin/service";
import type { FeedbackStatus, FeedbackType } from "@/modules/feedback/service";

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  nuevo: "Nuevo",
  revisado: "Revisado",
  resuelto: "Resuelto",
};
const STATUS_OPTIONS: FeedbackStatus[] = ["nuevo", "revisado", "resuelto"];
const TYPE_OPTIONS: (FeedbackType | "todas")[] = ["todas", "bug", "sugerencia"];

function since(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReportRow({ report }: { report: FeedbackReportRow }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const Icon = report.type === "bug" ? Bug : Lightbulb;

  const changeStatus = async (status: FeedbackStatus) => {
    setBusy(true);
    await setFeedbackStatusAction({ reportId: report.id, status });
    setBusy(false);
    router.refresh();
  };

  const long = report.description.length > 140;

  return (
    <tr className="border-b border-edge/60 align-top transition-colors last:border-0 hover:bg-surface-2/50">
      <td className="px-4 py-3 text-ink-secondary">{since(report.createdAt)}</td>
      <td className="px-4 py-3">
        <span className="text-ink">{report.partnerEmail}</span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
            report.type === "bug"
              ? "bg-negative/15 text-negative"
              : "bg-amber-400/15 text-amber-300"
          }`}
        >
          <Icon size={11} /> {report.type === "bug" ? "Bug" : "Sugerencia"}
        </span>
      </td>
      <td className="px-4 py-3">
        <a
          href={report.route}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 font-mono text-[11.5px] text-primary-soft hover:underline"
        >
          {report.route} <ExternalLink size={11} />
        </a>
      </td>
      <td className="max-w-xs px-4 py-3 text-ink-secondary">
        <p className={expanded ? "whitespace-pre-wrap" : "truncate"}>
          {expanded || !long ? report.description : `${report.description.slice(0, 140)}…`}
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-[11px] font-semibold text-primary-soft hover:underline"
          >
            {expanded ? "Ver menos" : "Ver más"}
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          value={report.status}
          disabled={busy}
          onChange={(e) => changeStatus(e.target.value as FeedbackStatus)}
          className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 text-[12px] text-ink-secondary outline-none transition-colors focus:border-primary/60 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

export default function AdminFeedbackView({
  reports,
}: {
  reports: FeedbackReportRow[];
}) {
  const [status, setStatus] = useState<FeedbackStatus | "todas">("nuevo");
  const [type, setType] = useState<FeedbackType | "todas">("todas");

  const filtered = useMemo(
    () =>
      reports.filter(
        (r) =>
          (status === "todas" || r.status === status) &&
          (type === "todas" || r.type === type),
      ),
    [reports, status, type],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FeedbackStatus | "todas")}
          className="rounded-xl border border-edge bg-surface px-3 py-2 text-[12.5px] text-ink-secondary outline-none transition-colors focus:border-primary/60"
        >
          <option value="todas">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType | "todas")}
          className="rounded-xl border border-edge bg-surface px-3 py-2 text-[12.5px] text-ink-secondary outline-none transition-colors focus:border-primary/60"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === "todas" ? "Todos los tipos" : t === "bug" ? "Bug" : "Sugerencia"}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-strong px-4 py-10 text-center text-[13px] text-ink-muted">
          Sin reportes {status !== "todas" ? `con estado "${STATUS_LABELS[status]}"` : ""}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-edge bg-surface shadow-card">
          <table className="w-full min-w-[900px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-edge text-[11px] uppercase tracking-widest text-ink-muted">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Partner</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Ruta</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <ReportRow key={r.id} report={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
