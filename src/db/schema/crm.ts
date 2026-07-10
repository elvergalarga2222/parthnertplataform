import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";

// CRM module (Fase 2): companies, contacts, configurable pipeline and deals.
// Every tenant table carries partner_id (CLAUDE.md #3) — queries must always
// scope by it through src/modules/crm/service.ts.

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    name: text("name").notNull(),
    domain: text("domain"),
    logoUrl: text("logo_url"),
    employees: integer("employees"),
    fundingAmount: numeric("funding_amount"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("companies_partner_idx").on(table.partnerId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("contacts_partner_idx").on(table.partnerId)],
);

// Stage colors are named slots of the dark-theme ramp (see STAGE_COLORS in the
// UI), not raw hexes, so a partner can't pick an inaccessible color.
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    name: text("name").notNull(),
    color: text("color").notNull().default("gray"),
    position: integer("position").notNull(),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("pipeline_stages_partner_idx").on(table.partnerId),
    check(
      "pipeline_stages_color_check",
      sql`${table.color} IN ('gray', 'purple', 'violet', 'teal', 'amber', 'coral', 'green', 'blue')`,
    ),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStages.id),
    title: text("title").notNull(),
    value: numeric("value").notNull().default("0"),
    currency: text("currency").notNull().default("EUR"),
    nextActivity: text("next_activity"),
    nextActivityAt: timestamp("next_activity_at", { withTimezone: true }),
    fit: text("fit"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deals_partner_idx").on(table.partnerId),
    index("deals_stage_idx").on(table.stageId),
    check(
      "deals_fit_check",
      sql`${table.fit} IS NULL OR ${table.fit} IN ('bajo', 'medio', 'bueno', 'excelente')`,
    ),
    // Postgres acepta timestamps (año 294276, 'infinity') que JavaScript no
    // puede representar; una fila así envenena el render de /clientes.
    check(
      "deals_next_activity_at_range_check",
      sql`${table.nextActivityAt} IS NULL OR (${table.nextActivityAt} >= '1900-01-01' AND ${table.nextActivityAt} < '2200-01-01')`,
    ),
  ],
);

export const dealActivity = pgTable(
  "deal_activity",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("deal_activity_deal_idx").on(table.dealId),
    check(
      "deal_activity_type_check",
      sql`${table.type} IN ('stage_change', 'note', 'call', 'email', 'created')`,
    ),
  ],
);

// Custom columns without schema migrations: definitions per partner + EAV
// values. field_key is a stable slug derived from the label.
export const customFields = pgTable(
  "custom_fields",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    entity: text("entity").notNull(),
    fieldKey: text("field_key").notNull(),
    label: text("label").notNull(),
    fieldType: text("field_type").notNull(),
    options: jsonb("options"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("custom_fields_partner_idx").on(table.partnerId),
    uniqueIndex("custom_fields_key_unique").on(
      table.partnerId,
      table.entity,
      table.fieldKey,
    ),
    check(
      "custom_fields_entity_check",
      sql`${table.entity} IN ('deal', 'contact', 'company')`,
    ),
    check(
      "custom_fields_type_check",
      sql`${table.fieldType} IN ('text', 'number', 'select', 'date', 'boolean')`,
    ),
  ],
);

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    customFieldId: uuid("custom_field_id")
      .notNull()
      .references(() => customFields.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull(),
    value: jsonb("value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("custom_field_values_unique").on(
      table.customFieldId,
      table.entityId,
    ),
    index("custom_field_values_entity_idx").on(table.entityId),
  ],
);

// Saved lists/segments (filters serialized as JSON). CRUD UI llega en un PR
// posterior; la tabla queda lista para no migrar dos veces.
export const lists = pgTable(
  "lists",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    name: text("name").notNull(),
    entity: text("entity").notNull(),
    filterJson: jsonb("filter_json"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lists_partner_idx").on(table.partnerId),
    check(
      "lists_entity_check",
      sql`${table.entity} IN ('deal', 'contact', 'company')`,
    ),
  ],
);
