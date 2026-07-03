import { beforeEach, describe, expect, it } from "vitest";
import { AuthService } from "./auth-service";
import type { Member, MembershipProvider } from "./membership-provider";
import type { AuditEvent, PartnerRecord, PartnerRepo } from "./partner-repo";
import { MemorySessionStore } from "./session-store";

class FakeProvider implements MembershipProvider {
  constructor(public members: Member[]) {}

  async findMemberByEmail(email: string) {
    return this.members.find((m) => m.email === email) ?? null;
  }

  async listActiveMembers() {
    return this.members.filter((m) => m.status === "active");
  }
}

class FakeRepo implements PartnerRepo {
  partners = new Map<string, PartnerRecord>();
  auditLog: { event: AuditEvent; partnerId: string | null }[] = [];
  private seq = 0;

  async findBySkoolMemberId(skoolMemberId: string) {
    return (
      [...this.partners.values()].find(
        (p) => p.skoolMemberId === skoolMemberId,
      ) ?? null
    );
  }

  async findById(id: string) {
    return this.partners.get(id) ?? null;
  }

  async listActive() {
    return [...this.partners.values()].filter((p) => p.status === "active");
  }

  async upsertFromMember(member: Member) {
    const existing = await this.findBySkoolMemberId(member.externalId);
    if (existing) {
      existing.email = member.email;
      existing.displayName = member.displayName;
      return existing;
    }
    const partner: PartnerRecord = {
      id: `p_${++this.seq}`,
      skoolMemberId: member.externalId,
      email: member.email,
      displayName: member.displayName,
      status: "active",
    };
    this.partners.set(partner.id, partner);
    return partner;
  }

  async freeze(partnerId: string) {
    const p = this.partners.get(partnerId);
    if (p) p.status = "frozen";
  }

  async reactivate(partnerId: string) {
    const p = this.partners.get(partnerId);
    if (p) p.status = "active";
  }

  async audit(event: AuditEvent, partnerId: string | null) {
    this.auditLog.push({ event, partnerId });
  }
}

const activeMember: Member = {
  externalId: "sk_1",
  email: "partner@example.com",
  displayName: "Partner Uno",
  status: "active",
};

describe("AuthService", () => {
  let provider: FakeProvider;
  let repo: FakeRepo;
  let sessions: MemorySessionStore;
  let service: AuthService;

  beforeEach(() => {
    provider = new FakeProvider([activeMember]);
    repo = new FakeRepo();
    sessions = new MemorySessionStore();
    service = new AuthService({ provider, sessions, repo, groupId: "g1" });
  });

  it("denies login for non-members (no manual registration)", async () => {
    const result = await service.login("intruso@example.com");
    expect(result).toEqual({ ok: false, reason: "not_member" });
    expect(repo.auditLog).toContainEqual({ event: "denied", partnerId: null });
  });

  it("denies login for churned members", async () => {
    provider.members = [{ ...activeMember, status: "churned" }];
    const result = await service.login(activeMember.email);
    expect(result).toEqual({ ok: false, reason: "inactive_member" });
  });

  it("logs in an active member and creates a revocable session", async () => {
    const result = await service.login(activeMember.email);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const partner = await service.getSessionPartner(result.sessionId);
    expect(partner?.email).toBe(activeMember.email);
  });

  it("revocation destroys all sessions and freezes the partner", async () => {
    const login = await service.login(activeMember.email);
    if (!login.ok) throw new Error("login failed");

    const revoked = await service.revokeBySkoolMemberId("sk_1", "webhook");
    expect(revoked).toBe(true);
    expect(await service.getSessionPartner(login.sessionId)).toBeNull();
    expect((await repo.findById(login.partner.id))?.status).toBe("frozen");
    expect(repo.auditLog).toContainEqual({
      event: "revoked_webhook",
      partnerId: login.partner.id,
    });
  });

  it("reconcile freezes partners no longer active in Skool", async () => {
    await service.login(activeMember.email);
    provider.members = []; // el miembro desapareció de Skool
    const revoked = await service.reconcile();
    expect(revoked).toBe(1);
    const partner = await repo.findBySkoolMemberId("sk_1");
    expect(partner?.status).toBe("frozen");
  });

  it("reactivates a frozen partner who logs in with an active membership again", async () => {
    const first = await service.login(activeMember.email);
    if (!first.ok) throw new Error("login failed");
    await service.revokeBySkoolMemberId("sk_1", "polling");

    const second = await service.login(activeMember.email);
    expect(second.ok).toBe(true);
    expect((await repo.findById(first.partner.id))?.status).toBe("active");
    expect(repo.auditLog).toContainEqual({
      event: "reactivated",
      partnerId: first.partner.id,
    });
  });

  it("rejects sessions of frozen partners even if the session survived", async () => {
    const login = await service.login(activeMember.email);
    if (!login.ok) throw new Error("login failed");
    await repo.freeze(login.partner.id); // congelado sin destruir la sesión
    expect(await service.getSessionPartner(login.sessionId)).toBeNull();
  });
});
