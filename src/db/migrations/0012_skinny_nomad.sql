CREATE TABLE "feedback_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"route" text NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'nuevo' NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_reports_type_check" CHECK ("feedback_reports"."type" IN ('bug', 'sugerencia')),
	CONSTRAINT "feedback_reports_status_check" CHECK ("feedback_reports"."status" IN ('nuevo', 'revisado', 'resuelto'))
);
--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "is_tester" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_reports_partner_idx" ON "feedback_reports" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "feedback_reports_status_idx" ON "feedback_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_reports_created_idx" ON "feedback_reports" USING btree ("created_at");