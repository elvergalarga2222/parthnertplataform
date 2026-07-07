-- Custom SQL migration file, put your code below! --

-- Aggregation views for the Partner Business dashboard (Fase 4). Both group by
-- (partner_id, month, currency) so amounts in different currencies are NEVER
-- summed together — there is no cross-currency conversion (regla de negocio del
-- módulo). The dashboard picks the partner's default_currency row.

-- Monthly recognized revenue: money actually collected (paid invoices), bucketed
-- by the month the payment landed. Pending/overdue invoices are not revenue yet.
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT
  partner_id,
  date_trunc('month', COALESCE(paid_at, created_at))::date AS month,
  currency,
  SUM(amount)::numeric AS revenue
FROM invoices
WHERE status = 'pagado'
GROUP BY partner_id, date_trunc('month', COALESCE(paid_at, created_at))::date, currency;
--> statement-breakpoint

-- Monthly net profit: revenue - operational expenses (same currency) - AI cost.
-- AI cost comes from ai_generations.cost_usd, which is denominated in USD, so it
-- is subtracted ONLY from the USD row. Non-USD profit ignores AI cost (documented
-- limitation until multi-currency conversion exists). A month/currency shows up
-- if it has revenue, expenses OR (for USD) AI cost.
CREATE OR REPLACE VIEW v_monthly_profit AS
WITH revenue AS (
  SELECT
    partner_id,
    date_trunc('month', COALESCE(paid_at, created_at))::date AS month,
    currency,
    SUM(amount)::numeric AS revenue
  FROM invoices
  WHERE status = 'pagado'
  GROUP BY 1, 2, 3
),
exp AS (
  SELECT
    partner_id,
    date_trunc('month', incurred_at)::date AS month,
    currency,
    SUM(amount)::numeric AS expenses
  FROM expenses
  GROUP BY 1, 2, 3
),
ia AS (
  SELECT
    partner_id,
    date_trunc('month', created_at)::date AS month,
    'USD'::text AS currency,
    SUM(cost_usd)::numeric AS ia_cost
  FROM ai_generations
  GROUP BY 1, 2
)
SELECT
  COALESCE(r.partner_id, e.partner_id, i.partner_id) AS partner_id,
  COALESCE(r.month, e.month, i.month) AS month,
  COALESCE(r.currency, e.currency, i.currency) AS currency,
  COALESCE(r.revenue, 0)::numeric AS revenue,
  COALESCE(e.expenses, 0)::numeric AS expenses,
  COALESCE(i.ia_cost, 0)::numeric AS ia_cost,
  (COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) - COALESCE(i.ia_cost, 0))::numeric AS profit
FROM revenue r
FULL OUTER JOIN exp e
  ON r.partner_id = e.partner_id AND r.month = e.month AND r.currency = e.currency
FULL OUTER JOIN ia i
  ON COALESCE(r.partner_id, e.partner_id) = i.partner_id
  AND COALESCE(r.month, e.month) = i.month
  AND COALESCE(r.currency, e.currency) = i.currency;
