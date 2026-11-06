-- 0025_staypuft_operator_and_agent_tasks.sql
-- Integración de Operador StayPuft y Sistema de Tareas Agénticas con Protección de Cuota D1

-- 1. Actualización de agent_skills para soportar múltiples operadores (Grok Bot y StayPuft)
CREATE TABLE IF NOT EXISTS agent_skills_new (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'grok_bot',
  skill_name TEXT NOT NULL,
  description TEXT NOT NULL,
  input_schema TEXT,
  output_schema TEXT,
  execution_path TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(operator, skill_name)
);

INSERT OR IGNORE INTO agent_skills_new (id, agent_id, operator, skill_name, description, input_schema, execution_path, is_active, created_at)
SELECT id, agent_id, 'grok_bot', skill_name, description, input_schema, execution_path, is_active, created_at FROM agent_skills;

DROP TABLE IF EXISTS agent_skills;
ALTER TABLE agent_skills_new RENAME TO agent_skills;

CREATE INDEX IF NOT EXISTS idx_agent_skills_name ON agent_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_operator ON agent_skills(operator);

-- 2. Registro de las 3 habilidades para el Operador StayPuft con sus contratos JSON
INSERT OR IGNORE INTO agent_skills (id, agent_id, operator, skill_name, description, input_schema, output_schema, execution_path, is_active)
VALUES 
  (
    'skill_staypuft_research_01',
    'ark-sales',
    'staypuft',
    'research_prospect_web',
    'Investigación web de prospectos: detecta tamaño, socios, software tecnológico, señales de dolor y fuentes con nivel de confianza.',
    '{"type":"object","properties":{"lead_id":{"type":"string"},"despacho_nombre":{"type":"string"},"dominio":{"type":"string"},"ciudad":{"type":"string"}},"required":["lead_id","despacho_nombre"]}',
    '{"type":"object","properties":{"tamano_estimado":{"type":"string"},"socios":{"type":"array","items":{"type":"string"}},"software_detectado":{"type":"array","items":{"type":"string"}},"senales_dolor":{"type":"array","items":{"type":"string"}},"fuentes":{"type":"array","items":{"type":"string"}},"confianza":{"type":"number","minimum":0,"maximum":100}},"required":["tamano_estimado","fuentes","confianza"]}',
    '/api/internal/skills/execute',
    1
  ),
  (
    'skill_staypuft_pdf_01',
    'ark-sales',
    'staypuft',
    'generate_custom_pdf',
    'Generación de reporte fiscal oficial en PDF con cálculo respaldado por Ark Ledger, sello SHA-256 de inmutabilidad y QR.',
    '{"type":"object","properties":{"lead_id":{"type":"string"},"archivo_excel_url_o_id":{"type":"string"}},"required":["lead_id","archivo_excel_url_o_id"]}',
    '{"type":"object","properties":{"pdf_url_o_id":{"type":"string"},"calculo_resumen":{"type":"object"},"sello_sha256":{"type":"string"},"qr_payload":{"type":"string"}},"required":["pdf_url_o_id","calculo_resumen","sello_sha256","qr_payload"]}',
    '/api/internal/skills/execute',
    1
  ),
  (
    'skill_staypuft_x_01',
    'ark-sales',
    'staypuft',
    'tag_prospect_on_x',
    'Generación de borrador de respuesta comercial y registro de lead ante quejas del SAT en X (Twitter). NUNCA publica de forma autónoma.',
    '{"type":"object","properties":{"tweet_id":{"type":"string"},"texto_queja":{"type":"string"},"autor":{"type":"string"}},"required":["tweet_id","texto_queja","autor"]}',
    '{"type":"object","properties":{"lead_creado":{"type":"boolean"},"lead_id":{"type":"string"},"borrador_respuesta":{"type":"string"},"vertical_sugerida":{"type":"string"}},"required":["lead_creado","lead_id","borrador_respuesta","vertical_sugerida"]}',
    '/api/internal/skills/execute',
    1
  );

-- 3. Tabla de Tareas Agénticas (Cola de Trabajo de Operadores)
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'staypuft',
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  retry_count INTEGER DEFAULT 0,
  result TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_pending ON agent_tasks(operator, status, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_lead ON agent_tasks(lead_id);

-- 4. Tabla de Auditoría de Ejecuciones de Skills (Bitácora Inmutable)
CREATE TABLE IF NOT EXISTS agent_skill_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  lead_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'staypuft',
  status TEXT NOT NULL, -- 'running' | 'completed' | 'failed'
  input_payload TEXT,
  output_result TEXT,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_skill_runs_lead ON agent_skill_runs(lead_id);
CREATE INDEX IF NOT EXISTS idx_agent_skill_runs_operator ON agent_skill_runs(operator, status);
CREATE INDEX IF NOT EXISTS idx_agent_skill_runs_started ON agent_skill_runs(started_at);
