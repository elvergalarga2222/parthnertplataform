CREATE TABLE "ai_credit_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_provider_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_last4" text NOT NULL,
	"is_valid" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_keys_partner_provider" UNIQUE("partner_id","provider"),
	CONSTRAINT "ai_provider_keys_provider_check" CHECK ("ai_provider_keys"."provider" IN ('anthropic', 'openai'))
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"partner_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_estimate" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD CONSTRAINT "ai_credit_ledger_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;