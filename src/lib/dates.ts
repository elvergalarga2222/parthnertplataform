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
