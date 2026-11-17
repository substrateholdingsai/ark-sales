-- 0030_altum_real_estate_inventory.sql: Inventario inmobiliario para el vertical Real Estate (tenant ALTUM Sureste demo)
-- Numero libre: 0027 y 0028 y 0029 ya existen en el repositorio. No se renumeran migraciones previas.
-- Tablas: re_projects, re_units, re_quotes, re_pricing_rules.
-- FKs ajustadas al esquema real: sales_accounts(id), sales_contacts(id), sales_opportunities(id), crm_audit_log(id).
-- Columna is_demo (DEFAULT 0) para marcar datos de demostraciÃ³n de forma explÃ­cita.

-- 1. Proyectos / desarrollos inmobiliarios por tenant
CREATE TABLE IF NOT EXISTS re_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  currency TEXT DEFAULT 'MXN',
  total_units INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Unidades / lotes del inventario
CREATE TABLE IF NOT EXISTS re_units (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES re_projects(id),
  block TEXT,
  level INTEGER,
  unit_number TEXT,
  area_m2 REAL NOT NULL,
  price_per_m2 REAL NOT NULL,
  list_price REAL NOT NULL,
  status TEXT CHECK(status IN ('disponible','apartado','vendido','bloqueado')) DEFAULT 'disponible',
  unit_type TEXT,
  floor_plan_url TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id, block, unit_number)
);

-- 3. Cotizaciones deterministas sobre unidades
CREATE TABLE IF NOT EXISTS re_quotes (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES re_units(id),
  account_id TEXT REFERENCES sales_accounts(id),
  contact_id TEXT REFERENCES sales_contacts(id),
  opportunity_id TEXT REFERENCES sales_opportunities(id),
  discount_pct REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total_sale REAL NOT NULL,
  down_payment_pct REAL DEFAULT 0,
  down_payment_amount REAL DEFAULT 0,
  down_payment_count INTEGER DEFAULT 1,
  monthly_pct REAL DEFAULT 0,
  monthly_amount REAL DEFAULT 0,
  monthly_count INTEGER DEFAULT 0,
  payment_plan TEXT,
  status TEXT CHECK(status IN ('borrador','enviada','aceptada','vencida')) DEFAULT 'borrador',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. Reglas de precios versionadas (leo desde D1, nunca hardcodeado)
CREATE TABLE IF NOT EXISTS re_pricing_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_re_units_project ON re_units(project_id, status);
CREATE INDEX IF NOT EXISTS idx_re_units_project_tenant ON re_units(project_id, status, is_demo);
CREATE INDEX IF NOT EXISTS idx_re_quotes_unit ON re_quotes(unit_id);
CREATE INDEX IF NOT EXISTS idx_re_quotes_status ON re_quotes(status);
CREATE INDEX IF NOT EXISTS idx_re_projects_tenant ON re_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_pricing_rules_tenant_active ON re_pricing_rules(tenant_id, is_active);
