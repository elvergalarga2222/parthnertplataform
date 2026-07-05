import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { partners } from "./partners";
import { workspaces } from "./workspace";

// AI module (Fase 5, embebido en el workspace): prompts reutilizables,
// historial de generaciones para auditoría/costo, límite de consumo por partner
// y la API key BYOK del partner (cifrada). Regla #6 (inquebrantable): la
// plataforma nunca paga tokens — la key la pone el partner.

// Prompts de sistema. partner_id NULL = plantilla global del sistema (editable
// solo por admin, no por el partner final).
export const aiPrompts = pgTable(
  "ai_prompts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id").references(() => partners.id),
    type: text("type").notNull(),
    name: text("name").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_prompts_partner_idx").on(table.partnerId),
    check(
      "ai_prompts_type_check",
      sql`${table.type} IN ('guion', 'estrategia', 'diagnostico', 'imagen')`,
    ),
  ],
);

// Historial de generaciones: auditoría + base para el cálculo de costo de IA
// que consume el módulo Partner Business (v_monthly_profit).
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    promptId: uuid("prompt_id").references(() => aiPrompts.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    inputText: text("input_text"),
    outputText: text("output_text"),
    tokensInput: integer("tokens_input").notNull().default(0),
    tokensOutput: integer("tokens_output").notNull().default(0),
    costUsd: numeric("cost_usd").notNull().default("0"),
    provider: text("provider").notNull().default("mock"),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ai_generations_partner_idx").on(table.partnerId),
    index("ai_generations_workspace_idx").on(table.workspaceId),
    index("ai_generations_created_idx").on(table.createdAt),
  ],
);

// Límite de consumo mensual por partner (control de costo duro).
export const aiUsageLimits = pgTable("ai_usage_limits", {
  partnerId: uuid("partner_id")
    .primaryKey()
    .references(() => partners.id),
  monthlyTokenLimit: bigint("monthly_token_limit", { mode: "number" })
    .notNull()
    .default(500000),
  tokensUsedThisMonth: bigint("tokens_used_this_month", { mode: "number" })
    .notNull()
    .default(0),
  resetAt: date("reset_at")
    .notNull()
    .default(sql`(date_trunc('month', now()) + interval '1 month')`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// API key BYOK del partner, cifrada con AES-256-GCM (nunca en texto plano).
export const aiPartnerKeys = pgTable(
  "ai_partner_keys",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partners.id),
    provider: text("provider").notNull().default("anthropic"),
    // Formato: <iv_base64>:<authTag_base64>:<ciphertext_base64>
    encryptedKey: text("encrypted_key").notNull(),
    // Últimos 4 caracteres para mostrar en la UI sin descifrar.
    keyHint: text("key_hint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_partner_keys_unique").on(table.partnerId, table.provider),
    check(
      "ai_partner_keys_provider_check",
      sql`${table.provider} IN ('anthropic', 'openai')`,
    ),
  ],
);
