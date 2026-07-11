import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { partners } from "./partners";

// Reportes de bugs/sugerencias de testers (PR-15). No expuesto por ninguna
// vista pública por token (regla de la vista de cliente): solo el propio
// partner que lo creó y el operador (panel admin) pueden verlos.
export const feedbackReports = pgTable(
  "feedback_reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    route: text("route").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("nuevo"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_reports_partner_idx").on(table.partnerId),
    index("feedback_reports_status_idx").on(table.status),
    index("feedback_reports_created_idx").on(table.createdAt),
    check(
      "feedback_reports_type_check",
      sql`${table.type} IN ('bug', 'sugerencia')`,
    ),
    check(
      "feedback_reports_status_check",
      sql`${table.status} IN ('nuevo', 'revisado', 'resuelto')`,
    ),
  ],
);
