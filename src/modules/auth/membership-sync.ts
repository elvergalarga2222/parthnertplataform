import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accessAuditLog, partners, skoolMemberships } from "@/db/schema";
import { logger } from "@/lib/logger";
import type { Member, MembershipProvider } from "./membership-provider";
import { getMembershipProvider } from "./providers";
import { AuthError, freezePartner, unfreezePartner } from "./service";

// Sincronización de membresías Skool (PR-10 — la mitad "polling +
// congelamiento" de la Fase 1). Máquina de estados por partner, idempotente:
// alert_state evita re-alertar y freezePartner es no-op sobre congelados.
// Fail-safes deliberados: nunca congelar por un error de red (el error
// propaga y BullMQ reintenta), nunca congelar por una respuesta vacía, y a
// un partner ausente de la respuesta solo se le actúa tras 3 ejecuciones
// consecutivas sin aparecer.

const ALERT_WINDOW_DAYS = 15;
const MISSING_RUNS_THRESHOLD = 3;
const SYSTEM_ACTOR = "system:membership-sync";

/** Días de gracia del plan B (sin fecha de fin de periodo). Env, default 15. */
export function membershipGraceDays(): number {
  const raw = Number(process.env.MEMBERSHIP_GRACE_DAYS);
  return Number.isInteger(raw) && raw > 0 ? raw : 15;
}

export interface SyncResult {
  checked: number;
  notified: number;
  frozen: number;
  unfrozen: number;
  missing: number;
  skipped: boolean; // true si la respuesta del provider venía vacía (fail-safe)
}

function wholeDaysUntil(now: Date, until: Date): number {
  return Math.ceil((until.getTime() - now.getTime()) / 86_400_000);
}

async function audit(partnerId: string, event: string, detail: unknown) {
  await db.insert(accessAuditLog).values({
    partnerId,
    event,
    detail: detail as Record<string, unknown>,
  });
}

/** Congela vía el contrato de PR-7; los ya-congelados y admins no rompen el run. */
async function tryFreeze(partnerId: string): Promise<boolean> {
  try {
    await freezePartner(partnerId, { adminEmail: SYSTEM_ACTOR });
    return true;
  } catch (err) {
    if (err instanceof AuthError) {
      logger.warn("membership-sync: freeze skipped", { partnerId, reason: err.message });
      return false;
    }
    throw err;
  }
}

export async function syncMemberships(
  now: Date = new Date(),
  provider: MembershipProvider = getMembershipProvider(),
): Promise<SyncResult> {
  const result: SyncResult = {
    checked: 0,
    notified: 0,
    frozen: 0,
    unfrozen: 0,
    missing: 0,
    skipped: false,
  };

  // Si el provider falla, el error propaga: BullMQ reintenta y NADIE se congela.
  const members = await provider.listMembers();

  // Fail-safe: una respuesta totalmente vacía es un modo de fallo (o un
  // provider sin catálogo, como el open), no "todos se fueron del grupo".
  if (members.length === 0) {
    logger.warn("membership-sync: provider returned no members; skipping run");
    result.skipped = true;
    return result;
  }

  const groupId = process.env.SKOOL_GROUP_ID ?? "dev";
  const byExternalId = new Map<string, Member>(
    members.map((m) => [m.externalId, m]),
  );
  const allPartners = await db.select().from(partners);
  const membershipRows = await db.select().from(skoolMemberships);
  const membershipByPartner = new Map(
    membershipRows
      .filter((m) => m.groupId === groupId)
      .map((m) => [m.partnerId, m]),
  );

  for (const partner of allPartners) {
    const member = byExternalId.get(partner.skoolMemberId);
    const existing = membershipByPartner.get(partner.id);
    result.checked++;

    try {
      if (!member) {
        // Ausente de la respuesta: contar, loguear y solo actuar al 3er strike.
        if (!existing) continue; // nunca visto por el provider: nada que hacer
        const missingCount = existing.missingCount + 1;
        await db
          .update(skoolMemberships)
          .set({ missingCount, lastVerifiedAt: now, updatedAt: now })
          .where(eq(skoolMemberships.id, existing.id));
        await audit(partner.id, "membership_not_found", { missingCount });
        result.missing++;
        if (missingCount >= MISSING_RUNS_THRESHOLD && partner.status === "active") {
          if (await tryFreeze(partner.id)) {
            await db
              .update(skoolMemberships)
              .set({ alertState: "frozen_auto", updatedAt: now })
              .where(eq(skoolMemberships.id, existing.id));
            await audit(partner.id, "partner_frozen_auto", {
              reason: "missing_from_provider",
              missingCount,
            });
            result.frozen++;
          }
        }
        continue;
      }

      const periodEnd = member.currentPeriodEndsAt
        ? new Date(member.currentPeriodEndsAt)
        : null;
      const cancelled =
        member.cancelAtPeriodEnd || member.status === "churned";

      // Estado base a upsertar (missing_count se resetea: volvió a aparecer).
      const base = {
        partnerId: partner.id,
        groupId,
        membershipStatus: member.status,
        currentPeriodEndsAt:
          periodEnd && !Number.isNaN(periodEnd.getTime()) ? periodEnd : null,
        cancelAtPeriodEnd: member.cancelAtPeriodEnd,
        lastVerifiedAt: now,
        missingCount: 0,
        rawPayload: member as unknown as Record<string, unknown>,
        updatedAt: now,
      };

      const upsert = async (patch: Partial<typeof skoolMemberships.$inferInsert>) => {
        await db
          .insert(skoolMemberships)
          .values({ ...base, ...patch })
          .onConflictDoUpdate({
            target: [skoolMemberships.partnerId, skoolMemberships.groupId],
            set: { ...base, ...patch },
          });
      };

      if (member.status === "removed") {
        // Expulsado del grupo: congelar de inmediato, sin gracia.
        await upsert({ accessExpiresAt: now, alertState: "frozen_auto" });
        if (partner.status === "active" && (await tryFreeze(partner.id))) {
          await audit(partner.id, "partner_frozen_auto", { reason: "removed" });
          result.frozen++;
        }
        continue;
      }

      if (!cancelled) {
        // Miembro sano. Si estaba congelado POR el sync (renovó), reactivar.
        await upsert({ accessExpiresAt: null, alertState: "none" });
        if (partner.status === "frozen" && existing?.alertState === "frozen_auto") {
          await unfreezePartner(partner.id, { adminEmail: SYSTEM_ACTOR });
          await audit(partner.id, "partner_unfrozen_auto", { reason: "renewed" });
          result.unfrozen++;
        }
        continue;
      }

      // Cancelación detectada. Fecha de pérdida de acceso: fin de periodo, o
      // plan B (detección + gracia) FIJADA una sola vez — nunca se re-extiende.
      const accessExpiresAt =
        base.currentPeriodEndsAt ??
        existing?.accessExpiresAt ??
        new Date(now.getTime() + membershipGraceDays() * 86_400_000);
      const daysLeft = wholeDaysUntil(now, accessExpiresAt);

      if (accessExpiresAt <= now) {
        await upsert({ accessExpiresAt, alertState: "frozen_auto" });
        if (partner.status === "active" && (await tryFreeze(partner.id))) {
          await audit(partner.id, "partner_frozen_auto", { reason: "expired" });
          result.frozen++;
        }
      } else if (
        daysLeft <= ALERT_WINDOW_DAYS &&
        (existing?.alertState ?? "none") === "none"
      ) {
        await upsert({ accessExpiresAt, alertState: "expiring_notified" });
        await audit(partner.id, "membership_expiring", { daysLeft });
        result.notified++;
      } else {
        await upsert({
          accessExpiresAt,
          alertState: existing?.alertState ?? "none",
        });
      }
    } catch (err) {
      // Un partner problemático no aborta el run completo.
      logger.error("membership-sync: partner failed", {
        partnerId: partner.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info("membership-sync: run finished", { ...result });
  return result;
}
