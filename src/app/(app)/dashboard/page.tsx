import { getCurrentPartner } from "@/modules/auth/service";
import { getDashboardKpis } from "@/modules/dashboard/kpis";
import { getTasks } from "@/modules/dashboard/data";
import {
  getMonthlyGoalProgress,
  getWeeklyRevenue,
  isCurrency,
} from "@/modules/finance/service";
import { currentMonthUtc } from "@/modules/finance/snapshot";
import type { Currency } from "@/modules/finance/types";
import ResumenClient from "@/components/dashboard/ResumenClient";

export const metadata = { title: "Resumen · Partner Manager" };

export default async function DashboardPage() {
  // El layout (app) ya garantiza que hay un partner activo; lo recuperamos para
  // el saludo del panel de estadística y para calcular los datos reales.
  const partner = await getCurrentPartner();
  const firstName =
    partner?.displayName?.split(" ")[0] ??
    partner?.email.split("@")[0] ??
    "Partner";

  const currency: Currency =
    partner && isCurrency(partner.defaultCurrency)
      ? partner.defaultCurrency
      : "USD";

  // Todo server-side y en paralelo — el dashboard ya no carga demos por efecto.
  // (La lista de tareas sigue siendo demo hasta PR-9; ver nota en el PR.)
  const [kpis, goal, weekly, tasks] = partner
    ? await Promise.all([
        getDashboardKpis(partner),
        getMonthlyGoalProgress(partner.id, currency, currentMonthUtc()),
        getWeeklyRevenue(partner.id, currency),
        getTasks(),
      ])
    : [[], null, [], []];

  return (
    <ResumenClient
      userName={firstName}
      kpis={kpis}
      goal={goal}
      weekly={weekly}
      currency={currency}
      tasks={tasks}
    />
  );
}
