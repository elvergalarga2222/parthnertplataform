CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"priority" text,
	"due_date" date,
	"assignee_collaborator_id" uuid,
	"deal_id" uuid,
	"workspace_id" uuid,
	"completed_at" timestamp with time zone,
	"created_by_collaborator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" IN ('pendiente', 'en_progreso', 'hecha')),
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" IS NULL OR "tasks"."priority" IN ('baja', 'media', 'alta'))
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_collaborator_id_collaborators_id_fk" FOREIGN KEY ("assignee_collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_collaborator_id_collaborators_id_fk" FOREIGN KEY ("created_by_collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_partner_idx" ON "tasks" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "tasks_deal_idx" ON "tasks" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_idx" ON "tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "tasks_partner_status_idx" ON "tasks" USING btree ("partner_id","status");--> statement-breakpoint
CREATE INDEX "tasks_partner_due_idx" ON "tasks" USING btree ("partner_id","due_date");