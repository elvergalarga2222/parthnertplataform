import {
  getMonthlyProfit,
  getMonthlyRevenue,
  isCurrency,
} from "@/modules/finance/service";
import type { Currency } from "@/modules/finance/types";
import type { Kpi } from "./types";

// Dashboard composition layer: assembles the 2 real KPI cards (Facturación,
// Profit) from the finance module, denominated in the partner's default
// currency. El pipeline salió del dashboard por decisión de producto
// (feedback Kenny, PR-11): vive completo en /clientes. Kept out of finance/
// so that domain module stays free of presentation types.

const MONTH_ABBR = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

interface MonthBucket {
  key: string; // YYYY-MM-DD (first of month, UTC)
  label: string;
}

function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

/** Last `count` months (oldest first) as {key, label}. */
function recentMonths(count: number, now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = monthStart(now, -i);
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label: MONTH_ABBR[d.getUTCMonth()],
    });
  }
  return buckets;
}

/** Percentage change from previous to current, guarding division by zero. */
function momPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * The 3 real dashboard KPIs for the partner. Shape matches the existing Kpi
 * type so the dashboard components render unchanged; only `currency` is new so
 * amounts format in the partner's currency instead of a hardcoded euro.
 */
export async function getDashboardKpis(
  partner: { id: string; defaultCurrency: string },
  now = new Date(),
): Promise<Kpi[]> {
  const currency: Currency = isCurrency(partner.defaultCurrency)
    ? partner.defaultCurrency
    : "USD";

  const [revenueRows, profitRows] = await Promise.all([
    getMonthlyRevenue(partner.id, currency),
    getMonthlyProfit(partner.id, currency),
  ]);

  const months = recentMonths(6, now);
  const revenueByMonth = new Map(revenueRows.map((r) => [r.month, r.revenue]));
  const profitByMonth = new Map(profitRows.map((r) => [r.month, r.profit]));

  const revenuePoints = months.map((m) => ({
    label: m.label,
    value: revenueByMonth.get(m.key) ?? 0,
  }));
  const profitPoints = months.map((m) => ({
    label: m.label,
    value: profitByMonth.get(m.key) ?? 0,
  }));

  const curRevenue = revenuePoints.at(-1)?.value ?? 0;
  const prevRevenue = revenuePoints.at(-2)?.value ?? 0;
  const curProfit = profitPoints.at(-1)?.value ?? 0;
  const prevProfit = profitPoints.at(-2)?.value ?? 0;
  const prevLabel = months.at(-2)?.label ?? "mes previo";

  return [
    {
      id: "facturacion",
      title: "Facturación Total (Mes)",
      value: curRevenue,
      currency,
      momPct: momPct(curRevenue, prevRevenue),
      momLabel: `vs. ${prevLabel}`,
      chart: { kind: "area", points: revenuePoints },
    },
    {
      id: "profit",
      title: "Profit Neto del Mes",
      value: curProfit,
      currency,
      momPct: momPct(curProfit, prevProfit),
      momLabel: `vs. ${prevLabel}`,
      footnote: "Ingresos menos gastos y costo de IA del mes",
      chart: { kind: "bars", points: profitPoints },
    },
  ];
}
