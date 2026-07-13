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

export interface TeamMember {
  name: string;
  role: string;
}
