"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuthError,
  getCurrentActor,
  requireEditor,
  type Actor,
} from "@/modules/auth/service";
import {
  TeamError,
  acceptInvite,
  createMeeting,
  deactivateCollaborator,
  deleteMeeting,
  inviteCollaborator,
  reactivateCollaborator,
  regenerateInvite,
  updateCollaborator,
  updateMeeting,
} from "./service";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Gestión de equipo (invitar, permisos, desactivar, regenerar link) es
// EXCLUSIVA del partner — ni editor ni lector, ningún colaborador gestiona
// invitaciones, permisos ni la cuenta de otros colaboradores (PR-8 §3/§7).
async function requirePartnerActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new AuthError("Sesión no válida.");
  if (actor.collaborator !== null) {
    throw new AuthError("Solo el dueño de la cuenta gestiona el equipo.");
  }
  return actor;
}

async function runPartnerOnly(
  fn: (actor: Actor) => Promise<void>,
): Promise<ActionResult> {
  try {
    const actor = await requirePartnerActor();
    await fn(actor);
    revalidatePath("/equipo");
    return { ok: true };
  } catch (err) {
    if (err instanceof TeamError || err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    console.error("Team action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

// Reuniones: las crean/editan partner Y editores (no lectores) — mismo
// contrato que crm/workspace/finance.
async function runEditor(fn: (actor: Actor) => Promise<void>): Promise<ActionResult> {
  try {
    const actor = await requireEditor();
    await fn(actor);
    revalidatePath("/equipo");
    return { ok: true };
  } catch (err) {
    if (err instanceof TeamError || err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    console.error("Team action error:", err);
    return { ok: false, error: "Algo salió mal. Intenta de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Colaboradores

const inviteSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  roleTitle: z.string().trim().max(60).nullish(),
  permission: z.enum(["editor", "lector"]),
});

export async function inviteCollaboratorAction(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult & { inviteUrl?: string }> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  let inviteUrl: string | undefined;
  const result = await runPartnerOnly(async (actor) => {
    const { token } = await inviteCollaborator(actor.partner.id, {
      email: parsed.data.email,
      roleTitle: parsed.data.roleTitle ?? null,
      permission: parsed.data.permission,
    });
    inviteUrl = `/invitacion/${token}`;
  });
  return result.ok ? { ...result, inviteUrl } : result;
}

const updateCollaboratorSchema = z.object({
  collaboratorId: z.string().uuid(),
  roleTitle: z.string().trim().max(60).nullish(),
  permission: z.enum(["editor", "lector"]).optional(),
});

export async function updateCollaboratorAction(
  input: z.input<typeof updateCollaboratorSchema>,
): Promise<ActionResult> {
  const parsed = updateCollaboratorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { collaboratorId, ...patch } = parsed.data;
  return runPartnerOnly((actor) =>
    updateCollaborator(actor.partner.id, collaboratorId, {
      ...(patch.roleTitle !== undefined ? { roleTitle: patch.roleTitle } : {}),
      ...(patch.permission !== undefined ? { permission: patch.permission } : {}),
    }),
  );
}

export async function deactivateCollaboratorAction(
  collaboratorId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(collaboratorId);
  if (!parsed.success) return { ok: false, error: "Colaborador inválido." };
  return runPartnerOnly((actor) => deactivateCollaborator(actor.partner.id, parsed.data));
}

export async function reactivateCollaboratorAction(
  collaboratorId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(collaboratorId);
  if (!parsed.success) return { ok: false, error: "Colaborador inválido." };
  return runPartnerOnly((actor) => reactivateCollaborator(actor.partner.id, parsed.data));
}

export async function regenerateInviteAction(
  collaboratorId: string,
): Promise<ActionResult & { inviteUrl?: string }> {
  const parsed = z.string().uuid().safeParse(collaboratorId);
  if (!parsed.success) return { ok: false, error: "Colaborador inválido." };
  let inviteUrl: string | undefined;
  const result = await runPartnerOnly(async (actor) => {
    const { token } = await regenerateInvite(actor.partner.id, parsed.data);
    inviteUrl = `/invitacion/${token}`;
  });
  return result.ok ? { ...result, inviteUrl } : result;
}

// ---------------------------------------------------------------------------
// Aceptar invitación (ruta pública /invitacion/[token]) — sin actor: esta
// action ES el mecanismo de login del colaborador, no pasa por run().

const acceptInviteSchema = z.object({
  token: z.string().trim().min(1),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export type AcceptInviteState = { error?: string };

export async function acceptInviteAction(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await acceptInvite(parsed.data.token, parsed.data.displayName);
  } catch (err) {
    if (err instanceof TeamError) return { error: err.message };
    console.error("acceptInviteAction error:", err);
    return { error: "No se pudo completar. Intenta de nuevo en unos momentos." };
  }

  // redirect() lanza una excepción de control de flujo: debe ir fuera del try.
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Reuniones

// Rango [hoy-1a, hoy+2a] — misma lección del bug de /clientes: fechas
// siempre acotadas en el borde, nunca solo `.datetime()` sin rango.
const boundedStartsAt = z
  .string()
  .datetime()
  .refine((value) => {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return false;
    const now = Date.now();
    const oneYearMs = 365 * 86_400_000;
    return time >= now - oneYearMs && time <= now + 2 * oneYearMs;
  }, "La fecha no es válida.");

const meetingSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio.").max(160),
  startsAt: boundedStartsAt,
  durationMinutes: z.number().int().min(5).max(480),
  note: z.string().trim().max(4000).nullish(),
  attendeeCollaboratorIds: z.array(z.string().uuid().nullable()).max(50),
});

export async function createMeetingAction(
  input: z.input<typeof meetingSchema>,
): Promise<ActionResult> {
  const parsed = meetingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;
  return runEditor(async (actor) => {
    await createMeeting(
      actor.partner.id,
      {
        title: data.title,
        startsAt: new Date(data.startsAt),
        durationMinutes: data.durationMinutes,
        note: data.note ?? null,
        attendeeCollaboratorIds: data.attendeeCollaboratorIds,
      },
      actor.collaborator?.id ?? null,
    );
  });
}

const meetingPatchSchema = z.object({
  meetingId: z.string().uuid(),
  title: z.string().trim().min(1).max(160).optional(),
  startsAt: boundedStartsAt.optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  note: z.string().trim().max(4000).nullish(),
  attendeeCollaboratorIds: z.array(z.string().uuid().nullable()).max(50).optional(),
});

export async function updateMeetingAction(
  input: z.input<typeof meetingPatchSchema>,
): Promise<ActionResult> {
  const parsed = meetingPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { meetingId, startsAt, note, ...rest } = parsed.data;
  return runEditor((actor) =>
    updateMeeting(actor.partner.id, meetingId, {
      ...rest,
      ...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
      ...(note !== undefined ? { note: note ?? null } : {}),
    }),
  );
}

export async function deleteMeetingAction(meetingId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(meetingId);
  if (!parsed.success) return { ok: false, error: "Reunión inválida." };
  return runEditor((actor) => deleteMeeting(actor.partner.id, parsed.data));
}
