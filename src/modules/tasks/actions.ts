"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inYearRange } from "@/lib/dates";
import { AuthError, getCurrentActor, requireEditor, type Actor } from "@/modules/auth/service";
import {
  TasksError,
  countOpenTasksByDeal,
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateTask,
} from "./service";
import { TASK_PRIORITIES, TASK_STATUSES, type TaskView } from "./types";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function run(
  fn: (actor: Actor) => Promise<void>,
  extraPath?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireEditor();
    await fn(actor);
    revalidatePath("/tareas");
    revalidatePath("/clientes");
    revalidatePath("/dashboard");
    if (extraPath) revalidatePath(extraPath);
    return { ok: true };
  } catch (err) {
    if (err instanceof TasksError || err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    console.error("Tasks action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

// `.date()` no acota el año por sí solo — lección del bug de /clientes.
const boundedDate = z
  .string()
  .date()
  .nullish()
  .refine(inYearRange(1970, 2100), "La fecha no es válida.");

const taskSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(160),
  description: z.string().trim().max(4000).nullish(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).nullish(),
  dueDate: boundedDate,
  assigneeCollaboratorId: z.string().uuid().nullish(),
  dealId: z.string().uuid().nullish(),
  workspaceId: z.string().uuid().nullish(),
});

export async function createTaskAction(
  input: z.input<typeof taskSchema>,
): Promise<ActionResult> {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;
  return run(async (actor) => {
    await createTask(
      actor.partner.id,
      {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority ?? null,
        dueDate: data.dueDate ?? null,
        assigneeCollaboratorId: data.assigneeCollaboratorId ?? null,
        dealId: data.dealId ?? null,
        workspaceId: data.workspaceId ?? null,
      },
      actor.collaborator?.id ?? null,
    );
  }, data.workspaceId ? `/espacios/${data.workspaceId}` : undefined);
}

const taskPatchSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(4000).nullish(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).nullish(),
  dueDate: boundedDate,
  assigneeCollaboratorId: z.string().uuid().nullish(),
  dealId: z.string().uuid().nullish(),
  workspaceId: z.string().uuid().nullish(),
});

export async function updateTaskAction(
  input: z.input<typeof taskPatchSchema>,
): Promise<ActionResult> {
  const parsed = taskPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { taskId, ...patch } = parsed.data;
  return run(
    (actor) => updateTask(actor.partner.id, taskId, patch),
    patch.workspaceId ? `/espacios/${patch.workspaceId}` : undefined,
  );
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(taskId);
  if (!parsed.success) return { ok: false, error: "Tarea inválida." };
  return run((actor) => deleteTask(actor.partner.id, parsed.data));
}

const setStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
});

export async function setTaskStatusAction(
  input: z.input<typeof setStatusSchema>,
): Promise<ActionResult> {
  const parsed = setStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  return run((actor) => setTaskStatus(actor.partner.id, parsed.data.taskId, parsed.data.status));
}

// ---------------------------------------------------------------------------
// Lectura on-demand para los paneles embebidos (deal/workspace) — patrón
// getDealActivity: no engordan el snapshot principal de CRM/Workspace, se
// consultan al abrir el panel. Abiertas a lector (son lecturas).

export async function getTasksForDeal(dealId: string): Promise<TaskView[]> {
  const parsed = z.string().uuid().safeParse(dealId);
  if (!parsed.success) return [];
  const actor = await getCurrentActor();
  if (!actor) return [];
  return listTasks(actor.partner.id, { dealId: parsed.data, status: "todas" });
}

export async function getTasksForWorkspace(workspaceId: string): Promise<TaskView[]> {
  const parsed = z.string().uuid().safeParse(workspaceId);
  if (!parsed.success) return [];
  const actor = await getCurrentActor();
  if (!actor) return [];
  return listTasks(actor.partner.id, { workspaceId: parsed.data, status: "todas" });
}

/** Badge de tareas abiertas por deal en el card del pipeline (opcional §5). */
export async function getOpenTaskCountsByDeal(
  dealIds: string[],
): Promise<Record<string, number>> {
  const parsed = z.array(z.string().uuid()).safeParse(dealIds);
  if (!parsed.success || parsed.data.length === 0) return {};
  const actor = await getCurrentActor();
  if (!actor) return {};
  const map = await countOpenTasksByDeal(actor.partner.id, parsed.data);
  return Object.fromEntries(map);
}
