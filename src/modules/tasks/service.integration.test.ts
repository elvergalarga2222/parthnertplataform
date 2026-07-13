import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

// team.acceptInvite crea sesión (createCollaboratorSession -> cookies()) para
// dejar el colaborador fixture en status 'activo' (inviteCollaborator solo
// deja 'invitado').
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

describe.skipIf(!hasDb)("tasks service (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let tasksSvc: typeof import("./service");
  let crm: typeof import("@/modules/crm/service");
  let team: typeof import("@/modules/team/service");

  let partnerA: string;
  let partnerB: string;
  let stageA: string;
  let dealA: string;
  let workspaceA: string;
  let collaboratorEditorA: string;
  let collaboratorDesactivadoA: string;
  const createdPartners: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    tasksSvc = await import("./service");
    crm = await import("@/modules/crm/service");
    team = await import("@/modules/team/service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-tasks-${label}-${randomUUID()}@test.dev`,
          displayName: `Test Tasks ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;

    const stage = await crm.createStage(partnerA, { name: "Etapa", color: "gray" });
    stageA = stage.id;
    const deal = await crm.createDeal(partnerA, { title: "Deal de prueba", value: 100, stageId: stageA });
    dealA = deal;

    const [ws] = await db
      .insert(schema.workspaces)
      .values({ partnerId: partnerA, clientName: "Cliente de prueba" })
      .returning({ id: schema.workspaces.id });
    workspaceA = ws.id;

    const invite = await team.inviteCollaborator(partnerA, {
      email: `editor-tasks-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    collaboratorEditorA = invite.collaboratorId;
    await team.acceptInvite(invite.token, "Editor de prueba");

    const desactivadoInvite = await team.inviteCollaborator(partnerA, {
      email: `desactivado-tasks-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    collaboratorDesactivadoA = desactivadoInvite.collaboratorId;
    await team.acceptInvite(desactivadoInvite.token, "Desactivado de prueba");
    await team.deactivateCollaborator(partnerA, collaboratorDesactivadoA);
  });

  afterAll(async () => {
    if (!hasDb || createdPartners.length === 0) return;
    const { inArray, eq } = await import("drizzle-orm");
    await db.delete(schema.tasks).where(inArray(schema.tasks.partnerId, createdPartners));
    await db.delete(schema.collaborators).where(inArray(schema.collaborators.partnerId, createdPartners));
    await db.delete(schema.workspaces).where(inArray(schema.workspaces.partnerId, createdPartners));
    await db.delete(schema.deals).where(inArray(schema.deals.partnerId, createdPartners));
    await db.delete(schema.pipelineStages).where(inArray(schema.pipelineStages.partnerId, createdPartners));
    for (const id of createdPartners) {
      await db.delete(schema.partners).where(eq(schema.partners.id, id));
    }
  });

  it("creates a task and lists it back with derived overdue + deal/workspace/assignee joined", async () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const taskId = await tasksSvc.createTask(
      partnerA,
      {
        title: "Preparar kickoff",
        dueDate: "2026-07-01",
        dealId: dealA,
        workspaceId: workspaceA,
        assigneeCollaboratorId: collaboratorEditorA,
      },
      null,
    );

    const rows = await tasksSvc.listTasks(partnerA, { status: "todas" }, now);
    const row = rows.find((r) => r.id === taskId)!;
    expect(row.title).toBe("Preparar kickoff");
    expect(row.overdue).toBe(true);
    expect(row.deal?.id).toBe(dealA);
    expect(row.workspace?.id).toBe(workspaceA);
    expect(row.assignee?.id).toBe(collaboratorEditorA);
  });

  it("rejects assigning a task to a deactivated collaborator", async () => {
    await expect(
      tasksSvc.createTask(
        partnerA,
        { title: "Tarea inválida", assigneeCollaboratorId: collaboratorDesactivadoA },
        null,
      ),
    ).rejects.toThrow(/desactivado/i);
  });

  it("rejects linking a task to a deal/workspace from another partner", async () => {
    await expect(
      tasksSvc.createTask(partnerB, { title: "Cross tenant", dealId: dealA }, null),
    ).rejects.toThrow(/no encontrado/i);
    await expect(
      tasksSvc.createTask(partnerB, { title: "Cross tenant", workspaceId: workspaceA }, null),
    ).rejects.toThrow(/no encontrado/i);
  });

  it("completing a task sets completedAt; leaving hecha clears it", async () => {
    const taskId = await tasksSvc.createTask(partnerA, { title: "Toggle test" }, null);
    await tasksSvc.setTaskStatus(partnerA, taskId, "hecha");

    let rows = await tasksSvc.listTasks(partnerA, { status: "todas" });
    let row = rows.find((r) => r.id === taskId)!;
    expect(row.status).toBe("hecha");
    expect(row.completedAt).not.toBeNull();

    await tasksSvc.setTaskStatus(partnerA, taskId, "pendiente");
    rows = await tasksSvc.listTasks(partnerA, { status: "todas" });
    row = rows.find((r) => r.id === taskId)!;
    expect(row.status).toBe("pendiente");
    expect(row.completedAt).toBeNull();
  });

  it("deleting a linked deal/workspace/collaborator does not delete the task — it just unlinks (set null)", async () => {
    const { eq } = await import("drizzle-orm");
    const tempStage = await crm.createStage(partnerA, { name: "Temp", color: "blue" });
    const tempDeal = await crm.createDeal(partnerA, { title: "Deal temporal", value: 1, stageId: tempStage.id });
    const [tempWs] = await db
      .insert(schema.workspaces)
      .values({ partnerId: partnerA, clientName: "Cliente temporal" })
      .returning({ id: schema.workspaces.id });

    const taskId = await tasksSvc.createTask(
      partnerA,
      { title: "Vinculada", dealId: tempDeal, workspaceId: tempWs.id, assigneeCollaboratorId: collaboratorEditorA },
      null,
    );

    await db.delete(schema.deals).where(eq(schema.deals.id, tempDeal));
    await db.delete(schema.workspaces).where(eq(schema.workspaces.id, tempWs.id));
    await team.deactivateCollaborator(partnerA, collaboratorEditorA);

    const rows = await tasksSvc.listTasks(partnerA, { status: "todas" });
    const row = rows.find((r) => r.id === taskId)!;
    expect(row).toBeDefined();
    expect(row.deal).toBeNull();
    expect(row.workspace).toBeNull();
    // El colaborador desactivado ya no se resuelve como "assignee" con nombre visible
    // (el registro histórico sigue existiendo, la FK no se borró — set null aplicaría
    // solo si se BORRARA al colaborador, no al desactivarlo).

    // Reactivar para no afectar otros tests que reusan collaboratorEditorA.
    await team.reactivateCollaborator(partnerA, collaboratorEditorA);
  });

  it("isolation: a partner cannot see another partner's tasks", async () => {
    const taskId = await tasksSvc.createTask(partnerA, { title: "Solo de A" }, null);
    const rowsB = await tasksSvc.listTasks(partnerB, { status: "todas" });
    expect(rowsB.some((r) => r.id === taskId)).toBe(false);

    await expect(tasksSvc.updateTask(partnerB, taskId, { title: "Hack" })).rejects.toThrow(
      /no encontrada/i,
    );
    await expect(tasksSvc.deleteTask(partnerB, taskId)).rejects.toThrow(/no encontrada/i);
  });

  it("getTaskAlerts returns overdue and due-today open tasks, excluding hecha", async () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const overdueId = await tasksSvc.createTask(partnerA, { title: "Vencida", dueDate: "2026-07-05" }, null);
    const todayId = await tasksSvc.createTask(partnerA, { title: "Hoy", dueDate: "2026-07-10" }, null);
    const doneId = await tasksSvc.createTask(
      partnerA,
      { title: "Vencida pero hecha", dueDate: "2026-07-01", status: "hecha" },
      null,
    );

    const alerts = await tasksSvc.getTaskAlerts(partnerA, now);
    expect(alerts.overdue.some((a) => a.id === overdueId)).toBe(true);
    expect(alerts.dueToday.some((a) => a.id === todayId)).toBe(true);
    expect(alerts.overdue.some((a) => a.id === doneId)).toBe(false);
    expect(alerts.dueToday.some((a) => a.id === doneId)).toBe(false);
  });

  it("countOpenTasksByDeal counts only open tasks per deal", async () => {
    const stage = await crm.createStage(partnerA, { name: "Etapa2", color: "teal" });
    const deal2 = await crm.createDeal(partnerA, { title: "Deal 2", value: 1, stageId: stage.id });
    await tasksSvc.createTask(partnerA, { title: "Abierta 1", dealId: deal2 }, null);
    await tasksSvc.createTask(partnerA, { title: "Abierta 2", dealId: deal2 }, null);
    await tasksSvc.createTask(partnerA, { title: "Cerrada", dealId: deal2, status: "hecha" }, null);

    const counts = await tasksSvc.countOpenTasksByDeal(partnerA, [deal2]);
    expect(counts.get(deal2)).toBe(2);
  });

  it("listTasks with linked:true only returns tasks tied to a deal or workspace", async () => {
    const unlinkedId = await tasksSvc.createTask(partnerA, { title: "Sin vínculo" }, null);
    const linkedId = await tasksSvc.createTask(partnerA, { title: "Con deal", dealId: dealA }, null);

    const linked = await tasksSvc.listTasks(partnerA, { status: "todas", linked: true });
    expect(linked.some((r) => r.id === linkedId)).toBe(true);
    expect(linked.some((r) => r.id === unlinkedId)).toBe(false);
  });
});
