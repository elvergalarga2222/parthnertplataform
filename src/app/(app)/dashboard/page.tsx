import { getCurrentActor } from "@/modules/auth/service";
import { getDashboardKpis } from "@/modules/dashboard/kpis";
import {
  getMonthlyGoalProgress,
  getWeeklyRevenue,
  isCurrency,
} from "@/modules/finance/service";
import { currentMonthUtc } from "@/modules/finance/snapshot";
import type { Currency } from "@/modules/finance/types";
import { listTasks } from "@/modules/tasks/service";
import ResumenClient from "@/components/dashboard/ResumenClient";

export const metadata = { title: "Resumen · Partner Manager" };

export default async function DashboardPage() {
  // El layout (app) ya garantiza que hay un partner (o colaborador) activo.
  const actor = await getCurrentActor();
  const partner = actor?.partner ?? null;
  const firstName =
    (actor?.collaborator ? actor.collaborator.displayName : partner?.displayName)?.split(" ")[0] ??
    partner?.email.split("@")[0] ??
    "Partner";

  const currency: Currency =
    partner && isCurrency(partner.defaultCurrency)
      ? partner.defaultCurrency
      : "USD";

  // Todo server-side y en paralelo. "Mis tareas abiertas" es del ACTOR (el
  // colaborador logueado, o el partner si assigneeId=null); "tareas de
  // clientes" (PR-11 Fase B, absorbida por PR-9) son todas las abiertas
  // vinculadas a un deal/workspace, sin importar a quién estén asignadas.
  const [kpis, goal, weekly, myTasks, clientTasks] = partner
    ? await Promise.all([
        getDashboardKpis(partner),
        getMonthlyGoalProgress(partner.id, currency, currentMonthUtc()),
        getWeeklyRevenue(partner.id, currency),
        listTasks(partner.id, { assigneeId: actor!.collaborator?.id ?? null }),
        listTasks(partner.id, { status: "abiertas", linked: true }),
      ])
    : [[], null, [], [], []];

  return (
    <ResumenClient
      userName={firstName}
      kpis={kpis}
      goal={goal}
      weekly={weekly}
      currency={currency}
      tasks={myTasks.slice(0, 6)}
      clientTasks={clientTasks.slice(0, 8)}
    />
  );
}
