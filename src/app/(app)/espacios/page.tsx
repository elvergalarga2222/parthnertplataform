import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { getCurrentPartner } from "@/modules/auth/service";
import { getWorkspaces } from "@/modules/workspace/service";
import { formatMoney } from "@/modules/crm/helpers";
import WorkspaceStatusBadge from "@/components/workspace/WorkspaceStatusBadge";

export const metadata = { title: "Espacios de Trabajo · Partner Manager" };
export const dynamic = "force-dynamic";

export default async function EspaciosPage() {
  const partner = await getCurrentPartner();
  if (!partner) redirect("/login");

  const workspaces = await getWorkspaces(partner.id);

  return (
    <div className="p-6 pt-4">
      <header className="mb-5 flex items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">Espacios de Trabajo</h1>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
          {workspaces.length}
        </span>
      </header>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-edge bg-surface px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-faint text-primary-soft">
            <FolderKanban size={24} />
          </span>
          <p className="text-[15px] font-semibold">Aún no hay espacios</p>
          <p className="max-w-md text-[13px] leading-relaxed text-ink-secondary">
            Cuando muevas un deal a una etapa de <strong>cierre ganado</strong>{" "}
            en el módulo Clientes, su espacio de trabajo se crea aquí
            automáticamente con el kanban operativo y la ficha del cliente.
          </p>
          <Link
            href="/clientes"
            className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-primary-soft"
          >
            Ir a Clientes
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/espacios/${ws.id}`}
              className="group flex flex-col rounded-2xl border border-edge bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-semibold leading-snug">
                  {ws.clientName}
                </h2>
                <WorkspaceStatusBadge status={ws.status} />
              </div>
              {ws.dealValue !== null && (
                <p className="mt-1 text-[13px] font-bold text-primary-soft">
                  {formatMoney(ws.dealValue)}
                </p>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-edge pt-3 text-[11.5px] text-ink-muted">
                <FolderKanban size={12} />
                {ws.cardCount === 0
                  ? "Sin tareas todavía"
                  : `${ws.doneCount}/${ws.cardCount} tareas hechas`}
                <span className="ml-auto">
                  {new Date(ws.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
