import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accessAuditLog, partners } from "@/db/schema";
import { getMembershipProvider } from "./providers";
import { createSession, getSessionPartnerId } from "./session";

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
    throw new LoginError(
      "frozen",
      "Tu acceso está congelado. Contacta al administrador de la comunidad.",
    );
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
