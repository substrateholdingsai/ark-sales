-- 0001_init.sql: Esquema inicial para Ark Sales (Sprint 1)

-- 1. Tabla de configuración de productos, precios y disponibilidad (Catálogo)
CREATE TABLE IF NOT EXISTS sales_config (
  id TEXT PRIMARY KEY,
  product_key TEXT NOT NULL UNIQUE, -- 'ledger', 'angel', 'commerce', 'bundle'
  name TEXT NOT NULL,
  price_mxn REAL NOT NULL,
  billing_period TEXT NOT NULL DEFAULT 'mensual',
  description TEXT NOT NULL,
  features_json TEXT NOT NULL, -- Array JSON de strings con características
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'waitlist', 'beta', 'maintenance')),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de prospectos (Leads)
CREATE TABLE IF NOT EXISTS sales_leads (
  id TEXT PRIMARY KEY, -- UUID generado por Ark Sales
  email TEXT NOT NULL,
  despacho_nombre TEXT,
  tamano TEXT CHECK (tamano IN ('1-5', '6-20', '21-50', '50+')),
  dolor_detectado TEXT CHECK (dolor_detectado IN ('sat_fiscal_calculo', 'cobranza_morosos', 'venta_online', 'integral_general', 'otro')),
  especialista_asignado TEXT NOT NULL DEFAULT 'intake' CHECK (especialista_asignado IN ('intake', 'riesgo', 'flujo', 'closer')),
  estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'en_conversacion', 'calificado', 'propuesta_enviada', 'cerrado')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  conversation_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de conversaciones agénticas
CREATE TABLE IF NOT EXISTS sales_conversations (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  agente_id TEXT NOT NULL, -- 'intake', 'riesgo', 'flujo', 'closer'
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  metadata_json TEXT, -- Info adicional (tool_calls, tokens, context)
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES sales_leads(id) ON DELETE CASCADE
);

-- 4. Tabla para Outbox Pattern de entrega asíncrona federada (LEAD_INGEST_V3)
CREATE TABLE IF NOT EXISTS sales_pending_ingest (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  destination TEXT NOT NULL CHECK (destination IN ('ledger', 'angel', 'commerce', 'bundle')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  retries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES sales_leads(id) ON DELETE CASCADE
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_sales_leads_email ON sales_leads(email);
CREATE INDEX IF NOT EXISTS idx_sales_conversations_lead ON sales_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_sales_pending_ingest_status ON sales_pending_ingest(status);

-- Semilla inicial de Catálogo (Datos maestros del Ecosistema ARK para despachos contables)
INSERT OR IGNORE INTO sales_config (id, product_key, name, price_mxn, billing_period, description, features_json, status)
VALUES 
  (
    'cfg_ledger_01', 
    'ledger', 
    'Ark Ledger', 
    399.00, 
    'mensual', 
    'Motor fiscal y contable fail-closed con sellado criptográfico SHA-256 y calculadoras SAT.', 
    '["Calculadoras fiscales SAT automatizadas", "Sello de inmutabilidad criptográfica SHA-256", "Auditoría preventiva de CFDI 4.0", "Detección de discrepancias fiscales", "API REST para sincronización de pólizas"]', 
    'active'
  ),
  (
    'cfg_angel_01', 
    'angel', 
    'Ark Angel', 
    499.00, 
    'mensual', 
    'Motor legal y de cobranza automatizada fail-closed para despachos y empresas.', 
    '["Automatización de cobranza inteligente por WhatsApp y correo", "Contratos comerciales y pagarés con validez legal", "Motor legal fail-closed con alertas de riesgo de morosidad", "Escalamiento extrajudicial programado", "Conciliación con pasarelas de pago"]', 
    'active'
  ),
  (
    'cfg_commerce_01', 
    'commerce', 
    'Ark Commerce', 
    299.00, 
    'mensual', 
    'Tienda digital de alta velocidad edge-first con pasarelas integradas y pedidos por WhatsApp.', 
    '["Catálogo digital multi-tenant edge-first", "Checkout directo por WhatsApp y Stripe/Openpay", "Control de inventarios y cotizaciones", "Integración con paqueterías de México (Envia.com)", "Cero comisiones por transacción"]', 
    'active'
  ),
  (
    'cfg_bundle_01', 
    'bundle', 
    'Bundle Ecosistema ARK Total', 
    997.00, 
    'mensual', 
    'La infraestructura operativa completa de la economía agéntica para despachos contables: Ark Ledger + Ark Angel + Ark Commerce.', 
    '["Acceso completo a Ark Ledger (Fiscal/SAT)", "Acceso completo a Ark Angel (Cobranza y Legal)", "Acceso completo a Ark Commerce (Ventas digitales)", "Soporte agéntico prioritario 24/7", "Ahorro del 20% sobre contratación individual ($997 MXN/mes vs $1,197 MXN)"]', 
    'active'
  );
