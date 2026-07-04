import type { DealView } from "./types";

// Pure helpers, unit-tested without a database.

/** Stable slug for custom field keys: "Fuente del Lead" -> "fuente_del_lead". */
export function slugifyFieldKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function formatMoney(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export type ActivityGroupKey =
  | "hoy"
  | "ayer"
  | "proximas"
  | "anteriores"
  | "sin_actividad";

export const ACTIVITY_GROUP_LABELS: Record<ActivityGroupKey, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  proximas: "Próximas",
  anteriores: "Anteriores",
  sin_actividad: "Sin actividad",
};

export const ACTIVITY_GROUP_ORDER: ActivityGroupKey[] = [
  "hoy",
  "ayer",
  "proximas",
  "anteriores",
  "sin_actividad",
];

function startOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** Buckets a deal by next_activity_at relative to `now` (local time). */
export function activityGroupOf(
  nextActivityAt: string | null,
  now: Date = new Date(),
): ActivityGroupKey {
  if (!nextActivityAt) return "sin_actividad";
  const target = startOfDay(new Date(nextActivityAt));
  const today = startOfDay(now);
  const dayMs = 24 * 60 * 60 * 1000;
  if (target === today) return "hoy";
  if (target === today - dayMs) return "ayer";
  if (target > today) return "proximas";
  return "anteriores";
}

/** Groups deals for the Records table, keeping only non-empty groups in order. */
export function groupDealsByActivity(
  deals: DealView[],
  now: Date = new Date(),
): { key: ActivityGroupKey; label: string; deals: DealView[] }[] {
  const buckets = new Map<ActivityGroupKey, DealView[]>();
  for (const deal of deals) {
    const key = activityGroupOf(deal.nextActivityAt, now);
    const list = buckets.get(key) ?? [];
    list.push(deal);
    buckets.set(key, list);
  }
  return ACTIVITY_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: ACTIVITY_GROUP_LABELS[key],
    deals: buckets.get(key)!,
  }));
}

/**
 * Optimistic mirror of service.moveDealStage: returns a new deals array with
 * the deal moved to (stageId, index) and positions renormalized for the
 * affected columns.
 */
export function applyMoveLocally(
  deals: DealView[],
  dealId: string,
  stageId: string,
  index: number,
): DealView[] {
  const moving = deals.find((d) => d.id === dealId);
  if (!moving) return deals;
  const sourceStageId = moving.stageId;

  const byStage = (id: string) =>
    deals
      .filter((d) => d.stageId === id && d.id !== dealId)
      .sort((a, b) => a.position - b.position);

  const target = byStage(stageId);
  const clamped = Math.max(0, Math.min(index, target.length));
  target.splice(clamped, 0, { ...moving, stageId });

  const updated = new Map<string, DealView>();
  target.forEach((d, i) => updated.set(d.id, { ...d, position: i }));
  if (sourceStageId !== stageId) {
    byStage(sourceStageId).forEach((d, i) =>
      updated.set(d.id, { ...d, position: i }),
    );
  }

  return deals.map((d) => updated.get(d.id) ?? d);
}

/** Totals per stage for the kanban column headers. */
export function stageTotals(
  deals: DealView[],
): Record<string, { count: number; total: number }> {
  const totals: Record<string, { count: number; total: number }> = {};
  for (const deal of deals) {
    const entry = (totals[deal.stageId] ??= { count: 0, total: 0 });
    entry.count += 1;
    entry.total += deal.value;
  }
  return totals;
}
