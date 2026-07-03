import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";

// Keys BYOK cifradas (regla de negocio #6: la plataforma nunca paga tokens).
export const aiProviderKeys = pgTable(
  "ai_provider_keys",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyLast4: text("key_last4").notNull(),
    isValid: boolean("is_valid").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("ai_provider_keys_partner_provider").on(
      table.partnerId,
      table.provider,
    ),
    check(
      "ai_provider_keys_provider_check",
      sql`${table.provider} IN ('anthropic', 'openai')`,
    ),
  ],
);

export const aiUsageLog = pgTable("ai_usage_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  feature: text("feature").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costEstimate: numeric("cost_estimate", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Ledger de créditos prepagados — alternativa al BYOK, desactivada en MVP
// pero modelada desde el día uno.
export const aiCreditLedger = pgTable("ai_credit_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
