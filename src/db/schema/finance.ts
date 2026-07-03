import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";
import { clients } from "./workspace";

// Ingresos clasificados por vehículo — alimentan la Regla 70/30 (Épica 5).
export const revenueEntries = pgTable(
  "revenue_entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    clientId: uuid("client_id").references(() => clients.id),
    kind: text("kind").notNull(),
    concept: text("concept").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    entryDate: date("entry_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "revenue_entries_kind_check",
      sql`${table.kind} IN ('consultoria', 'asesoria_mensual')`,
    ),
  ],
);

export const receivables = pgTable(
  "receivables",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    clientId: uuid("client_id").references(() => clients.id),
    concept: text("concept").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: date("due_date").notNull(),
    status: text("status").notNull().default("pendiente"),
    recurrence: text("recurrence"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "receivables_status_check",
      sql`${table.status} IN ('pendiente', 'pagado', 'vencido')`,
    ),
    check(
      "receivables_recurrence_check",
      sql`${table.recurrence} IS NULL OR ${table.recurrence} IN ('monthly')`,
    ),
  ],
);

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  category: text("category").notNull(),
  concept: text("concept").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  entryDate: date("entry_date").notNull(),
  isRecurring: boolean("is_recurring").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
