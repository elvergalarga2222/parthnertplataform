import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  contacts,
  customFieldValues,
  customFields,
  dealActivity,
  deals,
  pipelineStages,
} from "@/db/schema";
import { toIsoOrEpoch, toIsoOrNull } from "@/lib/dates";
import { hasBrief, isNewClient, slugifyFieldKey } from "./helpers";
import type { ClientKey } from "./helpers";
import type {
  CrmSnapshot,
  CustomFieldView,
  DealActivityView,
  DealView,
  FieldType,
  FitLevel,
  StageColorName,
  StageView,
} from "./types";

// Multi-tenant rule (CLAUDE.md #3): every query in this module filters by
// partnerId. No function may touch a row whose partner_id differs from the
// caller's — cross-partner ids are treated as "not found".

export class CrmError extends Error {}

const DEFAULT_STAGES: {
  name: string;
  color: StageColorName;
  isWon?: boolean;
  requiresBrief?: boolean;
}[] = [
  { name: "Descubrimiento", color: "purple" },
  // Para avanzar de Descubrimiento a Propuesta, un cliente nuevo necesita
  // brief. Solo aplica a pipelines creados desde cero (partners nuevos).
  { name: "Propuesta", color: "violet", requiresBrief: true },
  { name: "Negociación", color: "teal" },
  { name: "Cerrado Ganado", color: "green", isWon: true },
];

/** Creates the default pipeline the first time a partner opens the module. */
export async function ensureDefaultStages(partnerId: string): Promise<void> {
  const existing = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.partnerId, partnerId))
    .limit(1);
  if (existing.length > 0) return;

  await db.insert(pipelineStages).values(
    DEFAULT_STAGES.map((stage, i) => ({
      partnerId,
      name: stage.name,
      color: stage.color,
      position: i,
      isWon: stage.isWon ?? false,
      requiresBrief: stage.requiresBrief ?? false,
    })),
  );
}

function toStageView(row: typeof pipelineStages.$inferSelect): StageView {
  return {
    id: row.id,
    name: row.name,
    color: row.color as StageColorName,
    position: row.position,
    isWon: row.isWon,
    isLost: row.isLost,
    requiresBrief: row.requiresBrief,
  };
}

/**
 * Deals del partner en etapas ganadas — la base para decidir si un cliente es
 * nuevo (helpers.isNewClient). Un solo query, sin N+1.
 */
async function getWonDeals(
  tx: Pick<typeof db, "select">,
  partnerId: string,
): Promise<ClientKey[]> {
  return tx
    .select({
      id: deals.id,
      companyId: deals.companyId,
      contactId: deals.contactId,
    })
    .from(deals)
    .innerJoin(pipelineStages, eq(deals.stageId, pipelineStages.id))
    .where(and(eq(deals.partnerId, partnerId), eq(pipelineStages.isWon, true)));
}

/** Gate de brief: lanza si un cliente nuevo sin brief intenta entrar a la etapa. */
async function assertBriefGate(
  tx: Pick<typeof db, "select">,
  partnerId: string,
  targetStage: { requiresBrief: boolean },
  deal: ClientKey & { brief: string | null },
): Promise<void> {
  if (!targetStage.requiresBrief || hasBrief(deal.brief)) return;
  const wonDeals = await getWonDeals(tx, partnerId);
  if (isNewClient(deal, wonDeals)) {
    throw new CrmError(
      "Este cliente es nuevo: completa el diagnóstico/brief del deal antes de pasarlo a esta etapa.",
    );
  }
}

export async function getCrmSnapshot(partnerId: string): Promise<CrmSnapshot> {
  const stageRows = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.partnerId, partnerId))
    .orderBy(asc(pipelineStages.position), asc(pipelineStages.createdAt));

  const dealRows = await db
    .select({
      deal: deals,
      companyName: companies.name,
      contactName: contacts.fullName,
    })
    .from(deals)
    .leftJoin(companies, eq(deals.companyId, companies.id))
    .leftJoin(contacts, eq(deals.contactId, contacts.id))
    .where(eq(deals.partnerId, partnerId))
    .orderBy(asc(deals.position), asc(deals.createdAt));

  const fieldRows = await db
    .select()
    .from(customFields)
    .where(
      and(eq(customFields.partnerId, partnerId), eq(customFields.entity, "deal")),
    )
    .orderBy(asc(customFields.position), asc(customFields.createdAt));

  const fieldIds = fieldRows.map((f) => f.id);
  const valueRows = fieldIds.length
    ? await db
        .select()
        .from(customFieldValues)
        .where(inArray(customFieldValues.customFieldId, fieldIds))
    : [];

  const valuesByDeal = new Map<string, Record<string, unknown>>();
  for (const row of valueRows) {
    const entry = valuesByDeal.get(row.entityId) ?? {};
    entry[row.customFieldId] = row.value;
    valuesByDeal.set(row.entityId, entry);
  }

  const companyRows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.partnerId, partnerId))
    .orderBy(asc(companies.name));

  const contactRows = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      companyId: contacts.companyId,
    })
    .from(contacts)
    .where(eq(contacts.partnerId, partnerId))
    .orderBy(asc(contacts.fullName));

  // Flags del gate de brief sin N+1: los deals ganados ya están en dealRows.
  const wonStageIds = new Set(stageRows.filter((s) => s.isWon).map((s) => s.id));
  const wonDeals: ClientKey[] = dealRows
    .filter(({ deal }) => wonStageIds.has(deal.stageId))
    .map(({ deal }) => ({
      id: deal.id,
      companyId: deal.companyId,
      contactId: deal.contactId,
    }));

  return {
    stages: stageRows.map(toStageView),
    deals: dealRows.map(({ deal, companyName, contactName }): DealView => ({
      id: deal.id,
      title: deal.title,
      value: Number(deal.value),
      currency: deal.currency,
      stageId: deal.stageId,
      position: deal.position,
      nextActivity: deal.nextActivity,
      nextActivityAt: toIsoOrNull(deal.nextActivityAt),
      fit: (deal.fit as FitLevel | null) ?? null,
      companyId: deal.companyId,
      companyName,
      contactId: deal.contactId,
      contactName,
      createdAt: toIsoOrEpoch(deal.createdAt),
      brief: deal.brief,
      isNewClient: isNewClient(deal, wonDeals),
      custom: valuesByDeal.get(deal.id) ?? {},
    })),
    customFields: fieldRows.map(
      (f): CustomFieldView => ({
        id: f.id,
        entity: f.entity as CustomFieldView["entity"],
        fieldKey: f.fieldKey,
        label: f.label,
        fieldType: f.fieldType as FieldType,
        options: (f.options as string[] | null) ?? null,
        position: f.position,
      }),
    ),
    companies: companyRows,
    contacts: contactRows,
  };
}

// ---------------------------------------------------------------------------
// Stages

export async function createStage(
  partnerId: string,
  input: { name: string; color: StageColorName },
): Promise<StageView> {
  const existing = await db
    .select({ position: pipelineStages.position })
    .from(pipelineStages)
    .where(eq(pipelineStages.partnerId, partnerId));
  const nextPosition =
    existing.reduce((max, s) => Math.max(max, s.position), -1) + 1;

  const [row] = await db
    .insert(pipelineStages)
    .values({ partnerId, name: input.name, color: input.color, position: nextPosition })
    .returning();
  return toStageView(row);
}

export async function updateStage(
  partnerId: string,
  stageId: string,
  patch: {
    name?: string;
    color?: StageColorName;
    isWon?: boolean;
    isLost?: boolean;
    requiresBrief?: boolean;
  },
): Promise<void> {
  const result = await db
    .update(pipelineStages)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(pipelineStages.id, stageId), eq(pipelineStages.partnerId, partnerId)),
    )
    .returning({ id: pipelineStages.id });
  if (result.length === 0) throw new CrmError("Etapa no encontrada.");
}

/** Reorders stages to match the given id order. Ids must be the partner's. */
export async function reorderStages(
  partnerId: string,
  orderedIds: string[],
): Promise<void> {
  const rows = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.partnerId, partnerId));
  const owned = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
    throw new CrmError("El orden de etapas no coincide con tus etapas.");
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(pipelineStages)
        .set({ position: i, updatedAt: new Date() })
        .where(
          and(
            eq(pipelineStages.id, orderedIds[i]),
            eq(pipelineStages.partnerId, partnerId),
          ),
        );
    }
  });
}

/**
 * Deletes a stage. Its deals are moved to the first remaining stage; deleting
 * the last stage is rejected.
 */
export async function deleteStage(
  partnerId: string,
  stageId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const stages = await tx
      .select({ id: pipelineStages.id, position: pipelineStages.position })
      .from(pipelineStages)
      .where(eq(pipelineStages.partnerId, partnerId))
      .orderBy(asc(pipelineStages.position));

    if (!stages.some((s) => s.id === stageId)) {
      throw new CrmError("Etapa no encontrada.");
    }
    const remaining = stages.filter((s) => s.id !== stageId);
    if (remaining.length === 0) {
      throw new CrmError("No puedes eliminar la única etapa del pipeline.");
    }

    const fallback = remaining[0];
    await tx
      .update(deals)
      .set({ stageId: fallback.id, updatedAt: new Date() })
      .where(and(eq(deals.stageId, stageId), eq(deals.partnerId, partnerId)));

    await tx.delete(pipelineStages).where(eq(pipelineStages.id, stageId));

    for (let i = 0; i < remaining.length; i++) {
      await tx
        .update(pipelineStages)
        .set({ position: i })
        .where(eq(pipelineStages.id, remaining[i].id));
    }
  });
}

// ---------------------------------------------------------------------------
// Deals

async function requireStage(
  tx: Pick<typeof db, "select">,
  partnerId: string,
  stageId: string,
) {
  const [stage] = await tx
    .select()
    .from(pipelineStages)
    .where(
      and(eq(pipelineStages.id, stageId), eq(pipelineStages.partnerId, partnerId)),
    );
  if (!stage) throw new CrmError("Etapa no encontrada.");
  return stage;
}

export async function createDeal(
  partnerId: string,
  input: {
    title: string;
    value: number;
    stageId: string;
    companyId?: string | null;
    contactId?: string | null;
    fit?: FitLevel | null;
    nextActivity?: string | null;
    nextActivityAt?: Date | null;
    brief?: string | null;
  },
): Promise<string> {
  return db.transaction(async (tx) => {
    const stage = await requireStage(tx, partnerId, input.stageId);
    // El gate también aplica al crear directamente en una etapa con brief
    // requerido (no entrar por la puerta de atrás).
    await assertBriefGate(tx, partnerId, stage, {
      id: "",
      companyId: input.companyId ?? null,
      contactId: input.contactId ?? null,
      brief: input.brief ?? null,
    });

    const siblings = await tx
      .select({ position: deals.position })
      .from(deals)
      .where(and(eq(deals.stageId, input.stageId), eq(deals.partnerId, partnerId)));
    const nextPosition =
      siblings.reduce((max, d) => Math.max(max, d.position), -1) + 1;

    const [row] = await tx
      .insert(deals)
      .values({
        partnerId,
        title: input.title,
        value: String(input.value),
        stageId: input.stageId,
        companyId: input.companyId ?? null,
        contactId: input.contactId ?? null,
        fit: input.fit ?? null,
        nextActivity: input.nextActivity ?? null,
        nextActivityAt: input.nextActivityAt ?? null,
        brief: input.brief ?? null,
        position: nextPosition,
      })
      .returning({ id: deals.id });

    await tx.insert(dealActivity).values({
      dealId: row.id,
      type: "created",
      description: "Deal creado",
    });
    return row.id;
  });
}

export async function updateDeal(
  partnerId: string,
  dealId: string,
  patch: {
    title?: string;
    value?: number;
    fit?: FitLevel | null;
    nextActivity?: string | null;
    nextActivityAt?: Date | null;
    companyId?: string | null;
    contactId?: string | null;
    brief?: string | null;
  },
): Promise<void> {
  const { value, ...rest } = patch;
  const result = await db
    .update(deals)
    .set({
      ...rest,
      ...(value !== undefined ? { value: String(value) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(deals.id, dealId), eq(deals.partnerId, partnerId)))
    .returning({ id: deals.id });
  if (result.length === 0) throw new CrmError("Deal no encontrado.");
}

export async function deleteDeal(
  partnerId: string,
  dealId: string,
): Promise<void> {
  const result = await db
    .delete(deals)
    .where(and(eq(deals.id, dealId), eq(deals.partnerId, partnerId)))
    .returning({ id: deals.id });
  if (result.length === 0) throw new CrmError("Deal no encontrado.");
}

/**
 * Moves a deal to a stage/position and renormalizes positions of the affected
 * columns. Logs a stage_change activity when the stage actually changes.
 */
export async function moveDealStage(
  partnerId: string,
  dealId: string,
  newStageId: string,
  newPosition: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [deal] = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.partnerId, partnerId)));
    if (!deal) throw new CrmError("Deal no encontrado.");

    const targetStage = await requireStage(tx, partnerId, newStageId);
    // Único punto de enforcement del gate de brief para clientes nuevos.
    if (deal.stageId !== newStageId) {
      await assertBriefGate(tx, partnerId, targetStage, deal);
    }
    const sourceStageId = deal.stageId;

    const targetRows = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.stageId, newStageId), eq(deals.partnerId, partnerId)))
      .orderBy(asc(deals.position), asc(deals.createdAt));

    const targetIds = targetRows.map((r) => r.id).filter((id) => id !== dealId);
    const clamped = Math.max(0, Math.min(newPosition, targetIds.length));
    targetIds.splice(clamped, 0, dealId);

    for (let i = 0; i < targetIds.length; i++) {
      await tx
        .update(deals)
        .set(
          targetIds[i] === dealId
            ? { position: i, stageId: newStageId, updatedAt: new Date() }
            : { position: i },
        )
        .where(eq(deals.id, targetIds[i]));
    }

    if (sourceStageId !== newStageId) {
      const sourceRows = await tx
        .select({ id: deals.id })
        .from(deals)
        .where(
          and(eq(deals.stageId, sourceStageId), eq(deals.partnerId, partnerId)),
        )
        .orderBy(asc(deals.position), asc(deals.createdAt));
      for (let i = 0; i < sourceRows.length; i++) {
        await tx
          .update(deals)
          .set({ position: i })
          .where(eq(deals.id, sourceRows[i].id));
      }

      await tx.insert(dealActivity).values({
        dealId,
        type: "stage_change",
        description: `Movido a ${targetStage.name}`,
      });
    }
  });
}

export async function getDealActivity(
  partnerId: string,
  dealId: string,
): Promise<DealActivityView[]> {
  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.partnerId, partnerId)));
  if (!deal) throw new CrmError("Deal no encontrado.");

  const rows = await db
    .select()
    .from(dealActivity)
    .where(eq(dealActivity.dealId, dealId))
    .orderBy(asc(dealActivity.createdAt));
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    createdAt: toIsoOrEpoch(r.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Companies & contacts (quick create for the deal form)

export async function createCompany(
  partnerId: string,
  name: string,
): Promise<string> {
  const [row] = await db
    .insert(companies)
    .values({ partnerId, name })
    .returning({ id: companies.id });
  return row.id;
}

export async function createContact(
  partnerId: string,
  input: { fullName: string; companyId?: string | null; email?: string | null },
): Promise<string> {
  const [row] = await db
    .insert(contacts)
    .values({
      partnerId,
      fullName: input.fullName,
      companyId: input.companyId ?? null,
      email: input.email ?? null,
    })
    .returning({ id: contacts.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Custom fields

export async function createCustomField(
  partnerId: string,
  input: {
    entity: "deal" | "contact" | "company";
    label: string;
    fieldType: FieldType;
    options?: string[] | null;
  },
): Promise<CustomFieldView> {
  const fieldKey = slugifyFieldKey(input.label);
  if (!fieldKey) throw new CrmError("El nombre del campo no es válido.");

  const existing = await db
    .select({ position: customFields.position, fieldKey: customFields.fieldKey })
    .from(customFields)
    .where(
      and(eq(customFields.partnerId, partnerId), eq(customFields.entity, input.entity)),
    );
  if (existing.some((f) => f.fieldKey === fieldKey)) {
    throw new CrmError("Ya existe un campo con ese nombre.");
  }
  const nextPosition =
    existing.reduce((max, f) => Math.max(max, f.position), -1) + 1;

  const [row] = await db
    .insert(customFields)
    .values({
      partnerId,
      entity: input.entity,
      fieldKey,
      label: input.label,
      fieldType: input.fieldType,
      options: input.options ?? null,
      position: nextPosition,
    })
    .returning();

  return {
    id: row.id,
    entity: row.entity as CustomFieldView["entity"],
    fieldKey: row.fieldKey,
    label: row.label,
    fieldType: row.fieldType as FieldType,
    options: (row.options as string[] | null) ?? null,
    position: row.position,
  };
}

export async function deleteCustomField(
  partnerId: string,
  fieldId: string,
): Promise<void> {
  const result = await db
    .delete(customFields)
    .where(and(eq(customFields.id, fieldId), eq(customFields.partnerId, partnerId)))
    .returning({ id: customFields.id });
  if (result.length === 0) throw new CrmError("Campo no encontrado.");
}

export async function setCustomFieldValue(
  partnerId: string,
  fieldId: string,
  entityId: string,
  value: unknown,
): Promise<void> {
  const [field] = await db
    .select()
    .from(customFields)
    .where(and(eq(customFields.id, fieldId), eq(customFields.partnerId, partnerId)));
  if (!field) throw new CrmError("Campo no encontrado.");

  // The target entity must belong to the same partner.
  const table =
    field.entity === "deal" ? deals : field.entity === "contact" ? contacts : companies;
  const [entity] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), eq(table.partnerId, partnerId)));
  if (!entity) throw new CrmError("Registro no encontrado.");

  await db
    .insert(customFieldValues)
    .values({ customFieldId: fieldId, entityId, value })
    .onConflictDoUpdate({
      target: [customFieldValues.customFieldId, customFieldValues.entityId],
      set: { value, updatedAt: new Date() },
    });
}
