-- 0028_enrichment_evidence_and_quarantine.sql: Trazabilidad de evidencia de enriquecimiento, scores y cuarentena reversible
-- Implementa las recomendaciones de arquitectura de datos para leads del tenant Futura Capital

-- 1. Tabla de Auditoría de Evidencia de Enriquecimiento
CREATE TABLE IF NOT EXISTS sales_enrichment_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  source_type TEXT NOT NULL,          -- 'google_places', 'serper_places', 'official_website', 'directory'
  source_url TEXT,
  field_name TEXT NOT NULL,           -- 'phone', 'email', 'whatsapp', 'doctor_name', 'website'
  raw_value TEXT,
  normalized_value TEXT,
  confidence_score INTEGER DEFAULT 0,
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  run_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_evidence_contact ON sales_enrichment_evidence(contact_id);
CREATE INDEX IF NOT EXISTS idx_evidence_tenant ON sales_enrichment_evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_run ON sales_enrichment_evidence(run_id);

-- 2. Columnas de enriquecimiento y cuarentena en sales_contacts
ALTER TABLE sales_contacts ADD COLUMN enrichment_status TEXT DEFAULT 'pending';
ALTER TABLE sales_contacts ADD COLUMN actionability_score INTEGER DEFAULT 0;
ALTER TABLE sales_contacts ADD COLUMN confidence_score INTEGER DEFAULT 0;
ALTER TABLE sales_contacts ADD COLUMN raw_phone TEXT;
ALTER TABLE sales_contacts ADD COLUMN whatsapp_url TEXT;
ALTER TABLE sales_contacts ADD COLUMN quarantined_at TIMESTAMP;
ALTER TABLE sales_contacts ADD COLUMN quarantine_reason TEXT;
ALTER TABLE sales_contacts ADD COLUMN enrichment_run_id TEXT;
