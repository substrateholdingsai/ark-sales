-- Migración 0026: Esquema Extendido para StayPuft research_prospect_web y Tabla de Cuarentena en Ingesta
-- Creado el 2026-11-06 conforme al contrato de Misión Partes 2 y 3

-- 1. Actualización de output_schema de research_prospect_web SOLO para StayPuft (Grok Bot intacto)
UPDATE agent_skills
SET output_schema = '{"type":"object","properties":{"tamano_estimado":{"type":"string"},"tamano":{"type":"string","enum":["1-5","6-20","21-50","50+","desconocido"]},"email_valid":{"type":"boolean"},"website_url":{"type":["string","null"]},"linkedin_url":{"type":["string","null"]},"software_detectado":{"type":["string","null"]},"socios":{"type":"array","items":{"type":"string"}},"senales_dolor":{"type":"array","items":{"type":"string"}},"fuentes":{"type":"array","items":{"type":"string"}},"confidence":{"type":"number","minimum":0,"maximum":100},"confianza":{"type":"number","minimum":0,"maximum":100},"descartar":{"type":"boolean"},"motivo_descarte":{"type":["string","null"]},"telefono":{"type":["string","null"]},"whatsapp":{"type":["string","null"]},"whatsapp_valid":{"type":"boolean"},"fuente_telefono":{"type":"string","enum":["website","google_maps","facebook","denue","directorio","otro","ninguno"]},"telefono_url":{"type":["string","null"]},"telefono_verificado":{"type":"boolean"},"sin_whatsapp":{"type":"boolean"}}}'
WHERE operator = 'staypuft' AND skill_name = 'research_prospect_web';

-- 2. Tabla de Cuarentena para Ingesta Fail-Closed (Preservación de Datos sin Contaminar Leads Contactables)
CREATE TABLE IF NOT EXISTS sales_lead_quarantine (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  email TEXT,
  despacho_nombre TEXT,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quarantine_reason ON sales_lead_quarantine(reason);
CREATE INDEX IF NOT EXISTS idx_quarantine_created ON sales_lead_quarantine(created_at);
