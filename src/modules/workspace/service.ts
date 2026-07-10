import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiGenerations,
  deals,
  kanbanCards,
  kanbanColumns,
  workspaceProfiles,
  workspaces,
} from "@/db/schema";
import { toIsoOrEpoch } from "@/lib/dates";
import type {
  WorkspaceCardView,
  WorkspaceColumnView,
  WorkspaceExport,
  WorkspaceExportGeneration,
  WorkspaceListItem,
  WorkspaceProfileView,
  WorkspaceSnapshot,
  WorkspaceStatus,
} from "./types";

// Same multi-tenant contract as the CRM module: every function scopes by
// partnerId and cross-partner ids behave as "not found".

export class WorkspaceError extends Error {}

async function requireWorkspace(partnerId: string, workspaceId: string) {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)));
  if (!ws) throw new WorkspaceError("Espacio de trabajo no encontrado.");
  return ws;
}

export async function getWorkspaces(
  partnerId: string,
): Promise<WorkspaceListItem[]> {
  const rows = await db
    .select({
      ws: workspaces,
      dealValue: deals.value,
      cardCount: sql<number>`(
        SELECT count(*)::int FROM kanban_cards kc WHERE kc.workspace_id = ${workspaces.id}
      )`,
      doneCount: sql<number>`(
        SELECT count(*)::int FROM kanban_cards kc
        JOIN kanban_columns kcol ON kcol.id = kc.column_id
        WHERE kc.workspace_id = ${workspaces.id} AND kcol.name = 'Hecho'
      )`,
    })
    .from(workspaces)
    .leftJoin(deals, eq(workspaces.dealId, deals.id))
    .where(eq(workspaces.partnerId, partnerId))
    .orderBy(asc(workspaces.createdAt));

  return rows.map(({ ws, dealValue, cardCount, doneCount }) => ({
    id: ws.id,
    clientName: ws.clientName,
    status: ws.status as WorkspaceStatus,
    dealId: ws.dealId,
    dealValue: dealValue === null ? null : Number(dealValue),
    createdAt: toIsoOrEpoch(ws.createdAt),
    cardCount,
    doneCount,
  }));
}

export async function getWorkspaceSnapshot(
  partnerId: string,
  workspaceId: string,
): Promise<WorkspaceSnapshot> {
  const ws = await requireWorkspace(partnerId, workspaceId);

  const columnRows = await db
    .select()
    .from(kanbanColumns)
    .where(eq(kanbanColumns.workspaceId, workspaceId))
    .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt));

  const cardRows = await db
    .select()
    .from(kanbanCards)
    .where(eq(kanbanCards.workspaceId, workspaceId))
    .orderBy(asc(kanbanCards.position), asc(kanbanCards.createdAt));

  let [profile] = await db
    .select()
    .from(workspaceProfiles)
    .where(eq(workspaceProfiles.workspaceId, workspaceId));
  if (!profile) {
    // Workspaces creados antes del trigger (o borrados a mano) no tienen ficha.
    [profile] = await db
      .insert(workspaceProfiles)
      .values({ workspaceId })
      .returning();
  }

  return {
    id: ws.id,
    clientName: ws.clientName,
    status: ws.status as WorkspaceStatus,
    dealId: ws.dealId,
    columns: columnRows.map(
      (c): WorkspaceColumnView => ({
        id: c.id,
        name: c.name,
        position: c.position,
        sopContent: c.sopContent,
      }),
    ),
    cards: cardRows.map(
      (c): WorkspaceCardView => ({
        id: c.id,
        columnId: c.columnId,
        title: c.title,
        description: c.description,
        assignee: c.assignee,
        dueDate: c.dueDate,
        position: c.position,
      }),
    ),
    profile: toProfileView(profile),
    latestStrategyGeneration: await getLatestStrategyGeneration(
      partnerId,
      workspaceId,
    ),
  };
}

function toProfileView(
  profile: typeof workspaceProfiles.$inferSelect,
): WorkspaceProfileView {
  return {
    businessName: profile.businessName,
    industry: profile.industry,
    contactEmail: profile.contactEmail,
    contactPhone: profile.contactPhone,
    notes: profile.notes,
    strategyDoc: profile.strategyDoc,
    extra: (profile.extra as Record<string, string>) ?? {},
  };
}

// El módulo workspace lee la TABLA ai_generations desde @/db/schema (precedente:
// finance lee deals) — no importa código del módulo ai.
async function getLatestStrategyGeneration(
  partnerId: string,
  workspaceId: string,
): Promise<{ outputText: string; createdAt: string } | null> {
  const [row] = await db
    .select({
      outputText: aiGenerations.outputText,
      createdAt: aiGenerations.createdAt,
    })
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.partnerId, partnerId),
        eq(aiGenerations.workspaceId, workspaceId),
        eq(aiGenerations.type, "estrategia"),
      ),
    )
    .orderBy(desc(aiGenerations.createdAt))
    .limit(1);
  if (!row?.outputText) return null;
  return { outputText: row.outputText, createdAt: toIsoOrEpoch(row.createdAt) };
}

/**
 * Todos los datos del documento exportable de un workspace en un solo objeto:
 * perfil + estrategia, plan de trabajo (columnas con SOP y tarjetas), deal de
 * origen y la última generación IA por tipo. Cross-tenant ⇒ "no encontrado".
 */
export async function getWorkspaceExportData(
  partnerId: string,
  workspaceId: string,
): Promise<WorkspaceExport> {
  const ws = await requireWorkspace(partnerId, workspaceId);

  const [columnRows, cardRows, profileRows, dealRows, generationRows] =
    await Promise.all([
      db
        .select()
        .from(kanbanColumns)
        .where(eq(kanbanColumns.workspaceId, workspaceId))
        .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt)),
      db
        .select()
        .from(kanbanCards)
        .where(eq(kanbanCards.workspaceId, workspaceId))
        .orderBy(asc(kanbanCards.position), asc(kanbanCards.createdAt)),
      db
        .select()
        .from(workspaceProfiles)
        .where(eq(workspaceProfiles.workspaceId, workspaceId)),
      ws.dealId
        ? db
            .select({ title: deals.title, value: deals.value, currency: deals.currency })
            .from(deals)
            .where(and(eq(deals.id, ws.dealId), eq(deals.partnerId, partnerId)))
        : Promise.resolve([]),
      db
        .select({
          type: aiGenerations.type,
          outputText: aiGenerations.outputText,
          createdAt: aiGenerations.createdAt,
        })
        .from(aiGenerations)
        .where(
          and(
            eq(aiGenerations.partnerId, partnerId),
            eq(aiGenerations.workspaceId, workspaceId),
          ),
        )
        .orderBy(desc(aiGenerations.createdAt))
        .limit(50),
    ]);

  // Última generación por tipo (el query ya viene ordenado desc).
  const latestByType = new Map<string, WorkspaceExportGeneration>();
  for (const g of generationRows) {
    if (!latestByType.has(g.type)) {
      latestByType.set(g.type, {
        type: g.type,
        outputText: g.outputText ?? "",
        createdAt: toIsoOrEpoch(g.createdAt),
      });
    }
  }

  const profile = profileRows[0];
  const [deal] = dealRows;
  return {
    id: ws.id,
    clientName: ws.clientName,
    status: ws.status as WorkspaceStatus,
    exportedAt: new Date().toISOString(),
    deal: deal
      ? { title: deal.title, value: Number(deal.value), currency: deal.currency }
      : null,
    profile: profile
      ? toProfileView(profile)
      : {
          businessName: null,
          industry: null,
          contactEmail: null,
          contactPhone: null,
          notes: null,
          strategyDoc: null,
          extra: {},
        },
    columns: columnRows.map((c) => ({
      name: c.name,
      sopContent: c.sopContent,
      cards: cardRows
        .filter((card) => card.columnId === c.id)
        .map((card) => ({
          title: card.title,
          description: card.description,
          assignee: card.assignee,
          dueDate: card.dueDate,
        })),
    })),
    latestGenerations: Array.from(latestByType.values()),
  };
}

export async function updateWorkspaceStatus(
  partnerId: string,
  workspaceId: string,
  status: WorkspaceStatus,
): Promise<void> {
  const result = await db
    .update(workspaces)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)))
    .returning({ id: workspaces.id });
  if (result.length === 0) throw new WorkspaceError("Espacio de trabajo no encontrado.");
}

export async function updateWorkspaceProfile(
  partnerId: string,
  workspaceId: string,
  patch: Partial<WorkspaceProfileView>,
): Promise<void> {
  await requireWorkspace(partnerId, workspaceId);
  await db
    .insert(workspaceProfiles)
    .values({ workspaceId, ...patch })
    .onConflictDoUpdate({
      target: workspaceProfiles.workspaceId,
      set: { ...patch, updatedAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// Columns

export async function createColumn(
  partnerId: string,
  workspaceId: string,
  name: string,
): Promise<WorkspaceColumnView> {
  await requireWorkspace(partnerId, workspaceId);
  const existing = await db
    .select({ position: kanbanColumns.position })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.workspaceId, workspaceId));
  const nextPosition =
    existing.reduce((max, c) => Math.max(max, c.position), -1) + 1;

  const [row] = await db
    .insert(kanbanColumns)
    .values({ workspaceId, name, position: nextPosition })
    .returning();
  return { id: row.id, name: row.name, position: row.position, sopContent: row.sopContent };
}

export async function updateColumn(
  partnerId: string,
  columnId: string,
  patch: { name?: string; sopContent?: string | null },
): Promise<void> {
  const [column] = await db
    .select({ id: kanbanColumns.id, workspaceId: kanbanColumns.workspaceId })
    .from(kanbanColumns)
    .innerJoin(workspaces, eq(kanbanColumns.workspaceId, workspaces.id))
    .where(and(eq(kanbanColumns.id, columnId), eq(workspaces.partnerId, partnerId)));
  if (!column) throw new WorkspaceError("Columna no encontrada.");

  await db
    .update(kanbanColumns)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(kanbanColumns.id, columnId));
}

export async function reorderColumns(
  partnerId: string,
  workspaceId: string,
  orderedIds: string[],
): Promise<void> {
  await requireWorkspace(partnerId, workspaceId);
  const rows = await db
    .select({ id: kanbanColumns.id })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.workspaceId, workspaceId));
  const owned = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== owned.size || orderedIds.some((id) => !owned.has(id))) {
    throw new WorkspaceError("El orden no coincide con las columnas del tablero.");
  }
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(kanbanColumns)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(kanbanColumns.id, orderedIds[i]));
    }
  });
}

/** Deletes a column moving its cards to the first remaining column. */
export async function deleteColumn(
  partnerId: string,
  columnId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [column] = await tx
      .select({
        id: kanbanColumns.id,
        workspaceId: kanbanColumns.workspaceId,
      })
      .from(kanbanColumns)
      .innerJoin(workspaces, eq(kanbanColumns.workspaceId, workspaces.id))
      .where(and(eq(kanbanColumns.id, columnId), eq(workspaces.partnerId, partnerId)));
    if (!column) throw new WorkspaceError("Columna no encontrada.");

    const siblings = await tx
      .select({ id: kanbanColumns.id })
      .from(kanbanColumns)
      .where(eq(kanbanColumns.workspaceId, column.workspaceId))
      .orderBy(asc(kanbanColumns.position));
    const remaining = siblings.filter((c) => c.id !== columnId);
    if (remaining.length === 0) {
      throw new WorkspaceError("No puedes eliminar la única columna del tablero.");
    }

    await tx
      .update(kanbanCards)
      .set({ columnId: remaining[0].id, updatedAt: new Date() })
      .where(eq(kanbanCards.columnId, columnId));
    await tx.delete(kanbanColumns).where(eq(kanbanColumns.id, columnId));
    for (let i = 0; i < remaining.length; i++) {
      await tx
        .update(kanbanColumns)
        .set({ position: i })
        .where(eq(kanbanColumns.id, remaining[i].id));
    }
  });
}

// ---------------------------------------------------------------------------
// Cards

export async function createCard(
  partnerId: string,
  workspaceId: string,
  input: {
    columnId: string;
    title: string;
    description?: string | null;
    assignee?: string | null;
    dueDate?: string | null;
  },
): Promise<string> {
  await requireWorkspace(partnerId, workspaceId);
  const [column] = await db
    .select({ id: kanbanColumns.id })
    .from(kanbanColumns)
    .where(
      and(
        eq(kanbanColumns.id, input.columnId),
        eq(kanbanColumns.workspaceId, workspaceId),
      ),
    );
  if (!column) throw new WorkspaceError("Columna no encontrada.");

  const siblings = await db
    .select({ position: kanbanCards.position })
    .from(kanbanCards)
    .where(eq(kanbanCards.columnId, input.columnId));
  const nextPosition =
    siblings.reduce((max, c) => Math.max(max, c.position), -1) + 1;

  const [row] = await db
    .insert(kanbanCards)
    .values({
      workspaceId,
      columnId: input.columnId,
      title: input.title,
      description: input.description ?? null,
      assignee: input.assignee ?? null,
      dueDate: input.dueDate ?? null,
      position: nextPosition,
    })
    .returning({ id: kanbanCards.id });
  return row.id;
}

export async function updateCard(
  partnerId: string,
  cardId: string,
  patch: {
    title?: string;
    description?: string | null;
    assignee?: string | null;
    dueDate?: string | null;
  },
): Promise<void> {
  const result = await db
    .update(kanbanCards)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(kanbanCards.id, cardId),
        sql`${kanbanCards.workspaceId} IN (
          SELECT id FROM workspaces WHERE partner_id = ${partnerId}
        )`,
      ),
    )
    .returning({ id: kanbanCards.id });
  if (result.length === 0) throw new WorkspaceError("Tarjeta no encontrada.");
}

export async function deleteCard(
  partnerId: string,
  cardId: string,
): Promise<void> {
  const result = await db
    .delete(kanbanCards)
    .where(
      and(
        eq(kanbanCards.id, cardId),
        sql`${kanbanCards.workspaceId} IN (
          SELECT id FROM workspaces WHERE partner_id = ${partnerId}
        )`,
      ),
    )
    .returning({ id: kanbanCards.id });
  if (result.length === 0) throw new WorkspaceError("Tarjeta no encontrada.");
}

/** Same move semantics as the CRM pipeline: renormalizes affected columns. */
export async function moveCard(
  partnerId: string,
  cardId: string,
  newColumnId: string,
  newPosition: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [card] = await tx
      .select({ card: kanbanCards })
      .from(kanbanCards)
      .innerJoin(workspaces, eq(kanbanCards.workspaceId, workspaces.id))
      .where(and(eq(kanbanCards.id, cardId), eq(workspaces.partnerId, partnerId)));
    if (!card) throw new WorkspaceError("Tarjeta no encontrada.");

    const [target] = await tx
      .select({ id: kanbanColumns.id })
      .from(kanbanColumns)
      .where(
        and(
          eq(kanbanColumns.id, newColumnId),
          eq(kanbanColumns.workspaceId, card.card.workspaceId),
        ),
      );
    if (!target) throw new WorkspaceError("Columna no encontrada.");

    const sourceColumnId = card.card.columnId;

    const targetRows = await tx
      .select({ id: kanbanCards.id })
      .from(kanbanCards)
      .where(eq(kanbanCards.columnId, newColumnId))
      .orderBy(asc(kanbanCards.position), asc(kanbanCards.createdAt));
    const targetIds = targetRows.map((r) => r.id).filter((id) => id !== cardId);
    const clamped = Math.max(0, Math.min(newPosition, targetIds.length));
    targetIds.splice(clamped, 0, cardId);

    for (let i = 0; i < targetIds.length; i++) {
      await tx
        .update(kanbanCards)
        .set(
          targetIds[i] === cardId
            ? { position: i, columnId: newColumnId, updatedAt: new Date() }
            : { position: i },
        )
        .where(eq(kanbanCards.id, targetIds[i]));
    }

    if (sourceColumnId !== newColumnId) {
      const sourceRows = await tx
        .select({ id: kanbanCards.id })
        .from(kanbanCards)
        .where(eq(kanbanCards.columnId, sourceColumnId))
        .orderBy(asc(kanbanCards.position), asc(kanbanCards.createdAt));
      for (let i = 0; i < sourceRows.length; i++) {
        await tx
          .update(kanbanCards)
          .set({ position: i })
          .where(eq(kanbanCards.id, sourceRows[i].id));
      }
    }
  });
}
