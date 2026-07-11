import { getCurrentActor, type Partner } from "./service";

// Autorización del OPERADOR de la plataforma (panel super admin). No existe
// rol en la base: la lista de emails de operador vive en la env ADMIN_EMAILS
// (separados por coma, case-insensitive). Fail closed: sin env ⇒ nadie es
// admin (mismo espíritu que el webhook de facturas).

/** Emails de operador desde ADMIN_EMAILS. Se lee en cada llamada (testeable). */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const admins = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

/**
 * Partner actual si además es operador; null en cualquier otro caso. Un
 * partner congelado nunca llega aquí (getCurrentActor ya devuelve null).
 *
 * Exige `collaborator === null` (PR-8): el panel /admin es exclusivo del
 * partner dueño de la cuenta operadora — si su email está en ADMIN_EMAILS,
 * eso NO debe filtrar a un colaborador suyo (alguien completamente distinto,
 * invitado por email) solo por compartir tenant.
 */
export async function getCurrentAdmin(): Promise<Partner | null> {
  const actor = await getCurrentActor();
  if (!actor || actor.collaborator !== null) return null;
  if (!isAdminEmail(actor.partner.email)) return null;
  return actor.partner;
}
