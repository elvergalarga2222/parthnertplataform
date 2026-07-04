import type {
  Kpi,
  Opportunity,
  QuarterGoal,
  DashboardTask,
  TeamMember,
  WeeklyIncome,
} from "./types";

// Demo data layer for the Resumen dashboard.
//
// Numbers are simulated with a small artificial latency so the UI exercises
// its real loading states. As the finance (Fase 4) and CRM (Fase 2) modules
// land, each function is replaced by real queries scoped to the current
// partner, keeping the same signature so no component changes.

const simulateNetwork = (ms = 450) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function getKpis(): Promise<Kpi[]> {
  await simulateNetwork();
  return [
    {
      id: "facturacion",
      title: "Facturación Total (Mes)",
      value: 58750,
      momPct: 18.5,
      momLabel: "vs. Mayo",
      footnote: "Agencia Directa: €35k · Reseller: €15k · Club: €8.75k",
      chart: {
        kind: "area",
        points: [
          { label: "Ene", value: 31200 },
          { label: "Feb", value: 35800 },
          { label: "Mar", value: 33400 },
          { label: "Abr", value: 41900 },
          { label: "May", value: 49600 },
          { label: "Jun", value: 58750 },
        ],
      },
    },
    {
      id: "profit",
      title: "Profit Neto del Mes",
      value: 21300,
      momPct: 12.1,
      momLabel: "vs. Mayo",
      footnote: "Ingresos vs. costos (IA / operación) ya descontados",
      chart: {
        kind: "bars",
        points: [
          { label: "Ene", value: 11400 },
          { label: "Feb", value: 13100 },
          { label: "Mar", value: 12200 },
          { label: "Abr", value: 15800 },
          { label: "May", value: 19000 },
          { label: "Jun", value: 21300 },
        ],
      },
    },
    {
      id: "pipeline",
      title: "Pipeline Abierto",
      value: 145200,
      momPct: 22,
      momLabel: "MCM vs. Mayo",
      chart: {
        kind: "funnel",
        dealsOpen: 51,
        stages: [
          { name: "Descubrimiento", amount: 40000, deals: 15 },
          { name: "Propuesta", amount: 80000, deals: 20 },
          { name: "Negociación", amount: 25200, deals: 16 },
        ],
      },
    },
  ];
}

export async function getOpportunities(): Promise<Opportunity[]> {
  await simulateNetwork(550);
  return [
    {
      id: "op-1",
      company: "Project Alfa",
      companyInitial: "A",
      title: "Plataforma IA Integral",
      amount: 35000,
      ownerName: "Leonardo Samsul",
      ownerRole: "Account Manager",
      status: "Negociación",
      accent: "#8b7cf6",
    },
    {
      id: "op-2",
      company: "Global Solutions",
      companyInitial: "G",
      title: "Consultoría Cloud Pro",
      amount: 18000,
      ownerName: "Bayu Salto",
      ownerRole: "Mentor",
      status: "Propuesta",
      accent: "#6a58d8",
    },
    {
      id: "op-3",
      company: "Quantum Leap",
      companyInitial: "Q",
      title: "API Integración Suite",
      amount: 12000,
      ownerName: "Padhang Satrio",
      ownerRole: "Mentor",
      status: "Descubrimiento",
      accent: "#a795f8",
    },
    {
      id: "op-4",
      company: "Clínica Vitalis",
      companyInitial: "V",
      title: "Sistema de Agenda Digital",
      amount: 24000,
      ownerName: "Jason Ranti",
      ownerRole: "Partner",
      status: "Propuesta",
      accent: "#8b7cf6",
    },
    {
      id: "op-5",
      company: "Grupo Industrial Norte",
      companyInitial: "N",
      title: "Consultoría Transformación Digital",
      amount: 42000,
      ownerName: "Leonardo Samsul",
      ownerRole: "Account Manager",
      status: "Descubrimiento",
      accent: "#6a58d8",
    },
  ];
}

export async function getTasks(): Promise<DashboardTask[]> {
  await simulateNetwork(500);
  return [
    {
      id: "t-1",
      title: "Finalizar acuerdo Partner Business",
      detail: "Vence mañana",
      done: false,
    },
    {
      id: "t-2",
      title: "Revisar costos IA (Junio)",
      detail: "Revisar uso mensual de tokens",
      done: true,
    },
    {
      id: "t-3",
      title: "Integración de Bot de Academia",
      detail: "Pendiente de despliegue",
      done: false,
    },
    {
      id: "t-4",
      title: "Preparar propuesta Clínica Vitalis",
      detail: "Consultoría de 4 semanas",
      done: false,
    },
  ];
}

export async function getWeeklyIncome(): Promise<WeeklyIncome[]> {
  await simulateNetwork(500);
  return [
    { week: "1-7 Jun", amount: 9800 },
    { week: "8-14 Jun", amount: 16400 },
    { week: "15-21 Jun", amount: 12900 },
    { week: "22-30 Jun", amount: 19650 },
  ];
}

export async function getQuarterGoal(): Promise<QuarterGoal> {
  await simulateNetwork(300);
  return { pct: 75, label: "Meta trimestral de ventas lograda" };
}

export async function getTeam(): Promise<TeamMember[]> {
  await simulateNetwork(200);
  return [
    { name: "Bagas Wirandi", role: "Head of Sales" },
    { name: "Sir Dandy", role: "Operations Lead" },
    { name: "Jhon Tosan", role: "Product Owner" },
  ];
}

export function formatEuro(value: number): string {
  return `€${value.toLocaleString("es-ES")}`;
}
