import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { collaborators, deals, tasks, workspaces } from "@/db/schema";
import { daysBetween, toIsoOrEpoch, toIsoOrNull } from "@/lib/dates";
import type {
  TaskAlert,
  TaskAlerts,
  TaskFilter,
  TaskPriority,
  TaskStatus,
  TaskView,
} from "./types";

export class TasksError extends Error {}

/** Pura, sin DB — status != 'hecha' && dueDate < hoy. dueDate === hoy NO es vencida. */
export function isOverdue(
  status: TaskStatus,
  dueDate: string | null,
  now: Date,
): boolean {
  if (status === "hecha" || !dueDate) return false;
  return daysBetween(now, dueDate) < 0;
}

async function assertOwnedDeal(partnerId: string, dealId: string): Promise<void> {
  const [row] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.partnerId, partnerId)));
  if (!row) throw new TasksError("Cliente no encontrado.");
}

async function assertOwnedWorkspace(partnerId: string, workspaceId: string): Promise<void> {
  const [row] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)));
  if (!row) throw new TasksError("Espacio no encontrado.");
}

/** Asignar exige colaborador propio Y activo (criterio 8 — desactivado se rechaza). */
async function assertAssignableCollaborator(
  partnerId: string,
  collaboratorId: string,
): Promise<void> {
  const [row] = await db
    .select({ status: collaborators.status })
    .from(collaborators)
    .where(and(eq(collaborators.id, collaboratorId), eq(collaborators.partnerId, partnerId)));
  if (!row) throw new TasksError("Colaborador no encontrado.");
  if (row.status !== "activo") {
    throw new TasksError("No puedes asignar tareas a un colaborador desactivado.");
  }
}

function completedAtPatch(
  newStatus: TaskStatus | undefined,
  now: Date,
): { completedAt?: Date | null } {
  if (newStatus === "hecha") return { completedAt: now };
  if (newStatus === "pendiente" || newStatus === "en_progreso") return { completedAt: null };
  return {};
}

const PRIORITY_RANK: Record<TaskPriority, number> = { alta: 0, media: 1, baja: 2 };

// Orden: vencidas primero, luego dueDate asc (sin fecha al final), luego
// prioridad. El volumen es pequeño (spec §5.1: sin paginación) — ordenar en
// JS tras el query evita depender de NULLS LAST específico del driver.
function compareTasks(a: TaskView, b: TaskView): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  const ap = a.priority ? PRIORITY_RANK[a.priority] : 3;
  const bp = b.priority ? PRIORITY_RANK[b.priority] : 3;
  return ap - bp;
}

interface TaskRow {
  task: typeof tasks.$inferSelect;
  dealTitle: string | null;
  workspaceClientName: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
}

function toTaskView(row: TaskRow, now: Date): TaskView {
  const t = row.task;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority | null,
    dueDate: t.dueDate,
    completedAt: toIsoOrNull(t.completedAt),
    assignee: t.assigneeCollaboratorId
      ? { id: t.assigneeCollaboratorId, name: row.assigneeName ?? row.assigneeEmail ?? "Colaborador" }
      : null,
    deal: t.dealId && row.dealTitle ? { id: t.dealId, title: row.dealTitle } : null,
    workspace:
      t.workspaceId && row.workspaceClientName
        ? { id: t.workspaceId, clientName: row.workspaceClientName }
        : null,
    overdue: isOverdue(t.status as TaskStatus, t.dueDate, now),
    createdAt: toIsoOrEpoch(t.createdAt),
  };
}

export async function listTasks(
  partnerId: string,
  filter: TaskFilter = {},
  now: Date = new Date(),
): Promise<TaskView[]> {
  const conditions = [eq(tasks.partnerId, partnerId)];

  const status = filter.status ?? "abiertas";
  if (status === "abiertas") {
    conditions.push(sql`${tasks.status} IN ('pendiente', 'en_progreso')`);
  } else if (status !== "todas") {
    conditions.push(eq(tasks.status, status));
  }

  if (filter.assigneeId === null) {
    conditions.push(isNull(tasks.assigneeCollaboratorId));
  } else if (typeof filter.assigneeId === "string") {
    conditions.push(eq(tasks.assigneeCollaboratorId, filter.assigneeId));
  }

  if (filter.dealId) conditions.push(eq(tasks.dealId, filter.dealId));
  if (filter.workspaceId) conditions.push(eq(tasks.workspaceId, filter.workspaceId));
  if (filter.linked) {
    conditions.push(sql`(${tasks.dealId} IS NOT NULL OR ${tasks.workspaceId} IS NOT NULL)`);
  }

  if (filter.due && filter.due !== "all") {
    const todayStr = now.toISOString().slice(0, 10);
    if (filter.due === "vencidas") {
      conditions.push(
        sql`${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} < ${todayStr} AND ${tasks.status} <> 'hecha'`,
      );
    } else if (filter.due === "hoy") {
      conditions.push(sql`${tasks.dueDate} = ${todayStr}`);
    } else if (filter.due === "semana") {
      const weekStr = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
      conditions.push(
        sql`${tasks.dueDate} IS NOT NULL AND ${tasks.dueDate} BETWEEN ${todayStr} AND ${weekStr}`,
      );
    }
  }

  const rows = await db
    .select({
      task: tasks,
      dealTitle: deals.title,
      workspaceClientName: workspaces.clientName,
      assigneeName: collaborators.displayName,
      assigneeEmail: collaborators.email,
    })
    .from(tasks)
    .leftJoin(deals, eq(tasks.dealId, deals.id))
    .leftJoin(workspaces, eq(tasks.workspaceId, workspaces.id))
    .leftJoin(collaborators, eq(tasks.assigneeCollaboratorId, collaborators.id))
    .where(and(...conditions));

  const views = rows.map((row) => toTaskView(row, now));
  views.sort(compareTasks);
  return views;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  dueDate?: string | null;
  assigneeCollaboratorId?: string | null;
  dealId?: string | null;
  workspaceId?: string | null;
}

export async function createTask(
  partnerId: string,
  input: TaskInput,
  createdByCollaboratorId: string | null,
): Promise<string> {
  if (input.dealId) await assertOwnedDeal(partnerId, input.dealId);
  if (input.workspaceId) await assertOwnedWorkspace(partnerId, input.workspaceId);
  if (input.assigneeCollaboratorId) {
    await assertAssignableCollaborator(partnerId, input.assigneeCollaboratorId);
  }

  const now = new Date();
  const status = input.status ?? "pendiente";
  const [row] = await db
    .insert(tasks)
    .values({
      partnerId,
      title: input.title,
      description: input.description ?? null,
      status,
      priority: input.priority ?? null,
      dueDate: input.dueDate ?? null,
      assigneeCollaboratorId: input.assigneeCollaboratorId ?? null,
      dealId: input.dealId ?? null,
      workspaceId: input.workspaceId ?? null,
      createdByCollaboratorId,
      ...completedAtPatch(status, now),
    })
    .returning({ id: tasks.id });
  return row.id;
}

export async function updateTask(
  partnerId: string,
  taskId: string,
  patch: Partial<TaskInput>,
): Promise<void> {
  if (patch.dealId) await assertOwnedDeal(partnerId, patch.dealId);
  if (patch.workspaceId) await assertOwnedWorkspace(partnerId, patch.workspaceId);
  if (patch.assigneeCollaboratorId) {
    await assertAssignableCollaborator(partnerId, patch.assigneeCollaboratorId);
  }

  const now = new Date();
  const result = await db
    .update(tasks)
    .set({ ...patch, ...completedAtPatch(patch.status, now), updatedAt: now })
    .where(and(eq(tasks.id, taskId), eq(tasks.partnerId, partnerId)))
    .returning({ id: tasks.id });
  if (result.length === 0) throw new TasksError("Tarea no encontrada.");
}

export async function deleteTask(partnerId: string, taskId: string): Promise<void> {
  const result = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.partnerId, partnerId)))
    .returning({ id: tasks.id });
  if (result.length === 0) throw new TasksError("Tarea no encontrada.");
}

/** Atajo para el checkbox/select rápido — mismo camino que updateTask. */
export async function setTaskStatus(
  partnerId: string,
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  await updateTask(partnerId, taskId, { status });
}

/** Tareas abiertas con due_date vencidas o de hoy — patrón getInvoiceAlerts. */
export async function getTaskAlerts(
  partnerId: string,
  now: Date = new Date(),
): Promise<TaskAlerts> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      assigneeName: collaborators.displayName,
      assigneeEmail: collaborators.email,
    })
    .from(tasks)
    .leftJoin(collaborators, eq(tasks.assigneeCollaboratorId, collaborators.id))
    .where(
      and(
        eq(tasks.partnerId, partnerId),
        sql`${tasks.status} <> 'hecha'`,
        sql`${tasks.dueDate} IS NOT NULL`,
      ),
    );

  const overdue: TaskAlert[] = [];
  const dueToday: TaskAlert[] = [];
  for (const row of rows) {
    if (!row.dueDate) continue;
    const days = daysBetween(now, row.dueDate);
    if (days > 0) continue;
    const alert: TaskAlert = {
      id: row.id,
      title: row.title,
      dueDate: row.dueDate,
      daysOverdue: -days,
      assigneeName: row.assigneeName ?? row.assigneeEmail ?? null,
    };
    if (days < 0) overdue.push(alert);
    else dueToday.push(alert);
  }
  return { overdue, dueToday, total: overdue.length + dueToday.length };
}

/** Badge de tareas abiertas por deal, para el card del pipeline. */
export async function countOpenTasksByDeal(
  partnerId: string,
  dealIds: string[],
): Promise<Map<string, number>> {
  if (dealIds.length === 0) return new Map();
  const rows = await db
    .select({ dealId: tasks.dealId, count: sql<string>`COUNT(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.partnerId, partnerId),
        inArray(tasks.dealId, dealIds),
        sql`${tasks.status} <> 'hecha'`,
      ),
    )
    .groupBy(tasks.dealId);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.dealId) map.set(row.dealId, Number(row.count));
  }
  return map;
}
