import type { MembershipProvider } from "../membership-provider";
import { DevMembershipProvider } from "./dev-provider";
import { SkoolMembershipProvider } from "./skool-provider";

/**
 * Resuelve el provider de membresía según el entorno:
 *  1. Skool real, si SKOOL_API_KEY + SKOOL_GROUP_ID están configuradas.
 *  2. Provider de desarrollo, si AUTH_DEV_EMAILS está definida (solo pruebas).
 *  3. Error, si no hay forma de verificar membresías (no hay registro manual).
 */
export function getMembershipProvider(): MembershipProvider {
  const apiKey = process.env.SKOOL_API_KEY;
  const groupId = process.env.SKOOL_GROUP_ID;

  if (apiKey && groupId) {
    return new SkoolMembershipProvider(apiKey, groupId);
  }

  const devEmails = process.env.AUTH_DEV_EMAILS;
  if (devEmails) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[auth] AUTH_DEV_EMAILS activo en producción: el gating de Skool está " +
          "BYPASSEADO. Configura SKOOL_API_KEY + SKOOL_GROUP_ID y quita esta variable.",
      );
    }
    return new DevMembershipProvider(
      devEmails.split(",").map((e) => e.trim()).filter(Boolean),
    );
  }

  throw new Error(
    "No hay provider de membresía configurado: define SKOOL_API_KEY + SKOOL_GROUP_ID (producción) o AUTH_DEV_EMAILS (desarrollo).",
  );
}
