import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  industries,
  leads,
  leadStageHistory,
  type LeadStage,
} from "@/db/schema";
import { validateTransition, type TransitionResult } from "./pipeline";

export interface NewLeadInput {
  industryId: number;
  businessName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  estimatedValue?: string | null;
  notes?: string | null;
}

export interface SobaUpdateInput {
  sobaSegment?: string | null;
  sobaOfferPointA?: string | null;
  sobaOfferPointB?: string | null;
  sobaVehicle?: string | null;
  sobaAttention?: string | null;
}

// Todas las operaciones filtran por partnerId (regla #3: aislamiento total).
// RLS en Postgres reforzará esto mismo a nivel de fila.
export class LeadService {
  constructor(private db: Db) {}

  async listIndustries() {
    return this.db
      .select()
      .from(industries)
      .where(eq(industries.isActive, true))
      .orderBy(asc(industries.name));
  }

  async listLeads(partnerId: string) {
    return this.db
      .select({
        lead: leads,
        industryName: industries.name,
      })
      .from(leads)
      .innerJoin(industries, eq(leads.industryId, industries.id))
      .where(eq(leads.partnerId, partnerId))
      .orderBy(desc(leads.updatedAt));
  }

  async getLead(partnerId: string, leadId: string) {
    const rows = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async createLead(partnerId: string, input: NewLeadInput) {
    const [lead] = await this.db
      .insert(leads)
      .values({ partnerId, ...input })
      .returning();
    await this.db.insert(leadStageHistory).values({
      leadId: lead.id,
      fromStage: null,
      toStage: "prospecto",
    });
    return lead;
  }

  async updateSobaFields(
    partnerId: string,
    leadId: string,
    input: SobaUpdateInput,
  ) {
    const [updated] = await this.db
      .update(leads)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)))
      .returning();
    return updated ?? null;
  }

  /** Aplica el gate SOBA/NOVA antes de mover el lead de etapa. */
  async changeStage(
    partnerId: string,
    leadId: string,
    to: LeadStage,
  ): Promise<TransitionResult | { allowed: false; reason: "not_found" }> {
    const lead = await this.getLead(partnerId, leadId);
    if (!lead) {
      return { allowed: false, reason: "not_found" };
    }

    const result = validateTransition(lead.stage as LeadStage, to, lead);
    if (!result.allowed) {
      return result;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(leads)
        .set({
          stage: to,
          updatedAt: new Date(),
          closedAt:
            to === "cerrado_ganado" || to === "cerrado_perdido"
              ? new Date()
              : null,
        })
        .where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)));
      await tx.insert(leadStageHistory).values({
        leadId,
        fromStage: lead.stage,
        toStage: to,
      });
    });

    return result;
  }
}
