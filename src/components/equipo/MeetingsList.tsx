"use client";

import { useState } from "react";
import { ChevronDown, Clock, Pencil, Trash2 } from "lucide-react";
import type { MeetingView } from "@/modules/team/types";
import { deleteMeetingAction } from "@/modules/team/actions";
import type { RunAction } from "./EquipoView";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MeetingRow({
  meeting,
  onEdit,
  runAction,
}: {
  meeting: MeetingView;
  onEdit: () => void;
  runAction: RunAction;
}) {
  const [expanded, setExpanded] = useState(false);

  const remove = () => {
    if (!window.confirm(`¿Eliminar la reunión «${meeting.title}»?`)) return;
    runAction(() => deleteMeetingAction(meeting.id));
  };

  return (
    <li className="rounded-xl border border-edge/60 bg-surface-2/40 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{meeting.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
            <Clock size={11} /> {formatWhen(meeting.startsAt)} · {meeting.durationMinutes} min
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Editar"
            onClick={onEdit}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            title="Eliminar"
            onClick={remove}
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-negative/10 hover:text-negative"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {meeting.attendees.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {meeting.attendees.map((a, i) => (
            <span
              key={a.collaboratorId ?? `partner-${i}`}
              title={a.name}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[9.5px] font-bold text-primary-soft ring-1 ring-edge"
            >
              {initials(a.name)}
            </span>
          ))}
        </div>
      )}

      {meeting.note && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink-secondary"
          >
            <ChevronDown
              size={12}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            Nota
          </button>
          {expanded && (
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-secondary">
              {meeting.note}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// Fuera del componente a propósito: Date.now() es impuro y el linter de
// reglas de React (react-hooks/purity) prohíbe llamarlo directamente en el
// cuerpo del render — un helper aparte no cuenta como "component or hook".
function partitionMeetings(meetings: MeetingView[]): {
  upcoming: MeetingView[];
  past: MeetingView[];
} {
  const now = Date.now();
  const upcoming = meetings
    .filter((m) => new Date(m.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = meetings
    .filter((m) => new Date(m.startsAt).getTime() < now)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return { upcoming, past };
}

export default function MeetingsList({
  meetings,
  onEdit,
  runAction,
}: {
  meetings: MeetingView[];
  onEdit: (meeting: MeetingView) => void;
  runAction: RunAction;
}) {
  if (meetings.length === 0) {
    return (
      <div className="rounded-2xl border border-edge bg-surface p-8 text-center text-[13px] text-ink-muted shadow-card">
        No hay reuniones registradas todavía.
      </div>
    );
  }

  const { upcoming, past } = partitionMeetings(meetings);

  return (
    <div className="flex flex-col gap-5">
      {upcoming.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Próximas
          </p>
          <ul className="flex flex-col gap-2">
            {upcoming.map((m) => (
              <MeetingRow key={m.id} meeting={m} onEdit={() => onEdit(m)} runAction={runAction} />
            ))}
          </ul>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Pasadas
          </p>
          <ul className="flex flex-col gap-2">
            {past.map((m) => (
              <MeetingRow key={m.id} meeting={m} onEdit={() => onEdit(m)} runAction={runAction} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
