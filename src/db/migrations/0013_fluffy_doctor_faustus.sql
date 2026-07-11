CREATE TABLE "collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role_title" text,
	"permission" text DEFAULT 'lector' NOT NULL,
	"status" text DEFAULT 'invitado' NOT NULL,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaborators_permission_check" CHECK ("collaborators"."permission" IN ('editor', 'lector')),
	CONSTRAINT "collaborators_status_check" CHECK ("collaborators"."status" IN ('invitado', 'activo', 'desactivado'))
);
--> statement-breakpoint
CREATE TABLE "meeting_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"collaborator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"note" text,
	"created_by_collaborator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD CONSTRAINT "meeting_attendees_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_collaborator_id_collaborators_id_fk" FOREIGN KEY ("created_by_collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaborators_partner_idx" ON "collaborators" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_partner_email_unique" ON "collaborators" USING btree ("partner_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_invite_token_hash_unique" ON "collaborators" USING btree ("invite_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "meeting_attendees_meeting_collaborator_unique" ON "meeting_attendees" USING btree ("meeting_id","collaborator_id");--> statement-breakpoint
CREATE INDEX "meeting_attendees_meeting_idx" ON "meeting_attendees" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meetings_partner_idx" ON "meetings" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "meetings_starts_at_idx" ON "meetings" USING btree ("starts_at");