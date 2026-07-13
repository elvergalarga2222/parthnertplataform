/**
 * Serialización segura de fechas hacia las vistas (RSC → cliente).
 *
 * postgres-js convierte timestamptz haciendo en esencia `new Date(texto)`; si
 * la fila contiene un valor que JavaScript no puede representar ('infinity',
 * fechas BC, años fuera del rango de Date), devuelve un `Invalid Date` sin
 * error y `.toISOString()` lanza RangeError al serializar — el optional
 * chaining no protege contra eso. Todo `.toISOString()` sobre valores que
 * vienen de la base debe pasar por estos helpers.
 */

/** ISO string o null; nunca lanza. Cubre null, undefined e Invalid Date. */
export function toIsoOrNull(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** ISO string; un Date inválido o ausente cae al epoch. Para columnas NOT NULL. */
export function toIsoOrEpoch(d: Date | null | undefined): string {
  return toIsoOrNull(d) ?? "1970-01-01T00:00:00.000Z";
}

/**
 * Días completos desde `today` hasta `dueDate` (negativo si ya pasó).
 * `dueDate` es un `date` de Postgres (string "YYYY-MM-DD", sin hora) —
 * comparado en UTC contra la fecha (sin hora) de `today`. Unificado aquí:
 * finance (cobros) y tasks (vencimientos) lo comparten — antes de PR-9 cada
 * módulo tenía su propia copia.
 */
export function daysBetween(today: Date, dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Validador Zod reutilizable: año de una fecha string acotado a [min, max].
 * Lección del bug de /clientes — `z.string().date()`/`.datetime()` no acota
 * el año por sí solo (Postgres acepta 'infinity' y años de 6 dígitos que
 * JavaScript no puede representar). Nullish pasa siempre (se valida aparte).
 */
export function inYearRange(min: number, max: number) {
  return (value: string | null | undefined): boolean => {
    if (!value) return true;
    const year = new Date(value).getUTCFullYear();
    return Number.isInteger(year) && year >= min && year <= max;
  };
}
