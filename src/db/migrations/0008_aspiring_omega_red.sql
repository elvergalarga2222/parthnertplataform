ALTER TABLE "budget_projections" ADD COLUMN "target_profit" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "kind" text DEFAULT 'proyecto' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_kind_check" CHECK ("invoices"."kind" IN ('proyecto', 'asesoria_mensual', 'otro'));