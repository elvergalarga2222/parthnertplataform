import type { Member, MembershipProvider } from "../membership-provider";

// Login simple: acepta cualquier correo válido como miembro activo. Es el modo
// por defecto mientras la API de Skool no esté integrada (riesgo #1). Cuando se
// configure Skool, el factory deja de usar este provider automáticamente.
export class OpenMembershipProvider implements MembershipProvider {
  async findMemberByEmail(email: string): Promise<Member | null> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) return null;
    return {
      externalId: `open_${normalized}`,
      email: normalized,
      displayName: normalized.split("@")[0],
      status: "active",
    };
  }

  async listActiveMembers(): Promise<Member[]> {
    // Sin catálogo de miembros en modo abierto (el polling de Skool no aplica).
    return [];
  }
}
