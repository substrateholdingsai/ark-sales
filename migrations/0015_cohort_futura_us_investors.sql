-- 0015_cohort_futura_us_investors.sql: Cohorte Cross-Border para Futura Capital e integración con Hermes US Proptech

INSERT OR REPLACE INTO signal_catalog (signal_code, description, category, weight)
VALUES
  ('SENAL_INVERSION_PATRIMONIAL_US', 'Inversionista de alto patrimonio EE.UU. (Florida, Texas, California) perfilado por Hermes US Proptech', 'patrimonial_crossborder', 2.5),
  ('SENAL_NEARSHORING_LOGISTICO_US', 'Empresa de logística, manufactura o distribución de EE.UU. buscando infraestructura en el corredor Mérida-Progreso', 'nearshoring_us', 2.5);

INSERT OR REPLACE INTO sales_cohorts (cohort_id, name, description, query_sql, vertical, created_by)
VALUES (
  'futura_us_investors',
  'Futura Capital · Inversionistas EE.UU. (Cross-Border / Nearshoring)',
  'Inversionistas acreditados (SEC Form D), compradores en efectivo de lujo y directivos de logística/nearshoring (Texas, Florida, California) perfilados por Hermes US Proptech para terrenos industriales y residenciales en Mérida/Yucatán',
  'SELECT DISTINCT a.* FROM sales_accounts a LEFT JOIN sales_leads l ON l.account_id = a.id LEFT JOIN sales_observations o ON a.id = o.account_id WHERE a.harvest_source IN (''hermes'', ''hermes_us_proptech'', ''vektor'', ''sec_edgar'', ''luxury_cash'') OR a.origin IN (''hermes'', ''hermes_us_proptech'', ''vektor'', ''us_investor'', ''cross_border'') OR l.phone LIKE ''+1%'' OR o.signal_code IN (''SENAL_INVERSION_PATRIMONIAL_US'', ''SENAL_NEARSHORING_LOGISTICO_US'')',
  'inmobiliario',
  'system_onboarding'
);
