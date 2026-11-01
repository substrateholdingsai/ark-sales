CREATE TABLE IF NOT EXISTS sales_cohorts (
  cohort_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  query_sql TEXT NOT NULL,
  vertical TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);

-- Cohortes iniciales
INSERT INTO sales_cohorts (cohort_id, name, description, query_sql, vertical) VALUES
  ('despachos_sat', 'Despachos Contables con dolor SAT',
   'Empresas SCIAN 541210/541220 con señales de dolor fiscal',
   'SELECT DISTINCT a.* FROM sales_accounts a
    JOIN sales_observations o ON a.id = o.account_id
    WHERE a.scian_code IN (''541210'', ''541220'')
    AND o.signal_code IN (''DOLOR_SAT'', ''DOLOR_CFDI'', ''SOFTWARE_CONTABLE'')',
   'fiscal'),
   
  ('bpo_morosidad', 'BPOs con cartera vencida',
   'Empresas de cobranza SCIAN 561490 con dolor de flujo',
   'SELECT DISTINCT a.* FROM sales_accounts a
    JOIN sales_observations o ON a.id = o.account_id
    WHERE a.scian_code = ''561490''
    AND o.signal_code = ''DOLOR_MOROSIDAD''',
   'cobranza'),
   
  ('inmobiliarias_flujo', 'Inmobiliarias con dolor de flujo',
   'Corredores inmobiliarios SCIAN 531110/531210',
   'SELECT DISTINCT a.* FROM sales_accounts a
    WHERE a.scian_code IN (''531110'', ''531210'')',
   'bundle');