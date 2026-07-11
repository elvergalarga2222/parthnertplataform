import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accessAuditLog, partners, skoolMemberships } from "@/db/schema";
import { toIsoOrNull } from "@/lib/dates";
import { isAdminEmail } from "./admin";
import { getMembershipProvider } from "./providers";
import { createSession, getSessionPartnerId, revokeAllSessions } from "./session";

export type LoginErrorCode = "not_member" | "frozen";

export class LoginError extends Error {
  constructor(
    public readonly code: LoginErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LoginError";
  }
}

export type Partner = typeof partners.$inferSelect;

/**
 * Login por email contra la membresía de Skool. No hay registro manual (regla
 * #1): si el email no corresponde a un miembro activo, se rechaza. Crea/actualiza
 * el Partner, registra la auditoría y abre una sesión en Redis.
 */
export async function loginWithEmail(email: string): Promise<Partner> {
  const normalized = email.toLowerCase().trim();
  const provider = getMembershipProvider();
  const member = await provider.findMemberByEmail(normalized);

  if (!member || member.status !== "active") {
    throw new LoginError(
      "not_member",
      "No encontramos una membresía activa de Skool para este correo.",
    );
  }

  const [partner] = await db
    .insert(partners)
    .values({
      skoolMemberId: member.externalId,
      email: member.email,
      displayName: member.displayName,
      status: "active",
    })
    .onConflictDoUpdate({
      target: partners.skoolMemberId,
      set: {
        email: member.email,
        displayName: member.displayName,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Regla #2: congelar bloquea el acceso sin borrar datos.
  if (partner.status !== "active") {
    await db.insert(accessAuditLog).values({
      partnerId: partner.id,
      event: "login_blocked_frozen",
      detail: { email: normalized },
    });
    // Copy distinto si el congelamiento fue automático por vencimiento de
    // membresía (PR-10): la reactivación en ese caso es automática al renovar.
    const [membership] = await db
      .select({ alertState: skoolMemberships.alertState })
      .from(skoolMemberships)
      .where(eq(skoolMemberships.partnerId, partner.id));
    const message =
      membership?.alertState === "frozen_auto"
        ? "Tu membresía de Skool venció. Renueva y tu cuenta se reactivará automáticamente."
        : "Tu acceso está congelado. Contacta al administrador de la comunidad.";
    throw new LoginError("frozen", message);
  }

  await db.insert(accessAuditLog).values({
    partnerId: partner.id,
    event: "login",
    detail: { email: normalized },
  });

  await createSession(partner.id);
  return partner;
}

/**
 * Partner de la petición actual, o null. Revalida el estado en la BD en cada
 * request: si el partner fue congelado, se le niega el acceso al instante aunque
 * la sesión siga viva en Redis.
 */
export async function getCurrentPartner(): Promise<Partner | null> {
  const partnerId = await getSessionPartnerId();
  if (!partnerId) return null;

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  if (!partner || partner.status !== "active") return null;
  return partner;
}

// ---------------------------------------------------------------------------
// Congelamiento (regla #2: congelar bloquea el acceso, nunca borra datos)

export class AuthError extends Error {}

// ⚠️ CONTRATO PÚBLICO — no cambiar nombre, firma ni ubicación. PR-10 (job de
// sincronización de membresías Skool) invoca exactamente
// freezePartner(partnerId, { adminEmail: "system:membership-sync" }) y su
// inverso. `actor.adminEmail` es solo un identificador de auditoría — la
// autorización ocurre en la capa que llama (actions de admin / job); los
// valores `system:*` identifican procesos automáticos en access_audit_log.

export async function freezePartner(
  partnerId: string,
  actor: { adminEmail: string },
): Promise<void> {
  // Anti-lockout: jamás congelar una cuenta de operador (ADMIN_EMAILS).
  const [target] = await db
    .select({ email: partners.email })
    .from(partners)
    .where(eq(partners.id, partnerId));
  if (target && isAdminEmail(target.email)) {
    throw new AuthError("No se puede congelar a un administrador.");
  }

  const result = await db
    .update(partners)
    .set({ status: "frozen", frozenAt: new Date(), updatedAt: new Date() })
    .where(and(eq(partners.id, partnerId), eq(partners.status, "active")))
    .returning({ id: partners.id });
  if (result.length === 0) {
    throw new AuthError("Partner no encontrado o ya congelado.");
  }

  await db.insert(accessAuditLog).values({
    partnerId,
    event: "partner_frozen",
    detail: { by: actor.adminEmail },
  });
  await revokeAllSessions(partnerId);
}

/** Reactiva a un partner congelado. NO recrea sesiones: vuelve a loguearse. */
export async function unfreezePartner(
  partnerId: string,
  actor: { adminEmail: string },
): Promise<void> {
  const result = await db
    .update(partners)
    .set({ status: "active", frozenAt: null, updatedAt: new Date() })
    .where(and(eq(partners.id, partnerId), eq(partners.status, "frozen")))
    .returning({ id: partners.id });
  if (result.length === 0) {
    throw new AuthError("Partner no encontrado o no está congelado.");
  }

  await db.insert(accessAuditLog).values({
    partnerId,
    event: "partner_unfrozen",
    detail: { by: actor.adminEmail },
  });
}

// ---------------------------------------------------------------------------
// Alerta de vencimiento de membresía (PR-10)

export interface MembershipAlert {
  kind: "expiring";
  daysLeft: number;
  expiresAt: string;
}

const ALERT_WINDOW_DAYS = 15;

/**
 * Alerta in-app si la membresía Skool del partner vence en ≤15 días. Lee
 * skool_memberships (poblada por el job de sincronización); null si no hay
 * riesgo o no hay datos todavía.
 */
export async function getMembershipAlert(
  partnerId: string,
  now: Date = new Date(),
): Promise<MembershipAlert | null> {
  const [membership] = await db
    .select({ accessExpiresAt: skoolMemberships.accessExpiresAt })
    .from(skoolMemberships)
    .where(eq(skoolMemberships.partnerId, partnerId));
  if (!membership?.accessExpiresAt) return null;

  const daysLeft = Math.ceil(
    (membership.accessExpiresAt.getTime() - now.getTime()) / 86_400_000,
  );
  if (daysLeft < 0 || daysLeft > ALERT_WINDOW_DAYS) return null;

  return {
    kind: "expiring",
    daysLeft,
    expiresAt: toIsoOrNull(membership.accessExpiresAt) ?? "",
  };
}
