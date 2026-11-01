-- 0012_accounts_scian_sync.sql: Sincroniza SCIAN y fuente de cosecha en sales_accounts
ALTER TABLE sales_accounts ADD COLUMN scian_code TEXT;
ALTER TABLE sales_accounts ADD COLUMN harvest_source TEXT;
ALTER TABLE sales_accounts ADD COLUMN last_enriched_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_accounts_scian ON sales_accounts(scian_code);
CREATE INDEX IF NOT EXISTS idx_accounts_source ON sales_accounts(harvest_source);