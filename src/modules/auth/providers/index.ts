import type { MembershipProvider } from "../membership-provider";
import { DevMembershipProvider } from "./dev-provider";
import { OpenMembershipProvider } from "./open-provider";
import { SkoolMembershipProvider } from "./skool-provider";

/**
 * Resuelve el provider de membresía según el entorno:
 *  1. Skool real, si SKOOL_API_KEY + SKOOL_GROUP_ID están configuradas.
 *  2. Lista fija (AUTH_DEV_EMAILS), si se define — útil para restringir a unos correos.
 *  3. Login abierto: cualquier correo válido entra (modo por defecto mientras
 *     Skool no esté integrado — riesgo #1). Fácil de reemplazar por Skool luego.
 */
export function getMembershipProvider(): MembershipProvider {
  const apiKey = process.env.SKOOL_API_KEY;
  const groupId = process.env.SKOOL_GROUP_ID;

  if (apiKey && groupId) {
    return new SkoolMembershipProvider(apiKey, groupId);
  }

  const devEmails = process.env.AUTH_DEV_EMAILS;
  if (devEmails) {
    return new DevMembershipProvider(
      devEmails.split(",").map((e) => e.trim()).filter(Boolean),
    );
  }

  return new OpenMembershipProvider();
}
