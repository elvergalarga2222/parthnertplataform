import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL) && Boolean(process.env.REDIS_URL);

// acceptInvite crea sesión (createCollaboratorSession -> cookies()).
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

describe.skipIf(!hasDb)("team service (integration)", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let team: typeof import("./service");

  let partnerA: string;
  let partnerB: string;
  const createdPartners: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    team = await import("./service");

    for (const label of ["a", "b"] as const) {
      const [row] = await db
        .insert(schema.partners)
        .values({
          skoolMemberId: `test:${randomUUID()}`,
          email: `test-team-${label}-${randomUUID()}@test.dev`,
          displayName: `Test Team ${label}`,
        })
        .returning({ id: schema.partners.id });
      createdPartners.push(row.id);
    }
    [partnerA, partnerB] = createdPartners;
  });

  afterAll(async () => {
    if (!hasDb || createdPartners.length === 0) return;
    const { inArray, eq } = await import("drizzle-orm");
    const meetingRows = await db
      .select({ id: schema.meetings.id })
      .from(schema.meetings)
      .where(inArray(schema.meetings.partnerId, createdPartners));
    if (meetingRows.length) {
      await db.delete(schema.meetingAttendees).where(
        inArray(schema.meetingAttendees.meetingId, meetingRows.map((m) => m.id)),
      );
    }
    await db.delete(schema.meetings).where(inArray(schema.meetings.partnerId, createdPartners));
    await db.delete(schema.collaborators).where(inArray(schema.collaborators.partnerId, createdPartners));
    for (const id of createdPartners) {
      await db.delete(schema.partners).where(eq(schema.partners.id, id));
    }
  });

  it("invites a collaborator, then accepts the invite (first time, requires displayName)", async () => {
    const { collaboratorId, token } = await team.inviteCollaborator(partnerA, {
      email: `invitee-${randomUUID()}@test.dev`,
      roleTitle: "Ops",
      permission: "editor",
    });

    const preview = await team.getInviteByToken(token);
    expect(preview).toEqual({
      collaboratorId,
      partnerDisplayName: expect.any(String),
      needsDisplayName: true,
    });

    await expect(team.acceptInvite(token)).rejects.toThrow(/nombre/i);

    const accepted = await team.acceptInvite(token, "Jane Doe");
    expect(accepted).toEqual({ partnerId: partnerA, collaboratorId });

    const rows = await team.listTeam(partnerA);
    const row = rows.find((r) => r.id === collaboratorId)!;
    expect(row.status).toBe("activo");
    expect(row.displayName).toBe("Jane Doe");

    // Un solo uso: reintentar el mismo token ya falla.
    await expect(team.acceptInvite(token, "Otro nombre")).rejects.toThrow(/inválida/i);
  });

  it("rejects an expired invite token", async () => {
    const { eq } = await import("drizzle-orm");
    const { collaboratorId, token } = await team.inviteCollaborator(partnerA, {
      email: `expired-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "lector",
    });
    await db
      .update(schema.collaborators)
      .set({ inviteExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.collaborators.id, collaboratorId));

    await expect(team.acceptInvite(token, "Nombre")).rejects.toThrow(/venció/i);
  });

  it("regenerateInvite lets an already-active collaborator redeem a fresh link (re-login, PREGUNTA 4 opción B)", async () => {
    const { collaboratorId, token: firstToken } = await team.inviteCollaborator(partnerA, {
      email: `reentry-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    await team.acceptInvite(firstToken, "Re Entry");

    const { token: freshToken } = await team.regenerateInvite(partnerA, collaboratorId);
    expect(freshToken).not.toBe(firstToken);

    const preview = await team.getInviteByToken(freshToken);
    expect(preview).toEqual({
      collaboratorId,
      partnerDisplayName: expect.any(String),
      needsDisplayName: false,
    });

    const result = await team.acceptInvite(freshToken);
    expect(result).toEqual({ partnerId: partnerA, collaboratorId });
  });

  it("blocks a deactivated collaborator from redeeming any token, even a freshly regenerated one", async () => {
    const { collaboratorId, token: firstToken } = await team.inviteCollaborator(partnerA, {
      email: `deactivated-reentry-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    await team.acceptInvite(firstToken, "Will Be Deactivated");
    await team.deactivateCollaborator(partnerA, collaboratorId);

    await expect(team.regenerateInvite(partnerA, collaboratorId)).rejects.toThrow(
      /desactivado/i,
    );
  });

  it("reactivating a collaborator does NOT revive sessions — needs a fresh link", async () => {
    const { collaboratorId, token } = await team.inviteCollaborator(partnerA, {
      email: `reactivate-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    await team.acceptInvite(token, "Reactivate Me");
    await team.deactivateCollaborator(partnerA, collaboratorId);
    await team.reactivateCollaborator(partnerA, collaboratorId);

    const rows = await team.listTeam(partnerA);
    const row = rows.find((r) => r.id === collaboratorId)!;
    expect(row.status).toBe("activo");
    // Sin token vivo: solo "Regenerar acceso" (regenerateInvite) le devuelve entrada.
    expect(row.inviteExpiresAt).toBeNull();
  });

  it("isolation: the same email can be invited independently by two different partners", async () => {
    const email = `shared-${randomUUID()}@test.dev`;
    const invA = await team.inviteCollaborator(partnerA, {
      email,
      roleTitle: null,
      permission: "lector",
    });
    const invB = await team.inviteCollaborator(partnerB, {
      email,
      roleTitle: null,
      permission: "editor",
    });
    expect(invA.collaboratorId).not.toBe(invB.collaboratorId);

    const rowsA = await team.listTeam(partnerA);
    const rowsB = await team.listTeam(partnerB);
    expect(rowsA.some((r) => r.id === invB.collaboratorId)).toBe(false);
    expect(rowsB.some((r) => r.id === invA.collaboratorId)).toBe(false);
  });

  it("cannot invite the same email twice for the same partner once already active", async () => {
    const email = `dup-${randomUUID()}@test.dev`;
    const first = await team.inviteCollaborator(partnerA, {
      email,
      roleTitle: null,
      permission: "editor",
    });
    await team.acceptInvite(first.token, "Original");

    await expect(
      team.inviteCollaborator(partnerA, { email, roleTitle: null, permission: "lector" }),
    ).rejects.toThrow(/ya es parte/i);
  });

  it("meetings: create, list, update attendees, delete — and reject a collaborator from another partner", async () => {
    const invite = await team.inviteCollaborator(partnerA, {
      email: `attendee-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    await team.acceptInvite(invite.token, "Attendee One");

    const otherPartnerInvite = await team.inviteCollaborator(partnerB, {
      email: `other-partner-${randomUUID()}@test.dev`,
      roleTitle: null,
      permission: "editor",
    });
    await team.acceptInvite(otherPartnerInvite.token, "Not Mine");

    await expect(
      team.createMeeting(
        partnerA,
        {
          title: "Reunión inválida",
          startsAt: new Date(Date.now() + 86_400_000),
          durationMinutes: 30,
          note: null,
          attendeeCollaboratorIds: [otherPartnerInvite.collaboratorId],
        },
        null,
      ),
    ).rejects.toThrow(/no encontrado/i);

    const meetingId = await team.createMeeting(
      partnerA,
      {
        title: "Sync de equipo",
        startsAt: new Date(Date.now() + 86_400_000),
        durationMinutes: 30,
        note: "Agenda inicial",
        attendeeCollaboratorIds: [null, invite.collaboratorId],
      },
      null,
    );

    let meetings = await team.listMeetings(partnerA);
    let meeting = meetings.find((m) => m.id === meetingId)!;
    expect(meeting.attendees).toHaveLength(2);
    expect(meeting.attendees.some((a) => a.collaboratorId === null)).toBe(true);
    expect(meeting.attendees.some((a) => a.collaboratorId === invite.collaboratorId)).toBe(true);

    // Deactivating the attendee's account must not break the historical meeting.
    await team.deactivateCollaborator(partnerA, invite.collaboratorId);
    meetings = await team.listMeetings(partnerA);
    meeting = meetings.find((m) => m.id === meetingId)!;
    expect(meeting.attendees).toHaveLength(2);

    await team.updateMeeting(partnerA, meetingId, { attendeeCollaboratorIds: [null] });
    meetings = await team.listMeetings(partnerA);
    meeting = meetings.find((m) => m.id === meetingId)!;
    expect(meeting.attendees).toHaveLength(1);

    await team.deleteMeeting(partnerA, meetingId);
    meetings = await team.listMeetings(partnerA);
    expect(meetings.some((m) => m.id === meetingId)).toBe(false);
  });
});
