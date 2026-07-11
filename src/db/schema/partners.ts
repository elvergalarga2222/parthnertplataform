import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
    // --- Ciclo de vida de la renovación (PR-10) ---
    // Fin del periodo pagado según Skool; null si el provider no lo expone.
    currentPeriodEndsAt: timestamp("current_period_ends_at", {
      withTimezone: true,
    }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    // Cuándo se pierde el acceso si no renueva (fin de periodo, o plan B:
    // detección del churn + MEMBERSHIP_GRACE_DAYS).
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }),
    // Estado del ciclo de alerta — idempotencia del job (nunca re-alertar).
    alertState: text("alert_state").notNull().default("none"),
    // Fail-safe: nº de ejecuciones consecutivas del sync en las que el partner
    // no apareció en la respuesta del provider. Solo se actúa al llegar a 3.
    missingCount: integer("missing_count").notNull().default(0),
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
    check(
      "skool_memberships_alert_state_check",
      sql`${table.alertState} IN ('none', 'expiring_notified', 'frozen_auto')`,
    ),
    // Upsert idempotente del job de sincronización.
    uniqueIndex("skool_memberships_partner_group_unique").on(
      table.partnerId,
      table.groupId,
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
