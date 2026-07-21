ALTER TABLE "kanban_cards" ADD COLUMN "is_client_visible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "client_view_token_hash" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "client_view_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_client_view_token_hash_unique" ON "workspaces" USING btree ("client_view_token_hash");