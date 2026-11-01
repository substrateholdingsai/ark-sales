CREATE TABLE IF NOT EXISTS sales_observations (
  observation_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  signal_code TEXT NOT NULL,
  value_text TEXT,
  value_num REAL,
  confidence REAL DEFAULT 1.0,
  evidence_url TEXT,
  observed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_harvester TEXT
);

CREATE INDEX IF NOT EXISTS idx_observations_account ON sales_observations(account_id);
CREATE INDEX IF NOT EXISTS idx_observations_signal ON sales_observations(signal_code);
CREATE INDEX IF NOT EXISTS idx_observations_confidence ON sales_observations(confidence);

CREATE TABLE IF NOT EXISTS signal_catalog (
  signal_code TEXT PRIMARY KEY,
  description TEXT,
  category TEXT,
  weight REAL DEFAULT 1.0
);

INSERT INTO signal_catalog (signal_code, description, category, weight) VALUES
  ('SCIAN_CODE', 'Código de industria INEGI', 'clasificacion', 1.0),
  ('TAMANO_EMPLEADOS', 'Rango de empleados', 'tamano', 1.0),
  ('SITIO_WEB', 'Dominio web de la empresa', 'contacto', 0.5),
  ('DOLOR_SAT', 'Menciona SAT/multas en sitio web', 'dolor', 2.0),
  ('DOLOR_MOROSIDAD', 'Menciona cartera vencida/morosidad', 'dolor', 2.0),
  ('DOLOR_CFDI', 'Menciona CFDI/facturación', 'dolor', 1.5),
  ('SOFTWARE_CONTABLE', 'Usa CONTPAQi, COI, Aspel, etc.', 'tecnologia', 1.0),
  ('TIENDA_ONLINE', 'Tiene e-commerce', 'tecnologia', 1.5),
  ('PAQUETE_ENTERPRISE', 'Ofrece servicios enterprise', 'tamano', 1.0);
