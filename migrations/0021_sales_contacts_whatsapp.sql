-- 0021_sales_contacts_whatsapp.sql
-- Agrega columna whatsapp a sales_contacts para prospección B2B de alto valor
ALTER TABLE sales_contacts ADD COLUMN whatsapp TEXT;
