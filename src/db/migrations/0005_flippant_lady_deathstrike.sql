CREATE TABLE "budget_projections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"month" date NOT NULL,
	"projected_revenue" numeric DEFAULT '0' NOT NULL,
	"budget_expenses" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_projections_currency_check" CHECK ("budget_projections"."currency" IN ('COP', 'USD', 'EUR'))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"category" text DEFAULT 'otro' NOT NULL,
	"description" text,
	"amount" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"incurred_at" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_category_check" CHECK ("expenses"."category" IN ('ia', 'produccion_video', 'hosting_vps', 'freelancer', 'herramientas_saas', 'otro')),
	CONSTRAINT "expenses_currency_check" CHECK ("expenses"."currency" IN ('COP', 'USD', 'EUR'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"workspace_id" uuid,
	"client_name" text NOT NULL,
	"description" text,
	"amount" numeric DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"issued_at" date DEFAULT now() NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_status_check" CHECK ("invoices"."status" IN ('pendiente', 'pagado', 'vencido')),
	CONSTRAINT "invoices_currency_check" CHECK ("invoices"."currency" IN ('COP', 'USD', 'EUR'))
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "default_currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_projections" ADD CONSTRAINT "budget_projections_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_projections_partner_idx" ON "budget_projections" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_projections_month_unique" ON "budget_projections" USING btree ("partner_id","month");--> statement-breakpoint
CREATE INDEX "expenses_partner_idx" ON "expenses" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "expenses_incurred_idx" ON "expenses" USING btree ("incurred_at");--> statement-breakpoint
CREATE INDEX "invoices_partner_idx" ON "invoices" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "invoices_workspace_idx" ON "invoices" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_external_ref_unique" ON "invoices" USING btree ("partner_id","external_ref");--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_default_currency_check" CHECK ("partners"."default_currency" IN ('COP', 'USD', 'EUR'));