ALTER TABLE "deals" ADD COLUMN "brief" text;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN "requires_brief" boolean DEFAULT false NOT NULL;