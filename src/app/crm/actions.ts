"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { LEAD_STAGES } from "@/db/schema";
import { requirePartner } from "@/modules/auth/require-partner";
import { LeadService } from "@/modules/crm/lead-service";
import { SOBA_FIELD_LABELS } from "@/modules/crm/pipeline";

const newLeadSchema = z.object({
  industryId: z.coerce.number().int().positive("Selecciona una industria"),
  businessName: z.string().min(1, "El nombre del negocio es obligatorio"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  estimatedValue: z.string().optional(),
  notes: z.string().optional(),
});

const sobaSchema = z.object({
  leadId: z.string().uuid(),
  sobaSegment: z.string().optional(),
  sobaOfferPointA: z.string().optional(),
  sobaOfferPointB: z.string().optional(),
  sobaVehicle: z.enum(["consultoria", "asesoria_mensual"]).or(z.literal("")),
  sobaAttention: z.string().optional(),
});

const stageSchema = z.object({
  leadId: z.string().uuid(),
  to: z.enum(LEAD_STAGES),
});

function service() {
  return new LeadService(getDb());
}

export async function createLeadAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = newLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(
      `/crm/nuevo?error=${encodeURIComponent(parsed.error.issues[0].message)}`,
    );
  }
  const { industryId, businessName, ...rest } = parsed.data;
  const lead = await service().createLead(partner.id, {
    industryId,
    businessName,
    contactName: rest.contactName || null,
    contactEmail: rest.contactEmail || null,
    contactPhone: rest.contactPhone || null,
    estimatedValue: rest.estimatedValue || null,
    notes: rest.notes || null,
  });
  revalidatePath("/crm");
  redirect(`/crm/${lead.id}`);
}

export async function updateSobaAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = sobaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/crm");
  }
  const { leadId, sobaVehicle, ...fields } = parsed.data;
  await service().updateSobaFields(partner.id, leadId, {
    sobaSegment: fields.sobaSegment || null,
    sobaOfferPointA: fields.sobaOfferPointA || null,
    sobaOfferPointB: fields.sobaOfferPointB || null,
    sobaVehicle: sobaVehicle || null,
    sobaAttention: fields.sobaAttention || null,
  });
  revalidatePath(`/crm/${leadId}`);
  redirect(`/crm/${leadId}?saved=1`);
}

export async function changeStageAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/crm");
  }
  const { leadId, to } = parsed.data;
  const result = await service().changeStage(partner.id, leadId, to);

  if (!result.allowed && result.reason === "missing_fields") {
    const labels = result.missing
      .map((f) => SOBA_FIELD_LABELS[f])
      .join(" · ");
    redirect(
      `/crm/${leadId}?gate=${encodeURIComponent(
        `Para avanzar a "${to}" completa: ${labels}`,
      )}`,
    );
  }
  if (!result.allowed) {
    redirect(`/crm/${leadId}?gate=${encodeURIComponent("Transición no permitida")}`);
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${leadId}`);
  redirect(`/crm/${leadId}`);
}
