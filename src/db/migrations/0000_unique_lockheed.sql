CREATE TABLE "access_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"partner_id" uuid,
	"event" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skool_member_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"frozen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_skool_member_id_unique" UNIQUE("skool_member_id"),
	CONSTRAINT "partners_email_unique" UNIQUE("email"),
	CONSTRAINT "partners_status_check" CHECK ("partners"."status" IN ('active', 'frozen'))
);
--> statement-breakpoint
CREATE TABLE "skool_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	"membership_status" text NOT NULL,
	"last_verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skool_memberships_status_check" CHECK ("skool_memberships"."membership_status" IN ('active', 'churned', 'removed'))
);
--> statement-breakpoint
ALTER TABLE "skool_memberships" ADD CONSTRAINT "skool_memberships_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;