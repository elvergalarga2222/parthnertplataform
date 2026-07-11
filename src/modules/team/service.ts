import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  collaborators,
  meetingAttendees,
  meetings,
  partners,
} from "@/db/schema";
import { toIsoOrEpoch, toIsoOrNull } from "@/lib/dates";
import {
  createCollaboratorSession,
  revokeCollaboratorSessions,
} from "@/modules/auth/session";
import type {
  CollaboratorPermission,
  CollaboratorStatus,
  CollaboratorView,
  MeetingAttendeeView,
  MeetingView,
} from "./types";

export class TeamError extends Error {}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

function generateInviteToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash, expiresAt: new Date(Date.now() + INVITE_TTL_MS) };
}

function toCollaboratorView(row: typeof collaborators.$inferSelect): CollaboratorView {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    roleTitle: row.roleTitle,
    permission: row.permission as CollaboratorPermission,
    status: row.status as CollaboratorStatus,
    inviteExpiresAt: toIsoOrNull(row.inviteExpiresAt),
    lastLoginAt: toIsoOrNull(row.lastLoginAt),
    createdAt: toIsoOrEpoch(row.createdAt),
  };
}

export async function listTeam(partnerId: string): Promise<CollaboratorView[]> {
  const rows = await db
    .select()
    .from(collaborators)
    .where(eq(collaborators.partnerId, partnerId))
    .orderBy(desc(collaborators.createdAt));
  return rows.map(toCollaboratorView);
}

/** Shape { name, role } consumido por Sidebar — reemplaza el demo getTeam(). */
export async function listTeamForSidebar(
  partnerId: string,
): Promise<{ name: string; role: string }[]> {
  const rows = await db
    .select({
      displayName: collaborators.displayName,
      email: collaborators.email,
      roleTitle: collaborators.roleTitle,
      permission: collaborators.permission,
    })
    .from(collaborators)
    .where(
      and(eq(collaborators.partnerId, partnerId), eq(collaborators.status, "activo")),
    )
    .orderBy(desc(collaborators.createdAt));

  return rows.map((r) => ({
    name: r.displayName ?? r.email,
    role: r.roleTitle ?? (r.permission === "editor" ? "Editor" : "Lector"),
  }));
}

export async function inviteCollaborator(
  partnerId: string,
  input: {
    email: string;
    roleTitle: string | null;
    permission: CollaboratorPermission;
  },
): Promise<{ collaboratorId: string; token: string; expiresAt: string }> {
  const email = input.email.toLowerCase().trim();
  const { token, hash, expiresAt } = generateInviteToken();

  const [existing] = await db
    .select({ id: collaborators.id, status: collaborators.status })
    .from(collaborators)
    .where(and(eq(collaborators.partnerId, partnerId), eq(collaborators.email, email)));

  if (existing) {
    if (existing.status !== "invitado") {
      throw new TeamError("Ese correo ya es parte de tu equipo.");
    }
    // Invitación pendiente: reenviar = regenerar su token con los datos nuevos.
    await db
      .update(collaborators)
      .set({
        roleTitle: input.roleTitle,
        permission: input.permission,
        inviteTokenHash: hash,
        inviteExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(collaborators.id, existing.id));
    return { collaboratorId: existing.id, token, expiresAt: toIsoOrEpoch(expiresAt) };
  }

  const [row] = await db
    .insert(collaborators)
    .values({
      partnerId,
      email,
      roleTitle: input.roleTitle,
      permission: input.permission,
      status: "invitado",
      inviteTokenHash: hash,
      inviteExpiresAt: expiresAt,
    })
    .returning({ id: collaborators.id });

  return { collaboratorId: row.id, token, expiresAt: toIsoOrEpoch(expiresAt) };
}

export interface InvitePreview {
  collaboratorId: string;
  partnerDisplayName: string;
  /** true = primera aceptación (pide nombre); false = redención de link regenerado. */
  needsDisplayName: boolean;
}

export async function getInviteByToken(token: string): Promise<InvitePreview | null> {
  const hash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  const [row] = await db
    .select({
      id: collaborators.id,
      status: collaborators.status,
      inviteExpiresAt: collaborators.inviteExpiresAt,
      partnerId: collaborators.partnerId,
    })
    .from(collaborators)
    .where(eq(collaborators.inviteTokenHash, hash));

  if (!row || row.status === "desactivado") return null;
  if (!row.inviteExpiresAt || row.inviteExpiresAt < now) return null;

  const [partner] = await db
    .select({ displayName: partners.displayName, email: partners.email, status: partners.status })
    .from(partners)
    .where(eq(partners.id, row.partnerId));
  if (!partner || partner.status !== "active") return null;

  return {
    collaboratorId: row.id,
    partnerDisplayName: partner.displayName ?? partner.email,
    needsDisplayName: row.status === "invitado",
  };
}

/**
 * Consume un token de invitación (primera vez, pide `displayName`) o de
 * acceso regenerado (colaborador ya `activo`, re-login — opción B de la
 * PREGUNTA 4: sesión de 30 días + "Regenerar acceso" desde /equipo). Ambos
 * casos comparten el mismo par inviteTokenHash/inviteExpiresAt en la fila del
 * colaborador — no hay tabla de tokens separada — y el token se limpia al
 * consumirse (un solo uso) sea cual sea el caso.
 */
export async function acceptInvite(
  token: string,
  displayName?: string,
): Promise<{ partnerId: string; collaboratorId: string }> {
  const hash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  const [row] = await db
    .select()
    .from(collaborators)
    .where(eq(collaborators.inviteTokenHash, hash));
  if (!row) throw new TeamError("Invitación inválida o ya usada.");
  if (row.status === "desactivado") throw new TeamError("Este acceso fue desactivado.");
  if (!row.inviteExpiresAt || row.inviteExpiresAt < now) {
    throw new TeamError("La invitación venció.");
  }

  const [partner] = await db
    .select({ status: partners.status })
    .from(partners)
    .where(eq(partners.id, row.partnerId));
  if (!partner || partner.status !== "active") throw new TeamError("Invitación inválida.");

  if (row.status === "invitado") {
    const name = displayName?.trim();
    if (!name) throw new TeamError("Ingresa tu nombre.");
    await db
      .update(collaborators)
      .set({
        displayName: name,
        status: "activo",
        acceptedAt: now,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(collaborators.id, row.id));
  } else {
    await db
      .update(collaborators)
      .set({
        inviteTokenHash: null,
        inviteExpiresAt: null,
        lastLoginAt: now,
        updatedAt: now,
      })
      .where(eq(collaborators.id, row.id));
  }

  await createCollaboratorSession(row.partnerId, row.id);
  return { partnerId: row.partnerId, collaboratorId: row.id };
}

export async function updateCollaborator(
  partnerId: string,
  collaboratorId: string,
  patch: { roleTitle?: string | null; permission?: CollaboratorPermission },
): Promise<void> {
  const result = await db
    .update(collaborators)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(collaborators.id, collaboratorId), eq(collaborators.partnerId, partnerId)),
    )
    .returning({ id: collaborators.id });
  if (result.length === 0) throw new TeamError("Colaborador no encontrado.");
}

export async function deactivateCollaborator(
  partnerId: string,
  collaboratorId: string,
): Promise<void> {
  const result = await db
    .update(collaborators)
    .set({ status: "desactivado", updatedAt: new Date() })
    .where(
      and(eq(collaborators.id, collaboratorId), eq(collaborators.partnerId, partnerId)),
    )
    .returning({ id: collaborators.id });
  if (result.length === 0) throw new TeamError("Colaborador no encontrado.");
  // Lo expulsa en el siguiente request: revoca SOLO sus sesiones.
  await revokeCollaboratorSessions(collaboratorId);
}

/** Reactivar NO revive sesiones — vuelve a entrar con un link nuevo (PREGUNTA 4). */
export async function reactivateCollaborator(
  partnerId: string,
  collaboratorId: string,
): Promise<void> {
  const result = await db
    .update(collaborators)
    .set({ status: "activo", updatedAt: new Date() })
    .where(
      and(
        eq(collaborators.id, collaboratorId),
        eq(collaborators.partnerId, partnerId),
        eq(collaborators.status, "desactivado"),
      ),
    )
    .returning({ id: collaborators.id });
  if (result.length === 0) {
    throw new TeamError("Colaborador no encontrado o no está desactivado.");
  }
}

export async function regenerateInvite(
  partnerId: string,
  collaboratorId: string,
): Promise<{ token: string; expiresAt: string }> {
  const [existing] = await db
    .select({ status: collaborators.status })
    .from(collaborators)
    .where(
      and(eq(collaborators.id, collaboratorId), eq(collaborators.partnerId, partnerId)),
    );
  if (!existing) throw new TeamError("Colaborador no encontrado.");
  if (existing.status === "desactivado") {
    throw new TeamError("No se puede generar un link de acceso para un colaborador desactivado.");
  }

  const { token, hash, expiresAt } = generateInviteToken();
  await db
    .update(collaborators)
    .set({ inviteTokenHash: hash, inviteExpiresAt: expiresAt, updatedAt: new Date() })
    .where(eq(collaborators.id, collaboratorId));
  return { token, expiresAt: toIsoOrEpoch(expiresAt) };
}

// ---------------------------------------------------------------------------
// Reuniones

async function assertOwnedCollaborator(
  partnerId: string,
  collaboratorId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: collaborators.id })
    .from(collaborators)
    .where(
      and(eq(collaborators.id, collaboratorId), eq(collaborators.partnerId, partnerId)),
    );
  if (!row) throw new TeamError("Colaborador no encontrado.");
}

export interface MeetingInput {
  title: string;
  startsAt: Date;
  durationMinutes: number;
  note: string | null;
  /** null en la lista = el propio partner asiste ("Yo"). */
  attendeeCollaboratorIds: (string | null)[];
}

async function replaceAttendees(
  tx: Pick<typeof db, "insert" | "delete">,
  meetingId: string,
  attendeeCollaboratorIds: (string | null)[],
): Promise<void> {
  await tx.delete(meetingAttendees).where(eq(meetingAttendees.meetingId, meetingId));
  const unique = [...new Set(attendeeCollaboratorIds)];
  if (unique.length === 0) return;
  await tx
    .insert(meetingAttendees)
    .values(unique.map((collaboratorId) => ({ meetingId, collaboratorId })));
}

export async function createMeeting(
  partnerId: string,
  input: MeetingInput,
  createdByCollaboratorId: string | null,
): Promise<string> {
  for (const id of input.attendeeCollaboratorIds) {
    if (id) await assertOwnedCollaborator(partnerId, id);
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(meetings)
      .values({
        partnerId,
        title: input.title,
        startsAt: input.startsAt,
        durationMinutes: input.durationMinutes,
        note: input.note,
        createdByCollaboratorId,
      })
      .returning({ id: meetings.id });

    await replaceAttendees(tx, row.id, input.attendeeCollaboratorIds);
    return row.id;
  });
}

export async function updateMeeting(
  partnerId: string,
  meetingId: string,
  patch: Partial<MeetingInput>,
): Promise<void> {
  const { attendeeCollaboratorIds, ...rest } = patch;
  if (attendeeCollaboratorIds) {
    for (const id of attendeeCollaboratorIds) {
      if (id) await assertOwnedCollaborator(partnerId, id);
    }
  }

  await db.transaction(async (tx) => {
    const result = await tx
      .update(meetings)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(meetings.id, meetingId), eq(meetings.partnerId, partnerId)))
      .returning({ id: meetings.id });
    if (result.length === 0) throw new TeamError("Reunión no encontrada.");

    if (attendeeCollaboratorIds) {
      await replaceAttendees(tx, meetingId, attendeeCollaboratorIds);
    }
  });
}

export async function deleteMeeting(partnerId: string, meetingId: string): Promise<void> {
  const result = await db
    .delete(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.partnerId, partnerId)))
    .returning({ id: meetings.id });
  if (result.length === 0) throw new TeamError("Reunión no encontrada.");
}

export async function listMeetings(
  partnerId: string,
  range?: { from?: Date; to?: Date },
): Promise<MeetingView[]> {
  const conditions = [eq(meetings.partnerId, partnerId)];
  if (range?.from) conditions.push(gte(meetings.startsAt, range.from));
  if (range?.to) conditions.push(lte(meetings.startsAt, range.to));

  const rows = await db
    .select()
    .from(meetings)
    .where(and(...conditions))
    .orderBy(desc(meetings.startsAt));
  if (rows.length === 0) return [];

  const meetingIds = rows.map((r) => r.id);
  const attendeeRows = await db
    .select({
      meetingId: meetingAttendees.meetingId,
      collaboratorId: meetingAttendees.collaboratorId,
      collaboratorName: collaborators.displayName,
      collaboratorEmail: collaborators.email,
    })
    .from(meetingAttendees)
    .leftJoin(collaborators, eq(meetingAttendees.collaboratorId, collaborators.id))
    .where(inArray(meetingAttendees.meetingId, meetingIds));

  const [partner] = await db
    .select({ displayName: partners.displayName, email: partners.email })
    .from(partners)
    .where(eq(partners.id, partnerId));
  const partnerName = partner?.displayName ?? partner?.email ?? "Yo";

  const attendeesByMeeting = new Map<string, MeetingAttendeeView[]>();
  for (const a of attendeeRows) {
    const list = attendeesByMeeting.get(a.meetingId) ?? [];
    list.push({
      collaboratorId: a.collaboratorId,
      name: a.collaboratorId
        ? (a.collaboratorName ?? a.collaboratorEmail ?? "Colaborador")
        : partnerName,
    });
    attendeesByMeeting.set(a.meetingId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: toIsoOrEpoch(row.startsAt),
    durationMinutes: row.durationMinutes,
    note: row.note,
    attendees: attendeesByMeeting.get(row.id) ?? [],
    createdAt: toIsoOrEpoch(row.createdAt),
  }));
}
