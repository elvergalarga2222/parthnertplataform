import { getCurrentPartner } from "@/modules/auth/service";
import ResumenClient from "@/components/dashboard/ResumenClient";

export const metadata = { title: "Resumen · Partner Manager" };

export default async function DashboardPage() {
  // El layout (app) ya garantiza que hay un partner activo; lo recuperamos para
  // el saludo del panel de estadística.
  const partner = await getCurrentPartner();
  const firstName =
    partner?.displayName?.split(" ")[0] ??
    partner?.email.split("@")[0] ??
    "Partner";

  return <ResumenClient userName={firstName} />;
}
