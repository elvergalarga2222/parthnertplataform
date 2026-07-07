import { getCurrentPartner } from "@/modules/auth/service";
import { getDashboardKpis } from "@/modules/dashboard/kpis";
import ResumenClient from "@/components/dashboard/ResumenClient";

export const metadata = { title: "Resumen · Partner Manager" };

export default async function DashboardPage() {
  // El layout (app) ya garantiza que hay un partner activo; lo recuperamos para
  // el saludo del panel de estadística y para calcular los KPIs reales.
  const partner = await getCurrentPartner();
  const firstName =
    partner?.displayName?.split(" ")[0] ??
    partner?.email.split("@")[0] ??
    "Partner";

  // KPIs reales (Facturación/Profit/Pipeline) calculados en el servidor desde las
  // vistas de finanzas + el CRM, acotados al partner actual y a su moneda.
  const kpis = partner ? await getDashboardKpis(partner) : [];

  return <ResumenClient userName={firstName} kpis={kpis} />;
}
