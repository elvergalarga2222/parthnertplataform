"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthError, requireEditor } from "@/modules/auth/service";
import {
  WorkspaceError,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  moveCard,
  reorderColumns,
  updateCard,
  updateColumn,
  updateWorkspaceProfile,
  updateWorkspaceStatus,
} from "./service";
import { WORKSPACE_STATUSES } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function run(fn: (partnerId: string) => Promise<void>): Promise<ActionResult> {
  try {
    const actor = await requireEditor();
    await fn(actor.partner.id);
    revalidatePath("/espacios");
    return { ok: true };
  } catch (err) {
    if (err instanceof WorkspaceError || err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    console.error("Workspace action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

const uuid = z.string().uuid();

// ---------------------------------------------------------------------------
// Workspace

export async function updateWorkspaceStatusAction(input: {
  workspaceId: string;
  status: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ workspaceId: uuid, status: z.enum(WORKSPACE_STATUSES) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  return run((pid) =>
    updateWorkspaceStatus(pid, parsed.data.workspaceId, parsed.data.status),
  );
}

const profileSchema = z.object({
  workspaceId: uuid,
  businessName: z.string().trim().max(120).nullish(),
  industry: z.string().trim().max(80).nullish(),
  contactEmail: z.string().trim().max(160).nullish(),
  contactPhone: z.string().trim().max(40).nullish(),
  notes: z.string().trim().max(4000).nullish(),
  strategyDoc: z.string().trim().max(50_000).nullish(),
  extra: z.record(z.string(), z.string().max(500)).optional(),
});

export async function updateProfileAction(
  input: z.input<typeof profileSchema>,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { workspaceId, ...patch } = parsed.data;
  return run((pid) => updateWorkspaceProfile(pid, workspaceId, patch));
}

// ---------------------------------------------------------------------------
// Columns

export async function createColumnAction(input: {
  workspaceId: string;
  name: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({ workspaceId: uuid, name: z.string().trim().min(1).max(60) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nombre inválido." };
  return run(async (pid) => {
    await createColumn(pid, parsed.data.workspaceId, parsed.data.name);
  });
}

export async function updateColumnAction(input: {
  columnId: string;
  name?: string;
  sopContent?: string | null;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      columnId: uuid,
      name: z.string().trim().min(1).max(60).optional(),
      sopContent: z.string().trim().max(8000).nullish(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { columnId, ...patch } = parsed.data;
  return run((pid) => updateColumn(pid, columnId, patch));
}

export async function reorderColumnsAction(input: {
  workspaceId: string;
  orderedIds: string[];
}): Promise<ActionResult> {
  const parsed = z
    .object({ workspaceId: uuid, orderedIds: z.array(uuid).min(1) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Orden inválido." };
  return run((pid) =>
    reorderColumns(pid, parsed.data.workspaceId, parsed.data.orderedIds),
  );
}

export async function deleteColumnAction(columnId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(columnId);
  if (!parsed.success) return { ok: false, error: "Columna inválida." };
  return run((pid) => deleteColumn(pid, parsed.data));
}

// ---------------------------------------------------------------------------
// Cards

const cardSchema = z.object({
  workspaceId: uuid,
  columnId: uuid,
  title: z.string().trim().min(1, "El título es obligatorio.").max(160),
  description: z.string().trim().max(2000).nullish(),
  assignee: z.string().trim().max(80).nullish(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

export async function createCardAction(
  input: z.input<typeof cardSchema>,
): Promise<ActionResult> {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { workspaceId, ...rest } = parsed.data;
  return run(async (pid) => {
    await createCard(pid, workspaceId, rest);
  });
}

export async function updateCardAction(input: {
  cardId: string;
  title?: string;
  description?: string | null;
  assignee?: string | null;
  dueDate?: string | null;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      cardId: uuid,
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().trim().max(2000).nullish(),
      assignee: z.string().trim().max(80).nullish(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { cardId, ...patch } = parsed.data;
  return run((pid) => updateCard(pid, cardId, patch));
}

export async function deleteCardAction(cardId: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(cardId);
  if (!parsed.success) return { ok: false, error: "Tarjeta inválida." };
  return run((pid) => deleteCard(pid, parsed.data));
}

export async function moveCardAction(input: {
  cardId: string;
  columnId: string;
  position: number;
}): Promise<ActionResult> {
  const parsed = z
    .object({ cardId: uuid, columnId: uuid, position: z.number().int().min(0) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Movimiento inválido." };
  return run((pid) =>
    moveCard(pid, parsed.data.cardId, parsed.data.columnId, parsed.data.position),
  );
}
