import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";
import { deals } from "./crm";

// Workspace module (Fase 3): one operational workspace per won client.
// Workspaces are auto-created by a DB trigger when a deal enters a stage
// with is_won = true (see migration 0003_workspace_trigger).

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull(),
    status: text("status").notNull().default("activo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspaces_partner_idx").on(table.partnerId),
    // One workspace per deal: makes the auto-create trigger idempotent.
    uniqueIndex("workspaces_deal_unique").on(table.dealId),
    check(
      "workspaces_status_check",
      sql`${table.status} IN ('activo', 'pausado', 'finalizado')`,
    ),
  ],
);

// Client profile: fixed fields + free-form extras (same philosophy as
// custom_fields, but scoped to a single workspace so jsonb is enough).
export const workspaceProfiles = pgTable("workspace_profiles", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  businessName: text("business_name"),
  industry: text("industry"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  notes: text("notes"),
  extra: jsonb("extra").notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const kanbanColumns = pgTable(
  "kanban_columns",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    // SOP guide shown when the column is selected. Markdown/plain text.
    // A sop_prompt_id reference to ai_prompts arrives with the AI module PR.
    sopContent: text("sop_content"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("kanban_columns_workspace_idx").on(table.workspaceId)],
);

export const kanbanCards = pgTable(
  "kanban_cards",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => kanbanColumns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    // Free-text assignee: there is no team/users table yet. Becomes a FK when
    // multi-user per partner lands.
    assignee: text("assignee"),
    dueDate: date("due_date"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("kanban_cards_workspace_idx").on(table.workspaceId),
    index("kanban_cards_column_idx").on(table.columnId),
  ],
);
