CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"workspace_id" uuid,
	"prompt_id" uuid,
	"type" text NOT NULL,
	"input_text" text,
	"output_text" text,
	"tokens_input" integer DEFAULT 0 NOT NULL,
	"tokens_output" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric DEFAULT '0' NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_partner_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"provider" text DEFAULT 'anthropic' NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_partner_keys_provider_check" CHECK ("ai_partner_keys"."provider" IN ('anthropic', 'openai'))
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"system_prompt" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_prompts_type_check" CHECK ("ai_prompts"."type" IN ('guion', 'estrategia', 'diagnostico', 'imagen'))
);
--> statement-breakpoint
CREATE TABLE "ai_usage_limits" (
	"partner_id" uuid PRIMARY KEY NOT NULL,
	"monthly_token_limit" bigint DEFAULT 500000 NOT NULL,
	"tokens_used_this_month" bigint DEFAULT 0 NOT NULL,
	"reset_at" date DEFAULT (date_trunc('month', now()) + interval '1 month') NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_prompt_id_ai_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_partner_keys" ADD CONSTRAINT "ai_partner_keys_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_limits" ADD CONSTRAINT "ai_usage_limits_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_generations_partner_idx" ON "ai_generations" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "ai_generations_workspace_idx" ON "ai_generations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ai_generations_created_idx" ON "ai_generations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_partner_keys_unique" ON "ai_partner_keys" USING btree ("partner_id","provider");--> statement-breakpoint
CREATE INDEX "ai_prompts_partner_idx" ON "ai_prompts" USING btree ("partner_id");