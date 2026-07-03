"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { KANBAN_STATUSES } from "@/db/schema";
import { requirePartner } from "@/modules/auth/require-partner";
import { WorkspaceService } from "@/modules/workspace/workspace-service";

function service() {
  return new WorkspaceService(getDb());
}

export async function openWorkspaceAction(formData: FormData) {
  const partner = await requirePartner();
  const leadId = z.string().uuid().parse(formData.get("leadId"));
  const result = await service().openWorkspaceFromLead(partner.id, leadId);
  if (!result.ok) {
    redirect(`/crm/${leadId}?gate=${encodeURIComponent("Solo un lead cerrado ganado puede abrir workspace")}`);
  }
  revalidatePath("/workspace");
  redirect(`/workspace/${result.workspace.id}`);
}

const newTaskSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  isClientVisible: z.string().optional(),
});

export async function createTaskAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = newTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/workspace");
  }
  const { workspaceId, title, description, isClientVisible } = parsed.data;
  await service().createTask(partner.id, workspaceId, {
    title,
    description: description || null,
    isClientVisible: isClientVisible === "on",
  });
  revalidatePath(`/workspace/${workspaceId}`);
  redirect(`/workspace/${workspaceId}`);
}

const moveSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
  status: z.enum(KANBAN_STATUSES),
});

export async function moveTaskAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/workspace");
  }
  const { workspaceId, taskId, status } = parsed.data;
  await service().moveTask(partner.id, taskId, status);
  revalidatePath(`/workspace/${workspaceId}`);
  redirect(`/workspace/${workspaceId}`);
}

const toggleSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export async function toggleVisibilityAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = toggleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/workspace");
  }
  await service().toggleTaskVisibility(partner.id, parsed.data.taskId);
  revalidatePath(`/workspace/${parsed.data.workspaceId}`);
  redirect(`/workspace/${parsed.data.workspaceId}`);
}

const sopSchema = z.object({
  workspaceId: z.string().uuid(),
  sopId: z.string().uuid(),
});

export async function toggleSopAction(formData: FormData) {
  const partner = await requirePartner();
  const parsed = sopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect("/workspace");
  }
  await service().toggleSopCompleted(partner.id, parsed.data.sopId);
  revalidatePath(`/workspace/${parsed.data.workspaceId}`);
  redirect(`/workspace/${parsed.data.workspaceId}`);
}
