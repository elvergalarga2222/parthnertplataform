import type { Member, MembershipProvider } from "./membership-provider";

// Proveedor para desarrollo local sin acceso a Skool: los miembros "activos"
// se declaran en DEV_MEMBER_EMAILS (separados por coma). Nunca usar en
// producción — la factory lo bloquea fuera de development.
export class DevMembershipProvider implements MembershipProvider {
  private members: Member[];

  constructor(emails: string[]) {
    this.members = emails.map((email, i) => ({
      externalId: `dev_${i + 1}`,
      email: email.trim().toLowerCase(),
      displayName: email.split("@")[0],
      status: "active" as const,
    }));
  }

  async findMemberByEmail(email: string): Promise<Member | null> {
    return (
      this.members.find((m) => m.email === email.trim().toLowerCase()) ?? null
    );
  }

  async listActiveMembers(): Promise<Member[]> {
    return this.members;
  }
}
