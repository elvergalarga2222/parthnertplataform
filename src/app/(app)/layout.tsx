import { requirePartner } from "@/modules/auth/require-partner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

// Shell único de la aplicación: envuelve todos los módulos (dashboard, CRM,
// workspace, finanzas, IA, academia, flujos) con el sidebar y el topbar para
// que la navegación se sienta un solo producto. El route group (app) no altera
// las URLs.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await requirePartner();
  const label = partner.displayName ?? partner.email;

  return (
    <div className="flex min-h-screen bg-[#08080a] text-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar label={label} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
