import { redirect } from "next/navigation";
import { logoutAction } from "@/modules/auth/actions";
import { getCurrentActor, getMembershipAlert } from "@/modules/auth/service";
import { getInvoiceAlerts } from "@/modules/finance/service";
import { isTester } from "@/modules/feedback/service";
import { listTeamForSidebar } from "@/modules/team/service";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import MembershipAlertBanner from "@/components/dashboard/MembershipAlertBanner";

// Gating server-side: toda ruta bajo (app) exige una sesión válida — del
// partner o de uno de sus colaboradores activos (PR-8) — y un partner activo.
// Al leer la cookie de sesión, Next renderiza estas rutas de forma dinámica,
// así que la verificación corre en cada request (revocación instantánea).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/login");
  }
  const { partner, collaborator } = actor;

  const [team, alerts, membershipAlert] = await Promise.all([
    listTeamForSidebar(partner.id),
    getInvoiceAlerts(partner.id),
    getMembershipAlert(partner.id),
  ]);
  const displayName = collaborator
    ? collaborator.displayName
    : (partner.displayName ?? partner.email);
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
          <Topbar
            displayName={displayName}
            alerts={alerts}
            collaboratorOfPartnerName={
              collaborator ? (partner.displayName ?? partner.email) : null
            }
          />
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
