CREATE TABLE "industries" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "industries_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "lead_stage_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"industry_id" integer NOT NULL,
	"business_name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"stage" text DEFAULT 'prospecto' NOT NULL,
	"soba_segment" text,
	"soba_offer_point_a" text,
	"soba_offer_point_b" text,
	"soba_vehicle" text,
	"soba_attention" text,
	"estimated_value" numeric(12, 2),
	"closed_at" timestamp with time zone,
	"expected_close_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_stage_check" CHECK ("leads"."stage" IN ('prospecto', 'calificado', 'propuesta', 'negociacion', 'cerrado_ganado', 'cerrado_perdido')),
	CONSTRAINT "leads_vehicle_check" CHECK ("leads"."soba_vehicle" IS NULL OR "leads"."soba_vehicle" IN ('consultoria', 'asesoria_mensual'))
);
--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_industry_id_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."industries"("id") ON DELETE no action ON UPDATE no action;