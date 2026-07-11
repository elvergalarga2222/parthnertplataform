import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { feedbackReports } from "@/db/schema";
import { isAdminEmail } from "@/modules/auth/admin";
import type { Partner } from "@/modules/auth/service";

// Multi-tenant rule (CLAUDE.md #3): las mutaciones siempre usan el partner de
// sesión (imposible reportar "como otro"). La LECTURA de todos los reportes
// es legítimamente cross-tenant y vive en admin/service.ts (patrón PR-7 §4).

export class FeedbackError extends Error {}

export type FeedbackType = "bug" | "sugerencia";
export type FeedbackStatus = "nuevo" | "revisado" | "resuelto";

/** ADMIN_EMAILS cuenta siempre como tester implícito (nunca hay que auto-togglearse). */
export function isTester(partner: Pick<Partner, "isTester" | "email">): boolean {
  return partner.isTester || isAdminEmail(partner.email);
}

export interface FeedbackInput {
  route: string;
  type: FeedbackType;
  description: string;
  userAgent?: string | null;
}

const DUPLICATE_WINDOW_MS = 30_000;

/**
 * Crea un reporte. Rate-limit anti-doble-click: rechaza si el mismo partner
 * ya creó un reporte con la MISMA descripción en los últimos 30s (comparación
 * directa de texto, sin Redis — un query barato basta para este volumen).
 */
export async function createFeedback(
  partnerId: string,
  input: FeedbackInput,
  now: Date = new Date(),
): Promise<string> {
  const windowStart = new Date(now.getTime() - DUPLICATE_WINDOW_MS);

  const [dup] = await db
    .select({ id: feedbackReports.id })
    .from(feedbackReports)
    .where(
      and(
        eq(feedbackReports.partnerId, partnerId),
        eq(feedbackReports.description, input.description),
        gt(feedbackReports.createdAt, windowStart),
      ),
    )
    .limit(1);
  if (dup) throw new FeedbackError("Ya enviaste este reporte hace un momento.");

  const [row] = await db
    .insert(feedbackReports)
    .values({
      partnerId,
      route: input.route,
      type: input.type,
      description: input.description,
      userAgent: input.userAgent ?? null,
      // Explícito (no defaultNow()) para que el parámetro `now` sea la única
      // fuente de verdad del reloj en tests deterministas del rate-limit.
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: feedbackReports.id });
  return row.id;
}
