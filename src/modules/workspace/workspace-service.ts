import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import {
  clients,
  kanbanTasks,
  leads,
  sopTemplates,
  workspaces,
  workspaceSops,
  type KanbanStatus,
} from "@/db/schema";

export class WorkspaceService {
  constructor(private db: Db) {}

  /**
   * Promueve un lead cerrado_ganado a cliente y abre su workspace único,
   * inyectando los SOPs/prompts activos del catálogo (Épica 3). Idempotente:
   * si el lead ya tiene cliente, devuelve el workspace existente.
   */
  async openWorkspaceFromLead(partnerId: string, leadId: string) {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.partnerId, partnerId)))
      .limit(1);
    if (!lead) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (lead.stage !== "cerrado_ganado") {
      return { ok: false as const, reason: "not_won" as const };
    }

    const existing = await this.db
      .select({ workspace: workspaces })
      .from(clients)
      .innerJoin(workspaces, eq(workspaces.clientId, clients.id))
      .where(eq(clients.leadId, leadId))
      .limit(1);
    if (existing[0]) {
      return { ok: true as const, workspace: existing[0].workspace };
    }

    const templates = await this.db
      .select()
      .from(sopTemplates)
      .where(eq(sopTemplates.isActive, true))
      .orderBy(asc(sopTemplates.sortOrder));

    const workspace = await this.db.transaction(async (tx) => {
      const [client] = await tx
        .insert(clients)
        .values({ partnerId, leadId, name: lead.businessName })
        .returning();
      const [ws] = await tx
        .insert(workspaces)
        .values({
          partnerId,
          clientId: client.id,
          name: lead.businessName,
          clientViewToken: randomBytes(24).toString("base64url"),
        })
        .returning();
      if (templates.length > 0) {
        await tx.insert(workspaceSops).values(
          templates.map((t) => ({
            workspaceId: ws.id,
            templateId: t.id,
            title: t.title,
            kind: t.kind,
            body: t.body,
            sortOrder: t.sortOrder,
          })),
        );
      }
      return ws;
    });

    return { ok: true as const, workspace };
  }

  async listWorkspaces(partnerId: string) {
    return this.db
      .select({ workspace: workspaces, client: clients })
      .from(workspaces)
      .innerJoin(clients, eq(workspaces.clientId, clients.id))
      .where(eq(workspaces.partnerId, partnerId))
      .orderBy(asc(workspaces.createdAt));
  }

  async getWorkspace(partnerId: string, workspaceId: string) {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(
        and(eq(workspaces.id, workspaceId), eq(workspaces.partnerId, partnerId)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listTasks(workspaceId: string) {
    return this.db
      .select()
      .from(kanbanTasks)
      .where(eq(kanbanTasks.workspaceId, workspaceId))
      .orderBy(asc(kanbanTasks.position), asc(kanbanTasks.createdAt));
  }

  async listSops(workspaceId: string) {
    return this.db
      .select()
      .from(workspaceSops)
      .where(eq(workspaceSops.workspaceId, workspaceId))
      .orderBy(asc(workspaceSops.sortOrder));
  }

  async createTask(
    partnerId: string,
    workspaceId: string,
    input: { title: string; description?: string | null; isClientVisible: boolean },
  ) {
    const ws = await this.getWorkspace(partnerId, workspaceId);
    if (!ws) return null;
    const [task] = await this.db
      .insert(kanbanTasks)
      .values({ workspaceId, ...input })
      .returning();
    return task;
  }

  async moveTask(
    partnerId: string,
    taskId: string,
    status: KanbanStatus,
  ) {
    // El join con workspaces garantiza que la tarea pertenece al partner.
    const rows = await this.db
      .select({ task: kanbanTasks })
      .from(kanbanTasks)
      .innerJoin(workspaces, eq(kanbanTasks.workspaceId, workspaces.id))
      .where(and(eq(kanbanTasks.id, taskId), eq(workspaces.partnerId, partnerId)))
      .limit(1);
    if (!rows[0]) return null;

    const [updated] = await this.db
      .update(kanbanTasks)
      .set({
        status,
        stalledSince: status === "en_estancamiento" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(kanbanTasks.id, taskId))
      .returning();
    return updated;
  }

  async toggleTaskVisibility(partnerId: string, taskId: string) {
    const rows = await this.db
      .select({ task: kanbanTasks })
      .from(kanbanTasks)
      .innerJoin(workspaces, eq(kanbanTasks.workspaceId, workspaces.id))
      .where(and(eq(kanbanTasks.id, taskId), eq(workspaces.partnerId, partnerId)))
      .limit(1);
    if (!rows[0]) return null;
    const [updated] = await this.db
      .update(kanbanTasks)
      .set({
        isClientVisible: !rows[0].task.isClientVisible,
        updatedAt: new Date(),
      })
      .where(eq(kanbanTasks.id, taskId))
      .returning();
    return updated;
  }

  async toggleSopCompleted(partnerId: string, sopId: string) {
    const rows = await this.db
      .select({ sop: workspaceSops })
      .from(workspaceSops)
      .innerJoin(workspaces, eq(workspaceSops.workspaceId, workspaces.id))
      .where(and(eq(workspaceSops.id, sopId), eq(workspaces.partnerId, partnerId)))
      .limit(1);
    if (!rows[0]) return null;
    const [updated] = await this.db
      .update(workspaceSops)
      .set({
        completedAt: rows[0].sop.completedAt ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workspaceSops.id, sopId))
      .returning();
    return updated;
  }

  /**
   * Vista de Cliente (regla de negocio #7): resuelve por token público y solo
   * expone tareas con is_client_visible = true, read-only.
   */
  async getClientView(token: string) {
    const rows = await this.db
      .select({ workspace: workspaces, client: clients })
      .from(workspaces)
      .innerJoin(clients, eq(workspaces.clientId, clients.id))
      .where(
        and(
          eq(workspaces.clientViewToken, token),
          eq(workspaces.clientViewEnabled, true),
        ),
      )
      .limit(1);
    if (!rows[0]) return null;

    const tasks = await this.db
      .select({
        id: kanbanTasks.id,
        title: kanbanTasks.title,
        status: kanbanTasks.status,
        dueDate: kanbanTasks.dueDate,
        updatedAt: kanbanTasks.updatedAt,
      })
      .from(kanbanTasks)
      .where(
        and(
          eq(kanbanTasks.workspaceId, rows[0].workspace.id),
          eq(kanbanTasks.isClientVisible, true),
        ),
      )
      .orderBy(asc(kanbanTasks.position), asc(kanbanTasks.createdAt));

    return { clientName: rows[0].client.name, tasks };
  }
}
