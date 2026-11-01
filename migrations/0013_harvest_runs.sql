CREATE TABLE IF NOT EXISTS harvest_runs (
  run_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  leads_discovered INTEGER DEFAULT 0,
  leads_ingested INTEGER DEFAULT 0,
  leads_deduped INTEGER DEFAULT 0,
  leads_enriched INTEGER DEFAULT 0,
  error_message TEXT,
  github_run_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_harvest_runs_status ON harvest_runs(status);
CREATE INDEX IF NOT EXISTS idx_harvest_runs_started ON harvest_runs(started_at);