-- 0006_telnyx_voice.sql: Soporte para llamadas telefónicas de cortesía vía Telnyx

-- 1. Añadir columna de teléfono y estado de llamada a sales_leads si no existen
ALTER TABLE sales_leads ADD COLUMN phone TEXT;
ALTER TABLE sales_leads ADD COLUMN last_call_status TEXT DEFAULT NULL;
ALTER TABLE sales_leads ADD COLUMN last_call_at TIMESTAMP DEFAULT NULL;

-- 2. Índice rápido para búsquedas por teléfono
CREATE INDEX IF NOT EXISTS idx_sales_leads_phone ON sales_leads(phone);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_phone ON sales_contacts(phone);
