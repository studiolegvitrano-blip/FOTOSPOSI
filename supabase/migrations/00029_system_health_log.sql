-- Log delle esecuzioni autonome di backup/manutenzione (cron Vercel).
CREATE TABLE IF NOT EXISTS system_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL CHECK (job IN ('backup', 'maintenance')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'warning', 'error')),
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_health_log_job_created ON system_health_log(job, created_at DESC);

ALTER TABLE system_health_log ENABLE ROW LEVEL SECURITY;

-- Solo il service role (usato dai cron job server-side) scrive/legge questa tabella.
CREATE POLICY "Service role only" ON system_health_log
  FOR ALL USING (false);
