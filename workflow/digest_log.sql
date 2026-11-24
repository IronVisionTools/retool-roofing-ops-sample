CREATE TABLE IF NOT EXISTS digest_log (
  id SERIAL PRIMARY KEY,
  run_at TIMESTAMPTZ DEFAULT now(),
  overdue_count INT,
  revenue_at_risk NUMERIC,
  crews JSONB,
  digest_text TEXT,
  status TEXT DEFAULT 'ok'
);
