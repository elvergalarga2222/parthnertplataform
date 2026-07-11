import { redirect } from "next/navigation";
import { logoutAction } from "@/modules/auth/actions";
import { getCurrentPartner, getMembershipAlert } from "@/modules/auth/service";
import { getTeam } from "@/modules/dashboard/data";
import { getInvoiceAlerts } from "@/modules/finance/service";
import { isTester } from "@/modules/feedback/service";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import MembershipAlertBanner from "@/components/dashboard/MembershipAlertBanner";

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

  const [team, alerts, membershipAlert] = await Promise.all([
    getTeam(),
    getInvoiceAlerts(partner.id),
    getMembershipAlert(partner.id),
  ]);
  const displayName = partner.displayName ?? partner.email;
  // Calculado server-side: para un partner normal, `false` es todo lo que se
  // serializa — el componente ni se evalúa (misma disciplina que isAdmin).
  const showFeedbackButton = isTester(partner);

  return (
    // Las variantes print: permiten que /espacios/[id]/exportar imprima el
    // documento sin el chrome de la app y sin recortes por los overflow.
    <div className="flex h-screen overflow-hidden bg-base text-ink print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="contents print:hidden">
        <Sidebar team={team} logoutAction={logoutAction} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col print:block">
        <div className="contents print:hidden">
          <Topbar displayName={displayName} alerts={alerts} />
          {membershipAlert && <MembershipAlertBanner alert={membershipAlert} />}
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto print:overflow-visible">
          {children}
        </main>
      </div>
      {showFeedbackButton && <FeedbackButton />}
    </div>
  );
}
