import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { toIsoOrEpoch, toIsoOrNull } from "@/lib/dates";
import { LOG_BUFFER_KEY } from "@/lib/logger";
import { getRedis } from "@/lib/redis";

// Panel del OPERADOR — capa de composición (precedente: dashboard/). Es la
// única zona legítimamente cross-tenant del sistema: puede leer tablas de
// cualquier dominio, pero las mutaciones de acceso las delega en
// auth/service.ts (freezePartner/unfreezePartner) y su único punto de entrada
// son las actions gateadas con getCurrentAdmin().

export class AdminError extends Error {}

export interface AdminPartnerRow {
  id: string;
  email: string;
  displayName: string | null;
  status: "active" | "frozen";
  createdAt: string;
  lastLoginAt: string | null;
  workspaces: number;
  deals: number;
  aiTokens30d: number;
  aiCostUsd30d: number;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function listPartners(): Promise<AdminPartnerRow[]> {
  const rows = await db
    .select({
      partner: partners,
      lastLoginAt: sql<string | null>`(
        SELECT MAX(a.created_at) FROM access_audit_log a
        WHERE a.partner_id = ${partners.id} AND a.event = 'login'
      )`,
      workspaces: sql<string>`(
        SELECT COUNT(*) FROM workspaces w WHERE w.partner_id = ${partners.id}
      )`,
      deals: sql<string>`(
        SELECT COUNT(*) FROM deals d WHERE d.partner_id = ${partners.id}
      )`,
      aiTokens30d: sql<string>`(
        SELECT COALESCE(SUM(g.tokens_input + g.tokens_output), 0)
        FROM ai_generations g
        WHERE g.partner_id = ${partners.id}
          AND g.created_at >= now() - interval '30 days'
      )`,
      aiCostUsd30d: sql<string>`(
        SELECT COALESCE(SUM(g.cost_usd), 0)
        FROM ai_generations g
        WHERE g.partner_id = ${partners.id}
          AND g.created_at >= now() - interval '30 days'
      )`,
    })
    .from(partners)
    .orderBy(desc(partners.createdAt));

  return rows.map(({ partner, lastLoginAt, ...agg }) => ({
    id: partner.id,
    email: partner.email,
    displayName: partner.displayName,
    status: partner.status as "active" | "frozen",
    createdAt: toIsoOrEpoch(partner.createdAt),
    // El subselect llega como string/Date según el driver; normalizar seguro.
    lastLoginAt: lastLoginAt ? toIsoOrNull(new Date(lastLoginAt)) : null,
    workspaces: toNumber(agg.workspaces),
    deals: toNumber(agg.deals),
    aiTokens30d: toNumber(agg.aiTokens30d),
    aiCostUsd30d: toNumber(agg.aiCostUsd30d),
  }));
}

export interface AdminOverview {
  partnersActive: number;
  partnersFrozen: number;
  workspacesTotal: number;
  dealsTotal: number;
  ai: {
    generations30d: number;
    tokens30d: number;
    costUsd30d: number;
    costUsdTotal: number;
  };
}

export async function getOverview(): Promise<AdminOverview> {
  const [row] = await db.execute<{
    partners_active: string;
    partners_frozen: string;
    workspaces_total: string;
    deals_total: string;
    ai_generations_30d: string;
    ai_tokens_30d: string;
    ai_cost_30d: string;
    ai_cost_total: string;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM partners WHERE status = 'active')  AS partners_active,
      (SELECT COUNT(*) FROM partners WHERE status = 'frozen')  AS partners_frozen,
      (SELECT COUNT(*) FROM workspaces)                        AS workspaces_total,
      (SELECT COUNT(*) FROM deals)                             AS deals_total,
      (SELECT COUNT(*) FROM ai_generations
        WHERE created_at >= now() - interval '30 days')        AS ai_generations_30d,
      (SELECT COALESCE(SUM(tokens_input + tokens_output), 0) FROM ai_generations
        WHERE created_at >= now() - interval '30 days')        AS ai_tokens_30d,
      (SELECT COALESCE(SUM(cost_usd), 0) FROM ai_generations
        WHERE created_at >= now() - interval '30 days')        AS ai_cost_30d,
      (SELECT COALESCE(SUM(cost_usd), 0) FROM ai_generations)  AS ai_cost_total
  `);

  return {
    partnersActive: toNumber(row.partners_active),
    partnersFrozen: toNumber(row.partners_frozen),
    workspacesTotal: toNumber(row.workspaces_total),
    dealsTotal: toNumber(row.deals_total),
    ai: {
      generations30d: toNumber(row.ai_generations_30d),
      tokens30d: toNumber(row.ai_tokens_30d),
      costUsd30d: toNumber(row.ai_cost_30d),
      costUsdTotal: toNumber(row.ai_cost_total),
    },
  };
}

// --- Visor de logs (PR-14) ---------------------------------------------------
// Atajo rápido para errores menores sin entrar al VPS. NO reemplaza
// pm2 logs/docker logs: el buffer es acotado (LOG_BUFFER_MAX, default 500) y
// best-effort — solo captura desde que este visor se desplegó.

export interface ErrorLogEntry {
  time: string;
  msg: string;
  route: string | null;
  partnerId: string | null;
  digest: string | null;
  requestId: string | null;
  source: string | null;
  boundary: string | null;
  errName: string | null;
  errMessage: string | null;
  errStack: string | null;
  raw: string;
}

function toEntry(raw: string): ErrorLogEntry {
  try {
    const r = JSON.parse(raw) as Record<string, unknown>;
    const err = (r.err ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : null);
    return {
      time: str(r.time) ?? new Date(0).toISOString(),
      msg: str(r.msg) ?? "",
      route: str(r.route),
      partnerId: str(r.partnerId),
      digest: str(r.digest),
      requestId: str(r.requestId),
      source: str(r.source),
      boundary: str(r.boundary),
      errName: str(err.name),
      errMessage: str(err.message),
      errStack: str(err.stack),
      raw,
    };
  } catch {
    // Una entrada corrupta se muestra como raw en vez de tumbar la vista.
    return {
      time: new Date(0).toISOString(),
      msg: "(entrada corrupta)",
      route: null,
      partnerId: null,
      digest: null,
      requestId: null,
      source: null,
      boundary: null,
      errName: null,
      errMessage: null,
      errStack: null,
      raw,
    };
  }
}

/** Más reciente primero (LPUSH ya lo garantiza). */
export async function getErrorLogs(): Promise<ErrorLogEntry[]> {
  if (!process.env.REDIS_URL) return [];
  const raws = await getRedis().lrange(LOG_BUFFER_KEY, 0, -1);
  return raws.map(toEntry);
}

export async function clearErrorLogs(): Promise<void> {
  if (!process.env.REDIS_URL) return;
  await getRedis().del(LOG_BUFFER_KEY);
}
