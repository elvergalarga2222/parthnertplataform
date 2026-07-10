import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";
import { workspaces } from "./workspace";

// Partner Business module (Fase 4): invoices, expenses and budget projections.
// Every tenant table carries partner_id (CLAUDE.md #3) — queries must always
// scope by it through src/modules/finance/service.ts.
//
// Multi-currency: each record knows its own currency (COP/USD/EUR). There is NO
// automatic conversion — a partner may bill different clients in different
// currencies, so aggregation views group by currency to avoid mixing amounts.
// The partner's default_currency (see partners.ts) only seeds new records.

// Reusable CHECK fragment for the currency columns across finance tables.
const CURRENCIES = "('COP', 'USD', 'EUR')";

// Monthly budget/projection: what the partner plans to bill and spend in a
// given month. One row per (partner, month) — the currency is the partner's
// default at creation time.
export const budgetProjections = pgTable(
  "budget_projections",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    // First day of the month the projection applies to.
    month: date("month").notNull(),
    projectedRevenue: numeric("projected_revenue").notNull().default("0"),
    budgetExpenses: numeric("budget_expenses").notNull().default("0"),
    // Meta de profit del mes ("sueldo objetivo"). 0 = sin meta definida.
    targetProfit: numeric("target_profit").notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("budget_projections_partner_idx").on(table.partnerId),
    uniqueIndex("budget_projections_month_unique").on(
      table.partnerId,
      table.month,
    ),
    check(
      "budget_projections_currency_check",
      sql`${table.currency} IN ${sql.raw(CURRENCIES)}`,
    ),
  ],
);

// Accounts receivable. status drives the overdue/near-due alerts. external_ref
// is the idempotency key for the n8n webhook (unique per partner) so a payment
// confirmed via automation can be replayed without creating duplicates.
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    clientName: text("client_name").notNull(),
    description: text("description"),
    amount: numeric("amount").notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("pendiente"),
    // Tipo de ingreso — alimenta la regla 70/30 (ARQUITECTURA §4.5): la
    // asesoría recurrente no debe superar el 30% de lo cobrado.
    kind: text("kind").notNull().default("proyecto"),
    issuedAt: date("issued_at").notNull().defaultNow(),
    dueDate: date("due_date"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Idempotency key for the external automation (n8n). NULL for manual
    // invoices; unique per partner when present.
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invoices_partner_idx").on(table.partnerId),
    index("invoices_workspace_idx").on(table.workspaceId),
    index("invoices_status_idx").on(table.status),
    index("invoices_due_idx").on(table.dueDate),
    // NULLs are distinct in Postgres, so manual invoices (external_ref NULL)
    // never collide; only automation-created refs are deduplicated.
    uniqueIndex("invoices_external_ref_unique").on(
      table.partnerId,
      table.externalRef,
    ),
    check(
      "invoices_status_check",
      sql`${table.status} IN ('pendiente', 'pagado', 'vencido')`,
    ),
    check(
      "invoices_kind_check",
      sql`${table.kind} IN ('proyecto', 'asesoria_mensual', 'otro')`,
    ),
    check(
      "invoices_currency_check",
      sql`${table.currency} IN ${sql.raw(CURRENCIES)}`,
    ),
  ],
);

// Operational expenses. Categories are the real cost buckets of a digital
// strategist (IA, video production tools, hosting, freelancers, SaaS).
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    category: text("category").notNull().default("otro"),
    description: text("description"),
    amount: numeric("amount").notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    incurredAt: date("incurred_at").notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("expenses_partner_idx").on(table.partnerId),
    index("expenses_incurred_idx").on(table.incurredAt),
    check(
      "expenses_category_check",
      sql`${table.category} IN ('ia', 'produccion_video', 'hosting_vps', 'freelancer', 'herramientas_saas', 'otro')`,
    ),
    check(
      "expenses_currency_check",
      sql`${table.currency} IN ${sql.raw(CURRENCIES)}`,
    ),
  ],
);
