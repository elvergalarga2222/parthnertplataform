-- Custom SQL migration file, put your code below! --

-- Auto-create a workspace (with default kanban columns) when a deal enters a
-- won stage. Regla crítica reforzada con trigger (convención CLAUDE.md):
-- funciona igual si el deal se mueve desde la UI, por API o por SQL directo.
-- Idempotente: el índice único workspaces_deal_unique garantiza un workspace
-- por deal, y el trigger no hace nada si ya existe.

CREATE OR REPLACE FUNCTION create_workspace_on_won()
RETURNS trigger AS $$
DECLARE
  ws_id uuid;
  default_cols text[] := ARRAY['Por hacer', 'En proceso', 'En estancamiento', 'Hecho'];
  col text;
  i int := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pipeline_stages WHERE id = NEW.stage_id AND is_won = true
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces WHERE deal_id = NEW.id
  ) THEN
    INSERT INTO workspaces (partner_id, deal_id, client_name)
      VALUES (NEW.partner_id, NEW.id, NEW.title)
      RETURNING id INTO ws_id;

    INSERT INTO workspace_profiles (workspace_id) VALUES (ws_id);

    FOREACH col IN ARRAY default_cols LOOP
      INSERT INTO kanban_columns (workspace_id, name, position)
        VALUES (ws_id, col, i);
      i := i + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_deal_won_update ON deals;
--> statement-breakpoint
CREATE TRIGGER trg_deal_won_update
  AFTER UPDATE OF stage_id ON deals
  FOR EACH ROW EXECUTE FUNCTION create_workspace_on_won();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_deal_won_insert ON deals;
--> statement-breakpoint
CREATE TRIGGER trg_deal_won_insert
  AFTER INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION create_workspace_on_won();
