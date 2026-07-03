import type { MembershipProvider } from "./membership-provider";
import type { PartnerRecord, PartnerRepo } from "./partner-repo";
import type { SessionStore } from "./session-store";

export type LoginResult =
  | { ok: true; sessionId: string; partner: PartnerRecord }
  | { ok: false; reason: "not_member" | "inactive_member" };

export type RevocationSource = "webhook" | "polling";

export class AuthService {
  constructor(
    private deps: {
      provider: MembershipProvider;
      sessions: SessionStore;
      repo: PartnerRepo;
      groupId: string;
    },
  ) {}

  /**
   * Único punto de entrada al sistema (regla #1: no hay registro manual).
   * Valida la membresía activa en Skool, hace upsert del partner y crea la
   * sesión revocable. Si el partner estaba congelado y volvió a ser miembro
   * activo, se reactiva (congelar ≠ borrar).
   */
  async login(email: string): Promise<LoginResult> {
    const { provider, sessions, repo, groupId } = this.deps;

    const member = await provider.findMemberByEmail(email);
    if (!member) {
      await repo.audit("denied", null, { email, reason: "not_member" });
      return { ok: false, reason: "not_member" };
    }
    if (member.status !== "active") {
      await repo.audit("denied", null, { email, reason: "inactive_member" });
      return { ok: false, reason: "inactive_member" };
    }

    let partner = await repo.upsertFromMember(member, groupId);
    if (partner.status === "frozen") {
      await repo.reactivate(partner.id);
      await repo.audit("reactivated", partner.id);
      partner = { ...partner, status: "active" };
    }

    const sessionId = await sessions.create(partner.id);
    await repo.audit("login", partner.id);
    return { ok: true, sessionId, partner };
  }

  /**
   * Revocación inmediata: destruye todas las sesiones del partner y congela
   * sus datos (regla #2). Usada por el webhook de Skool y el job de polling.
   */
  async revokeBySkoolMemberId(
    skoolMemberId: string,
    source: RevocationSource,
  ): Promise<boolean> {
    const { sessions, repo } = this.deps;

    const partner = await repo.findBySkoolMemberId(skoolMemberId);
    if (!partner) {
      return false;
    }
    const destroyed = await sessions.destroyAllForPartner(partner.id);
    if (partner.status !== "frozen") {
      await repo.freeze(partner.id);
    }
    await repo.audit(
      source === "webhook" ? "revoked_webhook" : "revoked_polling",
      partner.id,
      { destroyedSessions: destroyed },
    );
    return true;
  }

  /**
   * Red de seguridad para webhooks perdidos: compara los partners activos
   * locales contra la lista de miembros activos de Skool y congela a los que
   * ya no aparecen. Devuelve cuántos se revocaron.
   */
  async reconcile(): Promise<number> {
    const { provider, repo } = this.deps;

    const [activeMembers, activePartners] = await Promise.all([
      provider.listActiveMembers(),
      repo.listActive(),
    ]);
    const activeIds = new Set(activeMembers.map((m) => m.externalId));

    let revoked = 0;
    for (const partner of activePartners) {
      if (!activeIds.has(partner.skoolMemberId)) {
        await this.revokeBySkoolMemberId(partner.skoolMemberId, "polling");
        revoked++;
      }
    }
    return revoked;
  }

  /** Resuelve la sesión a un partner activo; null = 401. */
  async getSessionPartner(sessionId: string): Promise<PartnerRecord | null> {
    const { sessions, repo } = this.deps;

    const partnerId = await sessions.getPartnerId(sessionId);
    if (!partnerId) {
      return null;
    }
    const partner = await repo.findById(partnerId);
    if (!partner || partner.status !== "active") {
      return null;
    }
    return partner;
  }

  async logout(sessionId: string): Promise<void> {
    await this.deps.sessions.destroy(sessionId);
  }
}
