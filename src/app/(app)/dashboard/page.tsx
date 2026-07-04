import { getCurrentPartner } from "@/modules/auth/service";

export default async function DashboardPage() {
  // El layout (app) ya garantiza que hay un partner activo; lo recuperamos para
  // saludar. En fases siguientes aquí vivirán CRM, workspace, finanzas, etc.
  const partner = await getCurrentPartner();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Bienvenido, {partner?.displayName ?? partner?.email}
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Tu acceso está activo. Los módulos de la plataforma se irán habilitando
        por fases.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          { name: "CRM (SOBA/NOVA)", phase: "Fase 2" },
          { name: "Workspace y Kanban", phase: "Fase 3" },
          { name: "Finanzas 70/30", phase: "Fase 4" },
          { name: "Copiloto de IA", phase: "Fase 5" },
        ].map((mod) => (
          <div
            key={mod.name}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="font-medium text-black dark:text-zinc-50">
              {mod.name}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
              Próximamente · {mod.phase}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
