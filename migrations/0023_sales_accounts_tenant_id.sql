-- 0023_sales_accounts_tenant_id.sql: Agrega columna tenant_id a sales_accounts
ALTER TABLE sales_accounts ADD COLUMN tenant_id TEXT DEFAULT 'acc_ark_ledger';
CREATE INDEX IF NOT EXISTS idx_sales_accounts_tenant ON sales_accounts(tenant_id);
