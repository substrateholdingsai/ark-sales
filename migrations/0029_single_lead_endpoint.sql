-- 0029_single_lead_endpoint.sql: Columnas e índices para ingesta de un solo lead (POST /api/internal/leads)
-- Soporta deduplicación indexada por teléfono, email, Instagram, Facebook URL y sitio web,
-- y aislamiento estricto por tenant en cada lead creado.

ALTER TABLE sales_leads ADD COLUMN instagram_handle TEXT;
ALTER TABLE sales_leads ADD COLUMN facebook_url TEXT;
ALTER TABLE sales_leads ADD COLUMN website_url TEXT;
ALTER TABLE sales_leads ADD COLUMN tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_leads_instagram_handle ON sales_leads(instagram_handle);
CREATE INDEX IF NOT EXISTS idx_sales_leads_facebook_url ON sales_leads(facebook_url);
CREATE INDEX IF NOT EXISTS idx_sales_leads_website_url ON sales_leads(website_url);
CREATE INDEX IF NOT EXISTS idx_sales_leads_tenant_id ON sales_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_firm_name ON sales_leads(despacho_nombre);
