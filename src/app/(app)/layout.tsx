import { redirect } from "next/navigation";
import { logoutAction } from "@/modules/auth/actions";
import { getCurrentPartner } from "@/modules/auth/service";
import { getTeam } from "@/modules/dashboard/data";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

// Gating server-side: toda ruta bajo (app) exige una sesión válida y un partner
// activo. Al leer la cookie de sesión, Next renderiza estas rutas de forma
// dinámica, así que la verificación corre en cada request (revocación instantánea).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getCurrentPartner();
  if (!partner) {
    redirect("/login");
  }

  const team = await getTeam();
  const displayName = partner.displayName ?? partner.email;

  return (
    <div className="flex h-screen overflow-hidden bg-base text-ink">
      <Sidebar team={team} logoutAction={logoutAction} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar displayName={displayName} />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
