"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "@/modules/team/actions";

const initialState: AcceptInviteState = {};

export default function AcceptInviteForm({
  token,
  partnerDisplayName,
  needsDisplayName,
}: {
  token: string;
  partnerDisplayName: string;
  needsDisplayName: boolean;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, initialState);

  return (
    <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-card">
      <div className="mb-6 text-center">
        <h1 className="text-[16px] font-bold tracking-tight text-ink">
          Te invitaron al equipo de {partnerDisplayName}
        </h1>
        {!needsDisplayName && (
          <p className="mt-2 text-[12.5px] text-ink-secondary">
            Continúa para renovar tu acceso.
          </p>
        )}
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        {needsDisplayName && (
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary">
            Tu nombre
            <input
              name="displayName"
              required
              autoFocus
              placeholder="Cómo te llamas"
              className="rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60"
            />
          </label>
        )}

        {state.error && <p className="text-[12.5px] text-negative">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Entrando…" : needsDisplayName ? "Unirme al equipo" : "Continuar"}
        </button>
      </form>
    </div>
  );
}
