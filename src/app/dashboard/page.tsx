import { getDb } from "@/db";
import { requirePartner } from "@/modules/auth/require-partner";
import { DashboardService } from "@/modules/dashboard/dashboard-service";
import { GoalRing } from "./goal-ring";
import { KpiCard } from "./kpi-card";
import { LogoutButton } from "./logout-button";
import { Opportunities } from "./opportunities";
import { Sidebar } from "./sidebar";
import { TaskList } from "./task-list";
import { WeeklyChart } from "./weekly-chart";

const euro = (n: number) => "€" + Math.round(n).toLocaleString("es-ES");

export default async function DashboardPage() {
  const partner = await requirePartner();
  const data = await new DashboardService(getDb()).getData(partner.id);
  const firstName = (partner.displayName ?? partner.email).split(/[ @]/)[0];

  return (
    <div className="flex min-h-screen bg-[#08080a] text-white">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
          <div className="relative flex-1 max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              ⌕
            </span>
            <input
              placeholder="Buscar clientes, oportunidades…"
              className="w-full rounded-xl border border-white/5 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-violet-500/40 focus:outline-none"
            />
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 text-zinc-400 transition hover:bg-white/5 hover:text-white">
            ✉
          </button>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 text-zinc-400 transition hover:bg-white/5 hover:text-white">
            ⃰
          </button>
          <div className="flex items-center gap-2 pl-1">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-semibold">
              {firstName.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden text-sm text-zinc-200 sm:block">
              {partner.displayName ?? partner.email}
            </span>
            <LogoutButton />
          </div>
        </header>

        {/* Contenido */}
        <main className="grid flex-1 grid-cols-1 gap-6 p-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
              <p className="text-sm text-zinc-500">
                {data.isDemo
                  ? "Datos de demostración — se poblará con tu operación real."
                  : "Tu operación comercial y financiera de un vistazo."}
              </p>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
              <KpiCard
                label="Facturación Total (Mes)"
                value={data.billing.value}
                momPct={data.billing.momPct}
                spark={data.billing.spark}
                variant="area"
              />
              <KpiCard
                label="Profit Neto del Mes"
                value={data.profit.value}
                momPct={data.profit.momPct}
                spark={data.profit.spark}
                variant="bars"
                footer={
                  <span className="text-zinc-500">
                    Ingresos − costos (incl. IA/operación)
                  </span>
                }
              />
              <KpiCard
                label="Pipeline Abierto"
                value={data.pipeline.value}
                momPct={data.pipeline.momPct}
                spark={data.pipeline.spark}
                variant="bars"
                footer={
                  <div className="space-y-0.5">
                    <p className="text-violet-300">
                      {data.pipeline.interestedCount} clientes interesados
                    </p>
                    {data.pipeline.byStage.map((s) => (
                      <p key={s.label} className="text-zinc-500">
                        {s.label}: {euro(s.amount)} ({s.count})
                      </p>
                    ))}
                  </div>
                }
              />
            </div>

            <Opportunities items={data.opportunities} />
          </div>

          {/* Panel derecho */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#141418] to-[#0d0d11] p-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Estadística</h2>
                <span className="text-zinc-600">⋯</span>
              </div>
              <GoalRing pct={data.goalPct} name={firstName} />
            </div>

            <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#141418] to-[#0d0d11] p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">
                Ingresos semanales (mes actual)
              </h2>
              <WeeklyChart data={data.weekly} />
            </div>

            <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#141418] to-[#0d0d11] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Lista de tareas
                </h2>
                <span className="text-zinc-600">⋯</span>
              </div>
              <TaskList tasks={data.tasks} />
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
