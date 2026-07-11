import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
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
    // Default currency for new invoices/expenses/budgets (COP/USD/EUR). Each
    // record can still override it — there is no cross-currency conversion.
    defaultCurrency: text("default_currency").notNull().default("USD"),
    // Feedback de testers (PR-15): ve el botón flotante de reporte. Los
    // emails de ADMIN_EMAILS cuentan siempre como testers implícitos
    // (ver feedback/service.ts) sin necesidad de tocar esta columna.
    isTester: boolean("is_tester").notNull().default(false),
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
    check(
      "partners_default_currency_check",
      sql`${table.defaultCurrency} IN ('COP', 'USD', 'EUR')`,
    ),
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
