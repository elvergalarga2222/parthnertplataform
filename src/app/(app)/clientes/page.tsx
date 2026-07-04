import { getCurrentPartner } from "@/modules/auth/service";
import { ensureDefaultStages, getCrmSnapshot } from "@/modules/crm/service";
import ClientesView from "@/components/clientes/ClientesView";

export const metadata = { title: "Clientes · Partner Manager" };

export default async function ClientesPage() {
  // El layout (app) ya garantiza sesión; el partner llega no-nulo.
  const partner = await getCurrentPartner();
  if (!partner) return null;

  await ensureDefaultStages(partner.id);
  const snapshot = await getCrmSnapshot(partner.id);

  return <ClientesView snapshot={snapshot} />;
}
