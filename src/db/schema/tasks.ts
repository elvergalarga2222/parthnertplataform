import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { collaborators } from "./team";
import { deals } from "./crm";
import { partners } from "./partners";
import { workspaces } from "./workspace";

// Lista transversal "qué tengo que hacer yo/mi equipo" (PR-9) — distinta de
// kanban_cards (el tablero de ENTREGA del cliente). No confundir ni fusionar.
//
// NUNCA se expone por el token público de la vista de cliente (fase 3): esta
// tabla es 100% interna del equipo del partner.
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pendiente"),
    priority: text("priority"),
    dueDate: date("due_date"),
    // NULL = asignada al propio partner.
    assigneeCollaboratorId: uuid("assignee_collaborator_id").references(
      () => collaborators.id,
      { onDelete: "set null" },
    ),
    // Vínculos opcionales y NO excluyentes entre sí (un deal ganado ya tiene
    // workspace; "preparar kickoff" pertenece a ambos).
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
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
    index("tasks_partner_idx").on(table.partnerId),
    index("tasks_deal_idx").on(table.dealId),
    index("tasks_workspace_idx").on(table.workspaceId),
    index("tasks_partner_status_idx").on(table.partnerId, table.status),
    index("tasks_partner_due_idx").on(table.partnerId, table.dueDate),
    check(
      "tasks_status_check",
      sql`${table.status} IN ('pendiente', 'en_progreso', 'hecha')`,
    ),
    check(
      "tasks_priority_check",
      sql`${table.priority} IS NULL OR ${table.priority} IN ('baja', 'media', 'alta')`,
    ),
  ],
);
