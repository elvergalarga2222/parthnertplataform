"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentPartner } from "@/modules/auth/service";
import {
  CrmError,
  createCompany,
  createContact,
  createCustomField,
  createDeal,
  createStage,
  deleteCustomField,
  deleteDeal,
  deleteStage,
  moveDealStage,
  reorderStages,
  setCustomFieldValue,
  updateDeal,
  updateStage,
} from "./service";
import { FIELD_TYPES, FIT_LEVELS, STAGE_COLOR_NAMES } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requirePartnerId(): Promise<string> {
  const partner = await getCurrentPartner();
  if (!partner) throw new CrmError("Sesión no válida.");
  return partner.id;
}

async function run(fn: (partnerId: string) => Promise<void>): Promise<ActionResult> {
  try {
    const partnerId = await requirePartnerId();
    await fn(partnerId);
    revalidatePath("/clientes");
    return { ok: true };
  } catch (err) {
    if (err instanceof CrmError) return { ok: false, error: err.message };
    console.error("CRM action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Stages

const stageSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
  color: z.enum(STAGE_COLOR_NAMES),
});

export async function createStageAction(
  input: z.input<typeof stageSchema>,
): Promise<ActionResult> {
  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return run(async (partnerId) => {
    await createStage(partnerId, parsed.data);
  });
}

const stagePatchSchema = stageSchema.partial().extend({
  stageId: z.string().uuid(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

export async function updateStageAction(
  input: z.input<typeof stagePatchSchema>,
): Promise<ActionResult> {
  const parsed = stagePatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { stageId, ...patch } = parsed.data;
  return run((partnerId) => updateStage(partnerId, stageId, patch));
}

export async function reorderStagesAction(
  orderedIds: string[],
): Promise<ActionResult> {
  const parsed = z.array(z.string().uuid()).min(1).safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: "Orden inválido." };
  return run((partnerId) => reorderStages(partnerId, parsed.data));
}

export async function deleteStageAction(stageId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(stageId);
  if (!parsed.success) return { ok: false, error: "Etapa inválida." };
  return run((partnerId) => deleteStage(partnerId, parsed.data));
}

// ---------------------------------------------------------------------------
// Deals

// `.datetime()` no acota el año: Postgres acepta hasta el año 294276 pero
// JavaScript devuelve Invalid Date fuera de su rango, y esa fila envenena el
// render de /clientes para siempre (RangeError al serializar). Rango útil de
// negocio: [1970, 2100].
const safeActivityAt = z
  .string()
  .datetime()
  .refine((value) => {
    const year = new Date(value).getUTCFullYear();
    return year >= 1970 && year <= 2100;
  }, "La fecha no es válida.");

const dealSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(120),
  value: z.number().min(0),
  stageId: z.string().uuid(),
  companyId: z.string().uuid().nullish(),
  contactId: z.string().uuid().nullish(),
  fit: z.enum(FIT_LEVELS).nullish(),
  nextActivity: z.string().trim().max(160).nullish(),
  nextActivityAt: safeActivityAt.nullish(),
  newCompanyName: z.string().trim().max(80).nullish(),
  newContactName: z.string().trim().max(80).nullish(),
});

export async function createDealAction(
  input: z.input<typeof dealSchema>,
): Promise<ActionResult> {
  const parsed = dealSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;
  return run(async (partnerId) => {
    let companyId = data.companyId ?? null;
    if (!companyId && data.newCompanyName) {
      companyId = await createCompany(partnerId, data.newCompanyName);
    }
    let contactId = data.contactId ?? null;
    if (!contactId && data.newContactName) {
      contactId = await createContact(partnerId, {
        fullName: data.newContactName,
        companyId,
      });
    }
    await createDeal(partnerId, {
      title: data.title,
      value: data.value,
      stageId: data.stageId,
      companyId,
      contactId,
      fit: data.fit ?? null,
      nextActivity: data.nextActivity ?? null,
      nextActivityAt: data.nextActivityAt ? new Date(data.nextActivityAt) : null,
    });
  });
}

const dealPatchSchema = z.object({
  dealId: z.string().uuid(),
  title: z.string().trim().min(1).max(120).optional(),
  value: z.number().min(0).optional(),
  fit: z.enum(FIT_LEVELS).nullish(),
  nextActivity: z.string().trim().max(160).nullish(),
  nextActivityAt: safeActivityAt.nullish(),
});

export async function updateDealAction(
  input: z.input<typeof dealPatchSchema>,
): Promise<ActionResult> {
  const parsed = dealPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { dealId, nextActivityAt, ...rest } = parsed.data;
  return run((partnerId) =>
    updateDeal(partnerId, dealId, {
      ...rest,
      ...(nextActivityAt !== undefined
        ? { nextActivityAt: nextActivityAt ? new Date(nextActivityAt) : null }
        : {}),
    }),
  );
}

export async function deleteDealAction(dealId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(dealId);
  if (!parsed.success) return { ok: false, error: "Deal inválido." };
  return run((partnerId) => deleteDeal(partnerId, parsed.data));
}

const moveSchema = z.object({
  dealId: z.string().uuid(),
  stageId: z.string().uuid(),
  position: z.number().int().min(0),
});

export async function moveDealAction(
  input: z.input<typeof moveSchema>,
): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimiento inválido." };
  return run((partnerId) =>
    moveDealStage(partnerId, parsed.data.dealId, parsed.data.stageId, parsed.data.position),
  );
}

// ---------------------------------------------------------------------------
// Custom fields

const fieldSchema = z.object({
  label: z.string().trim().min(1, "El nombre es obligatorio.").max(60),
  fieldType: z.enum(FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(60)).max(20).nullish(),
});

export async function createCustomFieldAction(
  input: z.input<typeof fieldSchema>,
): Promise<ActionResult> {
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  return run(async (partnerId) => {
    await createCustomField(partnerId, {
      entity: "deal",
      label: parsed.data.label,
      fieldType: parsed.data.fieldType,
      options: parsed.data.options ?? null,
    });
  });
}

export async function deleteCustomFieldAction(
  fieldId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(fieldId);
  if (!parsed.success) return { ok: false, error: "Campo inválido." };
  return run((partnerId) => deleteCustomField(partnerId, parsed.data));
}

const valueSchema = z.object({
  fieldId: z.string().uuid(),
  entityId: z.string().uuid(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export async function setCustomFieldValueAction(
  input: z.input<typeof valueSchema>,
): Promise<ActionResult> {
  const parsed = valueSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Valor inválido." };
  return run((partnerId) =>
    setCustomFieldValue(partnerId, parsed.data.fieldId, parsed.data.entityId, parsed.data.value),
  );
}
