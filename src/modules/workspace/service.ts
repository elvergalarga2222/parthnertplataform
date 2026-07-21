import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  aiGenerations,
  deals,
  kanbanCards,
  kanbanColumns,
  partners,
  workspaceProfiles,
  workspaces,
} from "@/db/schema";
import { toIsoOrEpoch } from "@/lib/dates";
import type {
  ClientView,
  ClientViewShareState,
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
        isClientVisible: c.isClientVisible,
      }),
    ),
    profile: toProfileView(profile),
    latestStrategyGeneration: await getLatestStrategyGeneration(
      partnerId,
      workspaceId,
    ),
    clientView: {
      enabled: ws.clientViewEnabled,
      hasToken: ws.clientViewTokenHash !== null,
      visibleCardCount: cardRows.filter((c) => c.isClientVisible).length,
    },
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
    isClientVisible?: boolean;
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
      // Fail-closed: si el caller no lo pide, la tarjeta nace privada.
      isClientVisible: input.isClientVisible ?? false,
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
    isClientVisible?: boolean;
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

// ---------------------------------------------------------------------------
// Vista de Cliente (regla #7)
//
// Única superficie de la plataforma que se lee SIN sesión, así que el contrato
// es más estricto que el del resto del módulo:
//   - el token es el ÚNICO identificador aceptado (nunca un workspaceId de la
//     URL, que permitiría enumerar espacios de otros partners);
//   - en BD solo vive su SHA-256, igual que collaborators.invite_token_hash;
//   - se filtra por is_client_visible = true y se proyectan solo los campos de
//     ClientViewCard — `assignee`, SOPs, perfil y generaciones de IA nunca
//     salen por aquí.

function hashClientViewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resuelve el enlace público. Devuelve null (→ 404, sin distinguir causa) si el
 * token no existe, si el Partner apagó la vista, o si el partner dueño está
 * congelado — regla #2: congelar corta también lo que ya se compartió.
 */
export async function getClientViewByToken(
  token: string,
): Promise<ClientView | null> {
  // Un token vacío hashea a un valor válido y podría casar con una fila que
  // tuviera ese hash; cortamos antes de tocar la BD.
  if (!token) return null;

  const [ws] = await db
    .select({
      id: workspaces.id,
      clientName: workspaces.clientName,
      enabled: workspaces.clientViewEnabled,
      partnerStatus: partners.status,
    })
    .from(workspaces)
    .innerJoin(partners, eq(workspaces.partnerId, partners.id))
    .where(eq(workspaces.clientViewTokenHash, hashClientViewToken(token)));

  if (!ws || !ws.enabled || ws.partnerStatus === "frozen") return null;

  // Se traen columnas y tarjetas del workspace resuelto por token. El filtro
  // is_client_visible va en el WHERE, no en el .map(), para que una tarjeta
  // privada no llegue nunca al proceso de Node.
  const columnRows = await db
    .select({
      id: kanbanColumns.id,
      name: kanbanColumns.name,
      position: kanbanColumns.position,
    })
    .from(kanbanColumns)
    .where(eq(kanbanColumns.workspaceId, ws.id))
    .orderBy(asc(kanbanColumns.position), asc(kanbanColumns.createdAt));

  const cardRows = await db
    .select({
      id: kanbanCards.id,
      columnId: kanbanCards.columnId,
      title: kanbanCards.title,
      description: kanbanCards.description,
      dueDate: kanbanCards.dueDate,
    })
    .from(kanbanCards)
    .where(
      and(
        eq(kanbanCards.workspaceId, ws.id),
        eq(kanbanCards.isClientVisible, true),
      ),
    )
    .orderBy(asc(kanbanCards.position), asc(kanbanCards.createdAt));

  return {
    clientName: ws.clientName,
    columns: columnRows.map((col) => ({
      id: col.id,
      name: col.name,
      cards: cardRows
        .filter((card) => card.columnId === col.id)
        .map((card) => ({
          id: card.id,
          title: card.title,
          description: card.description,
          dueDate: card.dueDate,
        })),
    })),
  };
}

export async function getClientViewShareState(
  partnerId: string,
  workspaceId: string,
): Promise<ClientViewShareState> {
  const ws = await requireWorkspace(partnerId, workspaceId);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kanbanCards)
    .where(
      and(
        eq(kanbanCards.workspaceId, workspaceId),
        eq(kanbanCards.isClientVisible, true),
      ),
    );

  return {
    enabled: ws.clientViewEnabled,
    hasToken: ws.clientViewTokenHash !== null,
    visibleCardCount: count,
  };
}

/**
 * Genera un token nuevo e invalida el anterior. Devuelve el valor en claro —
 * es la única vez que existe fuera del navegador del cliente, así que el caller
 * debe mostrarlo y olvidarlo.
 */
export async function rotateClientViewToken(
  partnerId: string,
  workspaceId: string,
): Promise<string> {
  await requireWorkspace(partnerId, workspaceId);
  const token = randomBytes(32).toString("base64url");

  await db
    .update(workspaces)
    .set({
      clientViewTokenHash: hashClientViewToken(token),
      updatedAt: new Date(),
    })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)));

  return token;
}

/**
 * Enciende o apaga el enlace sin rotarlo. Apagar es reversible y conserva el
 * token; para invalidarlo de verdad hay que rotar.
 */
export async function setClientViewEnabled(
  partnerId: string,
  workspaceId: string,
  enabled: boolean,
): Promise<void> {
  const ws = await requireWorkspace(partnerId, workspaceId);
  if (enabled && !ws.clientViewTokenHash) {
    throw new WorkspaceError(
      "Genera primero un enlace para poder activar la vista de cliente.",
    );
  }
  await db
    .update(workspaces)
    .set({ clientViewEnabled: enabled, updatedAt: new Date() })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)));
}

/** Marca/desmarca una tarjeta como visible para el cliente. */
export async function setCardClientVisibility(
  partnerId: string,
  cardId: string,
  isClientVisible: boolean,
): Promise<void> {
  await updateCard(partnerId, cardId, { isClientVisible });
}
