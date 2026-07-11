import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";

// Equipo / colaboradores (PR-8) — excepción documentada a CLAUDE.md regla #1:
// colaboradores se invitan por email SIN pasar por Skool. No son Partners: son
// invitados subordinados a la cuenta de un partner, y su acceso vive y muere
// con el partner que los invitó (congelar al partner corta también a sus
// colaboradores — ver auth/service.ts getCurrentActor).
export const collaborators = pgTable(
  "collaborators",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    email: text("email").notNull(),
    // Lo fija el colaborador al aceptar la invitación; NULL antes.
    displayName: text("display_name"),
    // Cargo visible ("Head of Sales") — puramente cosmético, no otorga nada.
    roleTitle: text("role_title"),
    // Permisos reales (dos niveles, sin granularidad por módulo — ver auth).
    permission: text("permission").notNull().default("lector"),
    status: text("status").notNull().default("invitado"),
    inviteTokenHash: text("invite_token_hash"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("collaborators_partner_idx").on(table.partnerId),
    // Un email invitable una vez por partner; el mismo email puede colaborar
    // con varios partners distintos por separado.
    uniqueIndex("collaborators_partner_email_unique").on(
      table.partnerId,
      table.email,
    ),
    uniqueIndex("collaborators_invite_token_hash_unique").on(
      table.inviteTokenHash,
    ),
    check(
      "collaborators_permission_check",
      sql`${table.permission} IN ('editor', 'lector')`,
    ),
    check(
      "collaborators_status_check",
      sql`${table.status} IN ('invitado', 'activo', 'desactivado')`,
    ),
  ],
);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    note: text("note"),
    // NULL = la creó el partner directamente.
    createdByCollaboratorId: uuid("created_by_collaborator_id").references(
      () => collaborators.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("meetings_partner_idx").on(table.partnerId),
    index("meetings_starts_at_idx").on(table.startsAt),
  ],
);

export const meetingAttendees = pgTable(
  "meeting_attendees",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    // NULL = asiste el propio partner.
    collaboratorId: uuid("collaborator_id").references(() => collaborators.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("meeting_attendees_meeting_collaborator_unique").on(
      table.meetingId,
      table.collaboratorId,
    ),
    index("meeting_attendees_meeting_idx").on(table.meetingId),
  ],
);
