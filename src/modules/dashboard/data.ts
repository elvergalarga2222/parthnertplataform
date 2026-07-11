import type { DashboardTask } from "./types";

// Demo data layer for the Resumen dashboard.
//
// Numbers are simulated with a small artificial latency so the UI exercises
// its real loading states. As the finance (Fase 4) and CRM (Fase 2) modules
// land, each function is replaced by real queries scoped to the current
// partner, keeping the same signature so no component changes.

const simulateNetwork = (ms = 450) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

