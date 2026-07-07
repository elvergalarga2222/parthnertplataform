export interface KpiTrendPoint {
  label: string;
  value: number;
}

export interface PipelineStage {
  name: string;
  amount: number;
  deals: number;
}

export interface Kpi {
  id: string;
  title: string;
  value: number;
  // ISO currency for `value` (COP/USD/EUR). Omitted on demo KPIs → euro.
  currency?: string;
  momPct: number;
  momLabel: string;
  footnote?: string;
  chart:
    | { kind: "area"; points: KpiTrendPoint[] }
    | { kind: "bars"; points: KpiTrendPoint[] }
    | { kind: "funnel"; stages: PipelineStage[]; dealsOpen: number };
}

export type OpportunityStatus =
  | "Descubrimiento"
  | "Propuesta"
  | "Negociación"
  | "Cierre";

export interface Opportunity {
  id: string;
  company: string;
  companyInitial: string;
  title: string;
  amount: number;
  ownerName: string;
  ownerRole: string;
  status: OpportunityStatus;
  accent: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

export interface WeeklyIncome {
  week: string;
  amount: number;
}

export interface QuarterGoal {
  pct: number;
  label: string;
}

export interface TeamMember {
  name: string;
  role: string;
}
