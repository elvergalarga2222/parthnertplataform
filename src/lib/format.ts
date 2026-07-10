/**
 * Formato de dinero es-ES consciente de la moneda — NUNCA se convierte entre
 * monedas (regla del módulo finance); esto solo formatea el número con su
 * símbolo. Fuente única: el resto del código (dashboard incluido) debe
 * importar de aquí.
 */
export function formatMoney(value: number, currency = "EUR"): string {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("es-ES")} ${currency}`;
  }
}
