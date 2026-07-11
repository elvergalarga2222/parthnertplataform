ALTER TABLE "skool_memberships" ADD COLUMN "current_period_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skool_memberships" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "skool_memberships" ADD COLUMN "access_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "skool_memberships" ADD COLUMN "alert_state" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "skool_memberships" ADD COLUMN "missing_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "skool_memberships_partner_group_unique" ON "skool_memberships" USING btree ("partner_id","group_id");--> statement-breakpoint
ALTER TABLE "skool_memberships" ADD CONSTRAINT "skool_memberships_alert_state_check" CHECK ("skool_memberships"."alert_state" IN ('none', 'expiring_notified', 'frozen_auto'));