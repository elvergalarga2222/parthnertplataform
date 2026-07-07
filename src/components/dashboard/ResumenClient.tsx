"use client";

import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type {
  Kpi,
  Opportunity,
  QuarterGoal,
  DashboardTask,
  WeeklyIncome,
} from "@/modules/dashboard/types";
import {
  getOpportunities,
  getQuarterGoal,
  getTasks,
  getWeeklyIncome,
} from "@/modules/dashboard/data";
import KpiCard from "./KpiCard";
import OpportunityCarousel from "./OpportunityCarousel";
import GoalRing from "./GoalRing";
import WeeklyIncomeChart from "./WeeklyIncomeChart";
import TaskList from "./TaskList";

function greeting(name: string) {
  const h = new Date().getHours();
  if (h < 12) return `¡Buenos días, ${name}!`;
  if (h < 20) return `¡Buenas tardes, ${name}!`;
  return `¡Buenas noches, ${name}!`;
}

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-edge bg-surface ${className}`}
    />
  );
}

export default function ResumenClient({
  userName,
  kpis,
}: {
  userName: string;
  kpis: Kpi[];
}) {
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(
    null,
  );
  const [tasks, setTasks] = useState<DashboardTask[] | null>(null);
  const [weekly, setWeekly] = useState<WeeklyIncome[] | null>(null);
  const [goal, setGoal] = useState<QuarterGoal | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async <T,>(
      fetcher: () => Promise<T>,
      set: (v: T) => void,
    ) => {
      const value = await fetcher();
      if (!cancelled) set(value);
    };
    load(getOpportunities, setOpportunities);
    load(getTasks, setTasks);
    load(getWeeklyIncome, setWeekly);
    load(getQuarterGoal, setGoal);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTask = (id: string) =>
    setTasks(
      (prev) =>
        prev?.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) ?? prev,
    );

  return (
    <div className="grid grid-cols-1 gap-6 p-6 pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* Center column */}
      <div className="flex min-w-0 flex-col gap-8">
        <section
          aria-label="Indicadores del mes"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
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

        {opportunities ? (
          <div className="animate-fade-up">
            <OpportunityCarousel opportunities={opportunities} />
          </div>
        ) : (
          <Skeleton className="h-72" />
        )}
      </div>

      {/* Right panel */}
      <aside className="flex min-w-0 flex-col gap-5">
        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <header className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold tracking-tight">
              Estadística
            </h2>
            <button
              type="button"
              aria-label="Opciones de estadística"
              className="text-ink-muted transition-colors hover:text-ink"
            >
              <MoreHorizontal size={18} />
            </button>
          </header>
          <div className="mt-4 flex flex-col items-center text-center">
            {goal ? (
              <div className="animate-fade-up flex flex-col items-center">
                <GoalRing pct={goal.pct} />
                <p className="mt-4 text-[15px] font-semibold">
                  {greeting(userName)}
                </p>
                <p className="mt-1 text-[12px] text-ink-muted">{goal.label}</p>
              </div>
            ) : (
              <div className="h-52 w-full animate-pulse rounded-xl bg-surface-2" />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-edge bg-surface p-5 shadow-card">
          <h2 className="text-[13px] font-semibold text-ink-secondary">
            Ingresos Semanales (Mes Actual)
          </h2>
          <div className="mt-4">
            {weekly ? (
              <div className="animate-fade-up">
                <WeeklyIncomeChart data={weekly} />
              </div>
            ) : (
              <div className="h-32 w-full animate-pulse rounded-xl bg-surface-2" />
            )}
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
          <div className="mt-4">
            {tasks ? (
              <div className="animate-fade-up">
                <TaskList tasks={tasks} onToggle={toggleTask} />
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl bg-primary-faint py-2.5 text-[12.5px] font-semibold text-primary-soft transition-colors duration-150 hover:bg-primary/25"
                >
                  Ver todas las tareas
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-surface-2"
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
