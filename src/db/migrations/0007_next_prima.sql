-- Reparación + blindaje del bug de /clientes (digest 4159151474): un
-- next_activity_at fuera del rango representable de JavaScript ('infinity',
-- años BC o > 275760 — y años > 9999 en parsers antiguos) se convierte en
-- Invalid Date al leerlo con postgres-js y revienta la serialización del
-- snapshot en cada render. Primero se anulan las filas envenenadas (la fecha
-- era basura; el partner la reintroduce si le importa) y después se añade el
-- CHECK para que no puedan volver a entrar. El UPDATE usa los mismos límites
-- que el CHECK para que el ALTER aplique limpio sobre producción.
UPDATE deals SET next_activity_at = NULL
WHERE next_activity_at IS NOT NULL
  AND (next_activity_at < '1900-01-01' OR next_activity_at >= '2200-01-01');
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_next_activity_at_range_check" CHECK ("deals"."next_activity_at" IS NULL OR ("deals"."next_activity_at" >= '1900-01-01' AND "deals"."next_activity_at" < '2200-01-01'));
