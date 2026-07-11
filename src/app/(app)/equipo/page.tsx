import { redirect } from "next/navigation";
import { getCurrentActor } from "@/modules/auth/service";
import { listMeetings, listTeam } from "@/modules/team/service";
import EquipoView from "@/components/equipo/EquipoView";

export const metadata = { title: "Equipo · Partner Manager" };

// Fuerza render dinámico: la vista depende de la sesión (cookie) y de datos
// por partner; nunca debe servirse una versión cacheada entre usuarios.
export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  // El layout (app) ya garantiza sesión (partner o colaborador activo).
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const [collaborators, meetings] = await Promise.all([
    listTeam(actor.partner.id),
    listMeetings(actor.partner.id),
  ]);

  return (
    <EquipoView
      snapshot={{
        collaborators,
        meetings,
        isPartner: actor.collaborator === null,
        selfCollaboratorId: actor.collaborator?.id ?? null,
      }}
    />
  );
}
