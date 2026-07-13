import { redirect } from "next/navigation";
import { getCurrentActor } from "@/modules/auth/service";
import { listTasks } from "@/modules/tasks/service";
import { getCrmSnapshot } from "@/modules/crm/service";
import { getWorkspaces } from "@/modules/workspace/service";
import { listTeam } from "@/modules/team/service";
import TareasView from "@/components/tareas/TareasView";

export const metadata = { title: "Tareas · Partner Manager" };

// Fuerza render dinámico: depende de la sesión y de datos por partner.
export const dynamic = "force-dynamic";

export default async function TareasPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  const [tasks, crmSnapshot, workspaceList, team] = await Promise.all([
    listTasks(actor.partner.id, { status: "todas" }),
    getCrmSnapshot(actor.partner.id),
    getWorkspaces(actor.partner.id),
    listTeam(actor.partner.id),
  ]);

  return (
    <TareasView
      tasks={tasks}
      deals={crmSnapshot.deals.map((d) => ({ id: d.id, title: d.title }))}
      workspaces={workspaceList.map((w) => ({ id: w.id, clientName: w.clientName }))}
      collaborators={team.filter((c) => c.status === "activo")}
      selfCollaboratorId={actor.collaborator?.id ?? null}
    />
  );
}
