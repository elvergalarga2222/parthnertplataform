import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { accessAuditLog, partners, skoolMemberships } from "@/db/schema";
import type { Member } from "./membership-provider";

export interface PartnerRecord {
  id: string;
  skoolMemberId: string;
  email: string;
  displayName: string | null;
  status: string;
}

export type AuditEvent =
  | "login"
  | "denied"
  | "revoked_webhook"
  | "revoked_polling"
  | "frozen"
  | "reactivated";

export interface PartnerRepo {
  findBySkoolMemberId(skoolMemberId: string): Promise<PartnerRecord | null>;
  findById(id: string): Promise<PartnerRecord | null>;
  listActive(): Promise<PartnerRecord[]>;
  /** Crea o actualiza el partner + su membresía a partir del miembro de Skool. */
  upsertFromMember(member: Member, groupId: string): Promise<PartnerRecord>;
  freeze(partnerId: string): Promise<void>;
  reactivate(partnerId: string): Promise<void>;
  audit(event: AuditEvent, partnerId: string | null, detail?: unknown): Promise<void>;
}

export class DrizzlePartnerRepo implements PartnerRepo {
  constructor(private db: Db) {}

  async findBySkoolMemberId(skoolMemberId: string) {
    const rows = await this.db
      .select()
      .from(partners)
      .where(eq(partners.skoolMemberId, skoolMemberId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(partners)
      .where(eq(partners.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listActive() {
    return this.db
      .select()
      .from(partners)
      .where(eq(partners.status, "active"));
  }

  async upsertFromMember(member: Member, groupId: string) {
    const [partner] = await this.db
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

    await this.db
      .insert(skoolMemberships)
      .values({
        partnerId: partner.id,
        groupId,
        membershipStatus: member.status,
        lastVerifiedAt: new Date(),
        rawPayload: member,
      });

    return partner;
  }

  async freeze(partnerId: string) {
    await this.db
      .update(partners)
      .set({ status: "frozen", frozenAt: new Date(), updatedAt: new Date() })
      .where(eq(partners.id, partnerId));
  }

  async reactivate(partnerId: string) {
    await this.db
      .update(partners)
      .set({ status: "active", frozenAt: null, updatedAt: new Date() })
      .where(eq(partners.id, partnerId));
  }

  async audit(event: AuditEvent, partnerId: string | null, detail?: unknown) {
    await this.db.insert(accessAuditLog).values({
      event,
      partnerId,
      detail: detail ?? null,
    });
  }
}
