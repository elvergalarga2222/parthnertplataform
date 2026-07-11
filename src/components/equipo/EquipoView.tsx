"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, UserPlus } from "lucide-react";
import type { TeamSnapshot } from "@/modules/team/types";
import type { ActionResult } from "@/modules/team/actions";
import MembersTable from "./MembersTable";
import MeetingsList from "./MeetingsList";
import InviteModal from "./InviteModal";
import MeetingFormModal from "./MeetingFormModal";
import type { MeetingView } from "@/modules/team/types";

export type RunAction = (action: () => Promise<ActionResult>) => Promise<boolean>;

export default function EquipoView({ snapshot }: { snapshot: TeamSnapshot }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [meetingModal, setMeetingModal] = useState<
    { mode: "create" } | { mode: "edit"; meeting: MeetingView } | null
  >(null);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const runAction: RunAction = async (action) => {
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

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto p-6 pt-4">
      <section className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-ink">Equipo</h1>
            <p className="text-[12.5px] text-ink-muted">
              Colaboradores invitados a tu cuenta — no pasan por Skool.
            </p>
          </div>
          {snapshot.isPartner && (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-glow transition-colors hover:bg-primary-strong"
            >
              <UserPlus size={14} /> Invitar colaborador
            </button>
          )}
        </header>
        <MembersTable
          collaborators={snapshot.collaborators}
          isPartner={snapshot.isPartner}
          busy={busy}
          runAction={runAction}
        />
      </section>

      <section className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-ink">Reuniones</h2>
            <p className="text-[12.5px] text-ink-muted">
              Próximas y pasadas — visibles para todo el equipo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMeetingModal({ mode: "create" })}
            className="flex items-center gap-1.5 rounded-xl border border-edge bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:border-primary/50 hover:text-primary-soft"
          >
            <CalendarPlus size={14} /> Nueva reunión
          </button>
        </header>
        <MeetingsList
          meetings={snapshot.meetings}
          onEdit={(meeting) => setMeetingModal({ mode: "edit", meeting })}
          runAction={runAction}
        />
      </section>

      {showInvite && (
        <InviteModal onClose={() => setShowInvite(false)} onDone={() => router.refresh()} />
      )}

      {meetingModal && (
        <MeetingFormModal
          mode={meetingModal.mode}
          meeting={meetingModal.mode === "edit" ? meetingModal.meeting : null}
          collaborators={snapshot.collaborators.filter((c) => c.status === "activo")}
          selfCollaboratorId={snapshot.selfCollaboratorId}
          runAction={runAction}
          onClose={() => setMeetingModal(null)}
        />
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
