"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Target } from "lucide-react";
import type { Kpi, DashboardTask } from "@/modules/dashboard/types";
import type { WeeklyRevenue } from "@/modules/finance/service";
import type { Currency, MonthlyGoalProgress } from "@/modules/finance/types";
import { formatMoney } from "@/lib/format";
import KpiCard from "./KpiCard";
import GoalRing from "./GoalRing";
import WeeklyIncomeChart from "./WeeklyIncomeChart";
import TaskList from "./TaskList";

function greeting(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `¡Buenos días, ${name}!`;
  if (h < 20) return `¡Buenas tardes, ${name}!`;
  return `¡Buenas noches, ${name}!`;
}

export default function ResumenClient({
  userName,
  kpis,
  goal,
  weekly,
  currency,
  tasks: initialTasks,
}: {
  userName: string;
  kpis: Kpi[];
  goal: MonthlyGoalProgress | null;
  weekly: WeeklyRevenue[];
  currency: Currency;
  tasks: DashboardTask[];
}) {
  // Las tareas siguen siendo demo hasta PR-9; el toggle es solo local.
  const [tasks, setTasks] = useState(initialTasks);
  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  return (
    <div className="grid grid-cols-1 gap-6 p-6 pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Center column: solo lo accionable — facturación y profit. */}
      <div className="flex min-w-0 flex-col gap-8">
        <section
          aria-label="Indicadores del mes"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {kpis.map((kpi, i) => (
            <div
              key={kpi.id}
              className="animate-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <KpiCard kpi={kpi} />
            </div>
          ))}
        </section>
      </div>

      {/* Right panel */}
      <aside className="flex min-w-0 flex-col gap-5">
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <header className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold tracking-tight">
              Meta del mes
            </h2>
          </header>
          <div className="mt-4 flex flex-col items-center text-center">
            {goal ? (
              <div className="animate-fade-up flex flex-col items-center">
                <GoalRing pct={goal.revenuePct} />
                <p className="mt-4 text-[15px] font-semibold">
                  {greeting(userName)}
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {formatMoney(goal.revenueActual, currency)} de{" "}
                  {formatMoney(goal.revenueGoal, currency)} facturados
                </p>
                {goal.profitGoal !== null && goal.profitPct !== null && (
                  <p className="mt-1 text-[12px] text-ink-muted">
                    Profit: {goal.profitPct}% del sueldo objetivo (
                    {formatMoney(goal.profitGoal, currency)})
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <Target size={32} className="text-ink-muted" />
                <p className="text-[12.5px] text-ink-muted">
                  Aún no defines tu meta de este mes.
                </p>
                <Link
                  href="/partner-business"
                  className="rounded-xl bg-primary-faint px-4 py-2 text-[12.5px] font-semibold text-primary-soft transition-colors hover:bg-primary/25"
                >
                  Define tu meta en Partner Business
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <h2 className="text-[13px] font-semibold text-ink-secondary">
            Ingresos Semanales (Mes Actual)
          </h2>
          <div className="mt-4 animate-fade-up">
            <WeeklyIncomeChart data={weekly} currency={currency} />
          </div>
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <header className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold tracking-tight">
              Lista de Tareas
            </h2>
            <button
              type="button"
              aria-label="Opciones de tareas"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              <MoreHorizontal size={18} />
            </button>
          </header>
          <div className="mt-4 animate-fade-up">
            <TaskList tasks={tasks} onToggle={toggleTask} />
          </div>
        </section>
      </aside>
    </div>
  );
}
