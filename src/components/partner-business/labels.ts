import type {
  ExpenseCategory,
  InvoiceKind,
  InvoiceStatus,
} from "@/modules/finance/types";

// Etiquetas de dominio en español (los datos guardan claves técnicas).

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ia: "IA",
  produccion_video: "Producción de video",
  hosting_vps: "Hosting/VPS",
  freelancer: "Freelancers",
  herramientas_saas: "Herramientas SaaS",
  otro: "Otro",
};

export const KIND_LABELS: Record<InvoiceKind, string> = {
  proyecto: "Proyecto",
  asesoria_mensual: "Asesoría mensual",
  otro: "Otro",
};

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagada",
  vencido: "Vencida",
};

export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  pendiente: "bg-amber-400/15 text-amber-300",
  pagado: "bg-positive/15 text-positive",
  vencido: "bg-negative/15 text-negative",
};

export const STATUS_CHIP: Record<InvoiceStatus, string> = {
  pendiente: "border-amber-400/40 text-amber-300",
  pagado: "border-positive/40 text-positive",
  vencido: "border-negative/40 text-negative",
};

/**
 * YYYY-MM-DD → fecha corta es-ES. Mediodía local para evitar el off-by-one de
 * timezone (patrón de WorkspaceKanban).
 */
export function formatDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** "YYYY-MM" → "julio 2026" (es-ES). */
export function formatMonthLabel(month: string): string {
  const d = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

/** Suma meses a un "YYYY-MM" sin parseo ambiguo. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const inputClass =
  "rounded-xl border border-edge bg-surface-2 px-3 py-2.5 text-[13px] text-ink outline-none transition-colors focus:border-primary/60";
export const labelClass =
  "flex flex-col gap-1.5 text-[12px] font-medium text-ink-secondary";
