import type { InvoiceStatus } from "./types";

// Helpers puros del módulo finance (sin DB) — testeables en unidad.

/** YYYY-MM-DD (UTC) del instante dado. */
export function isoDayUtc(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10);
}

/**
 * Status efectivo de una factura: una 'pendiente' con vencimiento pasado se
 * reporta 'vencido' sin necesidad de ningún job que actualice la fila (misma
 * semántica que getInvoiceAlerts). 'pagado' y 'vencido' almacenados se
 * respetan tal cual.
 */
export function effectiveStatus(
  status: InvoiceStatus,
  dueDate: string | null,
  now: Date = new Date(),
): InvoiceStatus {
  if (status !== "pendiente" || !dueDate) return status;
  return dueDate < isoDayUtc(now) ? "vencido" : status;
}

export interface MonthGridCell {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

/**
 * Celdas del calendario mensual (semanas de lunes a domingo, 7×5 o 7×6),
 * desde el lunes de la semana del día 1 hasta el domingo de la semana del
 * último día. `month` es "YYYY-MM". Solo aritmética Date.UTC — nunca se
 * parsean strings de fecha ambiguos.
 */
export function buildMonthGrid(month: string): MonthGridCell[] {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;

  const first = Date.UTC(year, monthIndex, 1);
  // getUTCDay(): 0=domingo … 6=sábado → días desde el lunes de esa semana.
  const offsetToMonday = (new Date(first).getUTCDay() + 6) % 7;
  const start = Date.UTC(year, monthIndex, 1 - offsetToMonday);

  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  const offsetToSunday = (7 - new Date(lastDay.getTime()).getUTCDay()) % 7;
  const end = Date.UTC(year, monthIndex, lastDay.getUTCDate() + offsetToSunday);

  const cells: MonthGridCell[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    cells.push({
      date: d.toISOString().slice(0, 10),
      inMonth: d.getUTCMonth() === monthIndex,
    });
  }
  return cells;
}

/** Primer día del mes "YYYY-MM" como YYYY-MM-DD. */
export function monthStartIso(month: string): string {
  return `${month}-01`;
}

/** Último día del mes "YYYY-MM" como YYYY-MM-DD (UTC, sin parseo ambiguo). */
export function monthEndIso(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  return new Date(Date.UTC(Number(yearStr), Number(monthStr), 0))
    .toISOString()
    .slice(0, 10);
}

export interface WeekBucket {
  /** YYYY-MM-DD inclusive. */
  start: string;
  /** YYYY-MM-DD inclusive. */
  end: string;
  /** Etiqueta corta es-ES, p. ej. "1-7 jul". */
  label: string;
}

const MONTH_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/**
 * Buckets semanales del mes de `now` (UTC): tramos de 7 días desde el día 1;
 * el último tramo absorbe el resto del mes (4-5 buckets). Solo aritmética
 * Date.UTC.
 */
export function buildWeekBuckets(now: Date): WeekBucket[] {
  const year = now.getUTCFullYear();
  const monthIndex = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const iso = (day: number) =>
    new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);

  const buckets: WeekBucket[] = [];
  for (let start = 1; start <= lastDay; start += 7) {
    // El último bucket se extiende hasta fin de mes para no dejar un tramo
    // suelto de 1-3 días (patrón "22-30 Jun" del diseño).
    const isLast = start + 13 > lastDay;
    const end = isLast ? lastDay : start + 6;
    buckets.push({
      start: iso(start),
      end: iso(end),
      label: `${start}-${end} ${MONTH_SHORT[monthIndex]}`,
    });
    if (isLast) break;
  }
  return buckets;
}

/**
 * % de avance hacia una meta, redondeado. 0 si la meta es 0 o negativa (nunca
 * división por cero); puede superar 100 cuando la meta se rebasa.
 */
export function goalPct(actual: number, goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.round((actual / goal) * 100);
}
