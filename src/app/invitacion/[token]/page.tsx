import { getInviteByToken } from "@/modules/team/service";
import AcceptInviteForm from "@/components/equipo/AcceptInviteForm";

export const metadata = { title: "Invitación · Partner Manager" };

// Depende del token en la URL y del estado vivo del colaborador — nunca cachear.
export const dynamic = "force-dynamic";

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <div className="flex flex-1 items-center justify-center bg-base px-4">
        <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 text-center shadow-card">
          <h1 className="text-[16px] font-bold text-ink">Invitación no válida</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
            El link venció, ya se usó, o el acceso fue desactivado. Pide un link nuevo a quien
            te invitó.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-base px-4">
      <AcceptInviteForm
        token={token}
        partnerDisplayName={invite.partnerDisplayName}
        needsDisplayName={invite.needsDisplayName}
      />
    </div>
  );
}
