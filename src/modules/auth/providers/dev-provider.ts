import type { Member, MembershipProvider } from "../membership-provider";

// Provider de desarrollo: permite probar el flujo de login sin la API real de
// Skool (que aún no está validada — riesgo #1). Se activa cuando SKOOL_API_KEY
// no está configurada pero sí AUTH_DEV_EMAILS. NUNCA debe usarse en producción.
export class DevMembershipProvider implements MembershipProvider {
  private readonly members: Member[];

  constructor(emails: string[]) {
    this.members = emails.map((email, i) => ({
      externalId: `dev_${i + 1}`,
      email: email.toLowerCase().trim(),
      displayName: email.split("@")[0],
      status: "active",
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
    }));
  }

  async findMemberByEmail(email: string): Promise<Member | null> {
    return (
      this.members.find((m) => m.email === email.toLowerCase().trim()) ?? null
    );
  }

  async listActiveMembers(): Promise<Member[]> {
    return this.members.filter((m) => m.status === "active");
  }

  async listMembers(): Promise<Member[]> {
    return this.members;
  }
}
