import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthService, SESSION_COOKIE } from "./index";
import type { PartnerRecord } from "./partner-repo";

/**
 * Guard para páginas y acciones protegidas: valida la sesión contra Redis en
 * cada request (revocación efectiva al siguiente request). Redirige a /login
 * si no hay sesión válida o el partner está congelado.
 */
export async function requirePartner(): Promise<PartnerRecord> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    redirect("/login");
  }
  const partner = await getAuthService().getSessionPartner(sessionId);
  if (!partner) {
    redirect("/login");
  }
  return partner;
}
