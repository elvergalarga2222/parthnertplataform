import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Regla de negocio: revocación = congelar, no borrar (CLAUDE.md #2).
export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    skoolMemberId: text("skool_member_id").notNull().unique(),
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    status: text("status").notNull().default("active"),
    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("partners_status_check", sql`${table.status} IN ('active', 'frozen')`),
  ],
);

export const skoolMemberships = pgTable(
  "skool_memberships",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    groupId: text("group_id").notNull(),
    membershipStatus: text("membership_status").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "skool_memberships_status_check",
      sql`${table.membershipStatus} IN ('active', 'churned', 'removed')`,
    ),
  ],
);

export const accessAuditLog = pgTable("access_audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  partnerId: uuid("partner_id"),
  event: text("event").notNull(),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
