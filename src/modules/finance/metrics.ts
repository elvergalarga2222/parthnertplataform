// Cálculos financieros puros del Partner Business (Épica 5).

export interface RevenueLike {
  kind: string; // consultoria | asesoria_mensual
  amount: number;
}

export interface SeventyThirtyResult {
  total: number;
  consultoria: number;
  asesoria: number;
  /** Proporción de asesorías sobre el total (0..1). */
  asesoriaShare: number;
  /** true si las asesorías superan el 30% del volumen (alerta roja). */
  breached: boolean;
}

/**
 * Regla 70/30: las asesorías mensuales no deben superar el 30% del volumen;
 * el negocio debe priorizar consultorías de alto valor (70%).
 */
export function seventyThirty(entries: RevenueLike[]): SeventyThirtyResult {
  const consultoria = sum(entries.filter((e) => e.kind === "consultoria"));
  const asesoria = sum(entries.filter((e) => e.kind === "asesoria_mensual"));
  const total = consultoria + asesoria;
  const asesoriaShare = total > 0 ? asesoria / total : 0;
  return {
    total,
    consultoria,
    asesoria,
    asesoriaShare,
    breached: total > 0 && asesoriaShare > 0.3,
  };
}

export type MarginLevel = "healthy" | "warning" | "critical";

export interface MarginResult {
  income: number;
  costs: number;
  net: number;
  /** Margen neto (0..1); 0 si no hay ingresos. */
  margin: number;
  /** verde ≥ 0.80, amarillo 0.70–0.80, rojo < 0.70 */
  level: MarginLevel;
}

export function marginAlert(income: number, costs: number): MarginResult {
  const net = income - costs;
  const margin = income > 0 ? net / income : 0;
  const level: MarginLevel =
    margin >= 0.8 ? "healthy" : margin >= 0.7 ? "warning" : "critical";
  return { income, costs, net, margin, level };
}

export interface ReceivableLike {
  amount: number;
  status: string; // pendiente | pagado | vencido
  dueDate: string; // YYYY-MM-DD
}

export interface CashflowSummary {
  pending: number;
  overdue: number;
  collected: number;
}

/** Sumatorias de flujo de caja; una pendiente con fecha pasada cuenta como vencida. */
export function cashflowSummary(
  items: ReceivableLike[],
  today: string,
): CashflowSummary {
  let pending = 0;
  let overdue = 0;
  let collected = 0;
  for (const item of items) {
    if (item.status === "pagado") {
      collected += item.amount;
    } else if (item.status === "vencido" || item.dueDate < today) {
      overdue += item.amount;
    } else {
      pending += item.amount;
    }
  }
  return { pending, overdue, collected };
}

function sum(entries: RevenueLike[]): number {
  return entries.reduce((acc, e) => acc + e.amount, 0);
}
