-- 0002_grok_skills.sql: Capa de Integración con Grok Bot (Sprint 2)
-- Registro de Habilidades Agénticas de Computadora y Automatización Autónoma

CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL, -- 'ark-sales', 'ark-ledger', 'ark-angel'
  skill_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  input_schema TEXT, -- JSON Schema con los parámetros esperados
  execution_path TEXT NOT NULL, -- Ruta, webhook o URL para que Grok Bot ejecute el skill
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_name ON agent_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);

-- Semilla de Habilidades Iniciales para Grok Bot
INSERT OR IGNORE INTO agent_skills (id, agent_id, skill_name, description, input_schema, execution_path, is_active)
VALUES 
  (
    'skill_sales_research_01',
    'ark-sales',
    'research_prospect_web',
    'Busca en LinkedIn y en la web información sobre el despacho X para personalizar la propuesta comercial y detectar su infraestructura actual.',
    '{"type":"object","properties":{"despacho_nombre":{"type":"string"},"titular_nombre":{"type":"string"},"ciudad":{"type":"string"},"website":{"type":"string"}},"required":["despacho_nombre"]}',
    '/api/internal/actions/grok/research-web',
    1
  ),
  (
    'skill_sales_pdf_01',
    'ark-sales',
    'generate_custom_pdf',
    'Abre Ark Ledger, procesa los datos del Excel del cliente y devuelve un PDF con el cálculo fiscal y código QR de inmutabilidad SHA-256.',
    '{"type":"object","properties":{"lead_id":{"type":"string"},"despacho_nombre":{"type":"string"},"datos_calculo":{"type":"object"}},"required":["lead_id","despacho_nombre"]}',
    '/api/internal/actions/grok/generate-ledger-pdf',
    1
  ),
  (
    'skill_sales_x_01',
    'ark-sales',
    'tag_prospect_on_x',
    'Si el prospecto se queja del SAT en X (Twitter), responde con un hilo explicando cómo Ark Ledger lo resuelve y comparte el link de la demo.',
    '{"type":"object","properties":{"tweet_id":{"type":"string"},"username":{"type":"string"},"queja_sat":{"type":"string"},"demo_url":{"type":"string"}},"required":["username","queja_sat"]}',
    '/api/internal/actions/grok/publish-x-thread',
    1
  );
