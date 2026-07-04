import { getDb } from "@/db";
import { requirePartner } from "@/modules/auth/require-partner";
import { DashboardService } from "@/modules/dashboard/dashboard-service";
import { GoalRing } from "./goal-ring";
import { KpiCard } from "./kpi-card";
import { Opportunities } from "./opportunities";
import { TaskList } from "./task-list";
import { WeeklyChart } from "./weekly-chart";

const euro = (n: number) => "€" + Math.round(n).toLocaleString("es-ES");

export default async function DashboardPage() {
  const partner = await requirePartner();
  const data = await new DashboardService(getDb()).getData(partner.id);
  const firstName = (partner.displayName ?? partner.email).split(/[ @]/)[0];

  return (
    <main className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-zinc-500">
            {data.isDemo
              ? "Datos de demostración — se poblará con tu operación real."
              : "Tu operación comercial y financiera de un vistazo."}
          </p>
        </div>

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
            <h2 className="text-sm font-semibold text-white">Lista de tareas</h2>
            <span className="text-zinc-600">⋯</span>
          </div>
          <TaskList tasks={data.tasks} />
        </div>
      </aside>
    </main>
  );
}
