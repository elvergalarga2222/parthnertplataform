import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";

// Catálogo cerrado de industrias mainstream (regla de negocio #5): nada de
// micronichos de texto libre.
export const industries = pgTable("industries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const LEAD_STAGES = [
  "prospecto",
  "calificado",
  "propuesta",
  "negociacion",
  "cerrado_ganado",
  "cerrado_perdido",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    industryId: integer("industry_id")
      .notNull()
      .references(() => industries.id),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    stage: text("stage").notNull().default("prospecto"),
    // Campos SOBA/NOVA — gates de avance del pipeline (regla de negocio #4)
    sobaSegment: text("soba_segment"),
    sobaOfferPointA: text("soba_offer_point_a"),
    sobaOfferPointB: text("soba_offer_point_b"),
    sobaVehicle: text("soba_vehicle"),
    sobaAttention: text("soba_attention"),
    estimatedValue: numeric("estimated_value", { precision: 12, scale: 2 }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    expectedCloseDate: date("expected_close_date"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "leads_stage_check",
      sql`${table.stage} IN ('prospecto', 'calificado', 'propuesta', 'negociacion', 'cerrado_ganado', 'cerrado_perdido')`,
    ),
    check(
      "leads_vehicle_check",
      sql`${table.sobaVehicle} IS NULL OR ${table.sobaVehicle} IN ('consultoria', 'asesoria_mensual')`,
    ),
  ],
);

export const leadStageHistory = pgTable("lead_stage_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id),
  fromStage: text("from_stage"),
  toStage: text("to_stage").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
