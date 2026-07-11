"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/system/Modal";
import type { CollaboratorView, MeetingView } from "@/modules/team/types";
import {
  createMeetingAction,
  deleteMeetingAction,
  updateMeetingAction,
} from "@/modules/team/actions";
import type { RunAction } from "./EquipoView";

const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
const labelClass = "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";

/** Formatea un Date a "YYYY-MM-DDTHH:mm" en hora LOCAL — formato nativo de datetime-local. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingFormModal({
  mode,
  meeting,
  collaborators,
  selfCollaboratorId,
  runAction,
  onClose,
}: {
  mode: "create" | "edit";
  meeting: MeetingView | null;
  collaborators: CollaboratorView[];
  selfCollaboratorId: string | null;
  runAction: RunAction;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [startsAt, setStartsAt] = useState(
    meeting ? toLocalInputValue(new Date(meeting.startsAt)) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(meeting?.durationMinutes ?? 30);
  const [note, setNote] = useState(meeting?.note ?? "");
  const [attendees, setAttendees] = useState<(string | null)[]>(() => {
    if (meeting) return meeting.attendees.map((a) => a.collaboratorId);
    // Por defecto, quien crea la reunión ya asiste (el partner, o el colaborador actual).
    return [selfCollaboratorId];
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const min = toLocalInputValue(new Date(now.getTime() - 365 * 86_400_000));
  const max = toLocalInputValue(new Date(now.getTime() + 2 * 365 * 86_400_000));

  const toggleAttendee = (id: string | null) => {
    setAttendees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startsAt) {
      setError("Elige fecha y hora.");
      return;
    }
    const parsed = new Date(startsAt);
    if (Number.isNaN(parsed.getTime())) {
      setError("Fecha inválida.");
      return;
    }
    setError(null);
    setBusy(true);

    const payload = {
      title,
      startsAt: parsed.toISOString(),
      durationMinutes,
      note: note.trim() || null,
      attendeeCollaboratorIds: attendees,
    };

    const ok = await runAction(() =>
      mode === "create"
        ? createMeetingAction(payload)
        : updateMeetingAction({ meetingId: meeting!.id, ...payload }),
    );
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!meeting) return;
    if (!window.confirm(`¿Eliminar la reunión «${meeting.title}»?`)) return;
    setBusy(true);
    const ok = await runAction(() => deleteMeetingAction(meeting.id));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title={mode === "create" ? "Nueva reunión" : "Editar reunión"} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={labelClass}>
          Título
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kickoff con el equipo"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Fecha y hora
            <input
              type="datetime-local"
              required
              min={min}
              max={max}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Duración (min)
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-ink-secondary">Asistentes</span>
          <div className="flex flex-wrap gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink-secondary">
              <input
                type="checkbox"
                checked={attendees.includes(null)}
                onChange={() => toggleAttendee(null)}
              />
              Yo
            </label>
            {collaborators.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink-secondary"
              >
                <input
                  type="checkbox"
                  checked={attendees.includes(c.id)}
                  onChange={() => toggleAttendee(c.id)}
                />
                {c.displayName ?? c.email}
              </label>
            ))}
          </div>
        </div>

        <label className={labelClass}>
          Nota (opcional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </label>

        {error && <p className="text-[12.5px] text-negative">{error}</p>}

        <div className="flex items-center justify-between">
          {mode === "edit" ? (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="flex items-center gap-1.5 rounded-xl border border-negative/40 px-3.5 py-2 text-[12.5px] font-semibold text-negative transition-colors hover:bg-negative/10 disabled:opacity-50"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Guardando…" : mode === "create" ? "Crear reunión" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
