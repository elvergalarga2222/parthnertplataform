import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import {
  expenses,
  kanbanTasks,
  leads,
  receivables,
  revenueEntries,
  workspaces,
} from "@/db/schema";

// Agregados para la pantalla de Resumen. Toma cifras reales de finanzas y CRM;
// si el Partner aún no tiene datos, devuelve una demo coherente para que el
// dashboard no se vea vacío en el primer login (flag isDemo = true).

export interface Kpi {
  value: number;
  momPct: number | null; // variación vs. mes anterior (%)
  spark: number[]; // serie para el mini-gráfico
}

export interface Opportunity {
  id: string;
  businessName: string;
  amount: number;
  stage: string;
  owner: string;
}

export interface WeeklyIncome {
  label: string;
  amount: number;
}

export interface DashboardTask {
  id: string;
  title: string;
  subtitle: string;
  done: boolean;
}

export interface DashboardData {
  isDemo: boolean;
  billing: Kpi;
  profit: Kpi;
  pipeline: Kpi & { interestedCount: number; byStage: { label: string; amount: number; count: number }[] };
  goalPct: number;
  weekly: WeeklyIncome[];
  opportunities: Opportunity[];
  tasks: DashboardTask[];
}

const OPEN_STAGES = ["prospecto", "calificado", "propuesta", "negociacion"];
const STAGE_LABELS: Record<string, string> = {
  prospecto: "Descubrimiento",
  calificado: "Calificado",
  propuesta: "Propuesta",
  negociacion: "Negociación",
};

export class DashboardService {
  constructor(private db: Db) {}

  async getData(partnerId: string, today = new Date()): Promise<DashboardData> {
    const monthStart = startOfMonth(today);
    const prevMonthStart = startOfMonth(addMonths(today, -1));
    const quarterStart = startOfQuarter(today);

    const [rev, exp, openLeads, stalled, dueSoon] = await Promise.all([
      this.db
        .select()
        .from(revenueEntries)
        .where(
          and(
            eq(revenueEntries.partnerId, partnerId),
            gte(revenueEntries.entryDate, iso(prevMonthStart)),
          ),
        ),
      this.db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.partnerId, partnerId),
            gte(expenses.entryDate, iso(prevMonthStart)),
          ),
        ),
      this.db
        .select({
          id: leads.id,
          businessName: leads.businessName,
          estimatedValue: leads.estimatedValue,
          stage: leads.stage,
        })
        .from(leads)
        .where(
          and(
            eq(leads.partnerId, partnerId),
            inArray(leads.stage, OPEN_STAGES),
          ),
        ),
      this.db
        .select({ id: kanbanTasks.id, title: kanbanTasks.title })
        .from(kanbanTasks)
        .innerJoin(workspaces, eq(kanbanTasks.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaces.partnerId, partnerId),
            eq(kanbanTasks.status, "en_estancamiento"),
          ),
        )
        .limit(5),
      this.db
        .select({
          id: receivables.id,
          concept: receivables.concept,
          amount: receivables.amount,
          dueDate: receivables.dueDate,
          status: receivables.status,
        })
        .from(receivables)
        .where(eq(receivables.partnerId, partnerId))
        .limit(5),
    ]);

    const hasData = rev.length > 0 || openLeads.length > 0;
    if (!hasData) {
      return demoData();
    }

    // Facturación del mes vs. anterior
    const billingThis = sumAmount(rev, monthStart, today);
    const billingPrev = sumAmount(rev, prevMonthStart, monthStart);
    const expThis = sumAmount(exp, monthStart, today);
    const expPrev = sumAmount(exp, prevMonthStart, monthStart);
    const profitThis = billingThis - expThis;
    const profitPrev = billingPrev - expPrev;

    const pipelineTotal = openLeads.reduce(
      (acc, l) => acc + Number(l.estimatedValue ?? 0),
      0,
    );
    const byStage = OPEN_STAGES.map((s) => {
      const group = openLeads.filter((l) => l.stage === s);
      return {
        label: STAGE_LABELS[s],
        amount: group.reduce((a, l) => a + Number(l.estimatedValue ?? 0), 0),
        count: group.length,
      };
    }).filter((g) => g.count > 0);

    const quarterRevenue = sumAmount(rev, quarterStart, today);
    const goalTarget = Math.max(quarterRevenue, 1) * 1.35; // meta implícita
    const goalPct = Math.min(
      Math.round((quarterRevenue / goalTarget) * 100),
      100,
    );

    const tasks: DashboardTask[] = [
      ...stalled.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: "Tarea estancada — requiere atención",
        done: false,
      })),
      ...dueSoon
        .filter((r) => r.status !== "pagado")
        .map((r) => ({
          id: r.id,
          title: `Cobrar: ${r.concept}`,
          subtitle: `Vence ${r.dueDate} · €${Number(r.amount).toLocaleString("es")}`,
          done: false,
        })),
    ].slice(0, 5);

    return {
      isDemo: false,
      billing: {
        value: billingThis,
        momPct: pct(billingThis, billingPrev),
        spark: weeklySeries(rev, monthStart, today).map((w) => w.amount),
      },
      profit: {
        value: profitThis,
        momPct: pct(profitThis, profitPrev),
        spark: weeklySeries(rev, monthStart, today).map((w, i) => {
          const wexp = weeklySeries(exp, monthStart, today)[i]?.amount ?? 0;
          return w.amount - wexp;
        }),
      },
      pipeline: {
        value: pipelineTotal,
        momPct: null,
        spark: byStage.map((s) => s.amount),
        interestedCount: openLeads.length,
        byStage,
      },
      goalPct,
      weekly: weeklySeries(rev, monthStart, today),
      opportunities: openLeads
        .filter((l) => Number(l.estimatedValue ?? 0) > 0)
        .sort((a, b) => Number(b.estimatedValue) - Number(a.estimatedValue))
        .slice(0, 6)
        .map((l) => ({
          id: l.id,
          businessName: l.businessName,
          amount: Number(l.estimatedValue ?? 0),
          stage: STAGE_LABELS[l.stage] ?? l.stage,
          owner: "Tú",
        })),
      tasks:
        tasks.length > 0
          ? tasks
          : [
              {
                id: "empty",
                title: "Sin tareas urgentes",
                subtitle: "Todo al día 🎉",
                done: true,
              },
            ],
    };
  }
}

// ---------- helpers ----------

interface AmountRow {
  amount: string;
  entryDate: string;
}

function sumAmount(rows: AmountRow[], from: Date, to: Date): number {
  return rows
    .filter((r) => r.entryDate >= iso(from) && r.entryDate < iso(to))
    .reduce((acc, r) => acc + Number(r.amount), 0);
}

function weeklySeries(rows: AmountRow[], from: Date, to: Date): WeeklyIncome[] {
  const weeks: WeeklyIncome[] = [
    { label: "1-7", amount: 0 },
    { label: "8-14", amount: 0 },
    { label: "15-21", amount: 0 },
    { label: "22-31", amount: 0 },
  ];
  for (const r of rows) {
    if (r.entryDate < iso(from) || r.entryDate >= iso(to)) continue;
    const day = Number(r.entryDate.slice(8, 10));
    const idx = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3;
    weeks[idx].amount += Number(r.amount);
  }
  return weeks;
}

function pct(now: number, prev: number): number | null {
  if (prev === 0) return now > 0 ? 100 : null;
  return Math.round(((now - prev) / Math.abs(prev)) * 1000) / 10;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1));
}

function demoData(): DashboardData {
  return {
    isDemo: true,
    billing: {
      value: 58750,
      momPct: 18.5,
      spark: [12000, 15500, 14200, 17050],
    },
    profit: { value: 21300, momPct: 12.1, spark: [4200, 5800, 5100, 6200] },
    pipeline: {
      value: 145200,
      momPct: 22,
      spark: [40000, 80000, 45500],
      interestedCount: 51,
      byStage: [
        { label: "Descubrimiento", amount: 40000, count: 15 },
        { label: "Propuesta", amount: 80000, count: 20 },
        { label: "Negociación", amount: 45500, count: 15 },
      ],
    },
    goalPct: 75,
    weekly: [
      { label: "1-7", amount: 62 },
      { label: "8-14", amount: 88 },
      { label: "15-21", amount: 54 },
      { label: "22-31", amount: 79 },
    ],
    opportunities: [
      { id: "d1", businessName: "Plataforma IA Integral", amount: 35000, stage: "Propuesta", owner: "Leonardo Samsul" },
      { id: "d2", businessName: "Consultoría Cloud Pro", amount: 18000, stage: "Negociación", owner: "Bayu Salto" },
      { id: "d3", businessName: "API Integración Suite", amount: 12000, stage: "Descubrimiento", owner: "Padhang Satrio" },
      { id: "d4", businessName: "Rediseño de Marca Médica", amount: 9500, stage: "Calificado", owner: "Tú" },
    ],
    tasks: [
      { id: "t1", title: "Finalizar acuerdo Partner Business", subtitle: "Vence mañana", done: false },
      { id: "t2", title: "Revisar costos IA (Junio)", subtitle: "Uso mensual de tokens", done: false },
      { id: "t3", title: "Integración de Bot de Academia", subtitle: "Pendiente de despliegue", done: false },
    ],
  };
}
