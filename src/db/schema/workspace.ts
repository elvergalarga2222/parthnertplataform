import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./crm";
import { partners } from "./partners";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  leadId: uuid("lead_id")
    .notNull()
    .unique()
    .references(() => leads.id),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  clientId: uuid("client_id")
    .notNull()
    .unique()
    .references(() => clients.id),
  name: text("name").notNull(),
  // Vista de Cliente pública y capada (regla de negocio #7)
  clientViewToken: text("client_view_token").notNull().unique(),
  clientViewEnabled: boolean("client_view_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const KANBAN_STATUSES = [
  "por_hacer",
  "en_proceso",
  "en_estancamiento",
  "finalizado",
] as const;

export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

export const kanbanTasks = pgTable(
  "kanban_tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("por_hacer"),
    position: numeric("position", { precision: 16, scale: 6 })
      .notNull()
      .default("0"),
    isClientVisible: boolean("is_client_visible").notNull().default(true),
    dueDate: date("due_date"),
    stalledSince: timestamp("stalled_since", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "kanban_tasks_status_check",
      sql`${table.status} IN ('por_hacer', 'en_proceso', 'en_estancamiento', 'finalizado')`,
    ),
  ],
);

// Catálogo global de SOPs y prompts de IA que se inyectan al abrir un
// workspace (Épica 3: guiar al Partner paso a paso).
export const sopTemplates = pgTable(
  "sop_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull().unique(),
    kind: text("kind").notNull(),
    phase: text("phase"),
    body: text("body").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("sop_templates_kind_check", sql`${table.kind} IN ('sop', 'ai_prompt')`),
  ],
);

export const workspaceSops = pgTable("workspace_sops", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  templateId: uuid("template_id").references(() => sopTemplates.id),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
