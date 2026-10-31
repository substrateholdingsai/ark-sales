-- 0013_harvey_sales_engine.sql: Infraestructura de DNC y Señales de Compra ATS (Motor Harvey)
-- Soporte multi-tenant para exclusión permanente de prospectos y trazabilidad de señales ATS

-- 1. Lista Do Not Contact (DNC) permanente
CREATE TABLE IF NOT EXISTS crm_dnc_list (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- NULL = global, o tenant específico
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  reason TEXT NOT NULL DEFAULT 'unsubscribe' CHECK (reason IN ('unsubscribe', 'opt_out', 'complaint', 'legal', 'manual')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_dnc_email ON crm_dnc_list(email);
CREATE INDEX IF NOT EXISTS idx_crm_dnc_tenant ON crm_dnc_list(tenant_id);

-- 2. Bitácora de Señales ATS
CREATE TABLE IF NOT EXISTS crm_ats_signals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  company_domain TEXT NOT NULL,
  company_name TEXT NOT NULL,
  ats_platform TEXT NOT NULL CHECK (ats_platform IN ('greenhouse', 'lever', 'ashby', 'workable')),
  job_title TEXT NOT NULL,
  job_department TEXT,
  job_location TEXT,
  matched_product TEXT NOT NULL,
  signal_strength TEXT NOT NULL DEFAULT 'high',
  suggested_hook TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'ignored')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_ats_company ON crm_ats_signals(company_domain);
CREATE INDEX IF NOT EXISTS idx_crm_ats_product ON crm_ats_signals(matched_product);
CREATE INDEX IF NOT EXISTS idx_crm_ats_status ON crm_ats_signals(status);
