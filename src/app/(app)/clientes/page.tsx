import { redirect } from "next/navigation";
import { getCurrentPartner } from "@/modules/auth/service";
import { ensureDefaultStages, getCrmSnapshot } from "@/modules/crm/service";
import ClientesView from "@/components/clientes/ClientesView";

export const metadata = { title: "Clientes · Partner Manager" };

// Fuerza render dinámico: la vista depende de la sesión (cookie) y de datos por
// partner; nunca debe servirse una versión cacheada estáticamente entre
// requests o usuarios.
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  // El layout (app) ya garantiza sesión. Si aun así el partner no llega,
  // redirigimos a /login en vez de devolver null en silencio (que dejaba el
  // <main> completamente vacío sin ninguna pista del problema).
  const partner = await getCurrentPartner();
  if (!partner) redirect("/login");

  await ensureDefaultStages(partner.id);
  const snapshot = await getCrmSnapshot(partner.id);

  return <ClientesView snapshot={snapshot} />;
}
