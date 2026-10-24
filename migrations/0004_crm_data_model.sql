-- 0004_crm_data_model.sql: Modelo de datos CRM (Fase 2)
-- Incremental: no modifica ni borra migraciones previas.

-- 1. Cuentas (despachos / organizaciones)
CREATE TABLE IF NOT EXISTS sales_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT,
  size TEXT CHECK (size IN ('1-5', '6-20', '21-50', '50+')),
  city TEXT,
  origin TEXT,
  duplicate_review_status TEXT NOT NULL DEFAULT 'pending' CHECK (duplicate_review_status IN ('pending', 'reviewed', 'merged')),
  merged_into_account_id TEXT REFERENCES sales_accounts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Contactos (personas de una cuenta)
CREATE TABLE IF NOT EXISTS sales_contacts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES sales_accounts(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  consent_status TEXT,
  contact_preferences_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Ampliar sales_leads con relaciones a cuenta/contacto (idempotente a nivel de esquema)
ALTER TABLE sales_leads ADD COLUMN account_id TEXT REFERENCES sales_accounts(id);
ALTER TABLE sales_leads ADD COLUMN contact_id TEXT REFERENCES sales_contacts(id);

-- 4. Oportunidades
CREATE TABLE IF NOT EXISTS sales_opportunities (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES sales_accounts(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES sales_contacts(id),
  lead_id TEXT REFERENCES sales_leads(id),
  stage TEXT NOT NULL DEFAULT 'nuevo' CHECK (stage IN ('nuevo', 'contactado', 'calificado', 'demo_agendada', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido')),
  owner_user_id TEXT REFERENCES crm_users(id),
  products_interest_json TEXT,
  estimated_value REAL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  expected_close_date TEXT,
  loss_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Actividades
CREATE TABLE IF NOT EXISTS sales_activities (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES sales_accounts(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES sales_contacts(id),
  opportunity_id TEXT REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES sales_leads(id),
  type TEXT NOT NULL CHECK (type IN ('note', 'call', 'email', 'demo', 'stage_change', 'task', 'system')),
  author_user_id TEXT REFERENCES crm_users(id),
  content TEXT,
  metadata_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tareas
CREATE TABLE IF NOT EXISTS sales_tasks (
  id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES sales_accounts(id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES sales_contacts(id),
  opportunity_id TEXT REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES sales_leads(id),
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT REFERENCES crm_users(id),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sales_accounts_name ON sales_accounts(name);
CREATE INDEX IF NOT EXISTS idx_sales_accounts_normalized ON sales_accounts(normalized_name);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_account ON sales_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_email ON sales_contacts(email);
CREATE INDEX IF NOT EXISTS idx_sales_leads_account ON sales_leads(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_contact ON sales_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_opps_account ON sales_opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_opps_stage ON sales_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_sales_opps_owner ON sales_opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_account ON sales_activities(account_id);
CREATE INDEX IF NOT EXISTS idx_sales_activities_opp ON sales_activities(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_owner ON sales_tasks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_status ON sales_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_due ON sales_tasks(due_date);

-- Migración idempotente de leads existentes a cuentas/contactos
INSERT OR IGNORE INTO sales_accounts (id, name, normalized_name, size, origin, created_at, updated_at)
SELECT 'acc_' || id,
       COALESCE(despacho_nombre, email),
       LOWER(TRIM(COALESCE(despacho_nombre, email))),
       tamano,
       'lead_migration',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM sales_leads;

INSERT OR IGNORE INTO sales_contacts (id, account_id, email, created_at, updated_at)
SELECT 'ct_' || id,
       'acc_' || id,
       email,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM sales_leads;

UPDATE sales_leads
SET account_id = 'acc_' || id,
    contact_id = 'ct_' || id
WHERE account_id IS NULL OR contact_id IS NULL;

-- Migración idempotente de oportunidades desde leads
INSERT OR IGNORE INTO sales_opportunities (id, account_id, contact_id, lead_id, stage, currency, created_at, updated_at)
SELECT 'opp_' || l.id,
       'acc_' || l.id,
       'ct_' || l.id,
       l.id,
       CASE l.estado
         WHEN 'nuevo' THEN 'nuevo'
         WHEN 'en_conversacion' THEN 'contactado'
         WHEN 'calificado' THEN 'calificado'
         WHEN 'propuesta_enviada' THEN 'propuesta_enviada'
         WHEN 'cerrado' THEN 'ganado'
         ELSE 'nuevo'
       END,
       'MXN',
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM sales_leads l;