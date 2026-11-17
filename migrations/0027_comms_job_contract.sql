-- 0027_comms_job_contract.sql: Guardrails, billing, WhatsApp HSM, job contract tables
-- Supports Ark Sales as comms executor for CANACO bulk/scheduled/sequenced/AI-voice sends.

-- 1. Campaign jobs (dispatch contract: CRM -> Sales worker executor)
CREATE TABLE IF NOT EXISTS campaign_jobs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  tenant_id TEXT NOT NULL,
  sender_brand TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'voice')),
  message_payload_json TEXT NOT NULL,
  audience_payload_json TEXT NOT NULL,
  schedule_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'running', 'paused', 'completed', 'cancelled')),
  preview_ttl TEXT,
  approval_required INTEGER NOT NULL DEFAULT 1,
  approved_by_user_id TEXT,
  approved_at TEXT,
  created_by_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_jobs_tenant ON campaign_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_status ON campaign_jobs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_idempotency ON campaign_jobs(idempotency_key);

-- 2. Per-contact job targets and outcomes
CREATE TABLE IF NOT EXISTS campaign_job_targets (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES campaign_jobs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'voice')),
  destination TEXT NOT NULL, -- phone E.164 or email
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'excluded', 'failed', 'deferred')),
  reason TEXT,
  provider_message_id TEXT,
  cost_usd REAL DEFAULT 0,
  units INTEGER DEFAULT 1,
  unit_cost_usd REAL DEFAULT 0,
  sent_at TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaign_targets_job ON campaign_job_targets(job_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_tenant ON campaign_job_targets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_contact ON campaign_job_targets(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_targets_status ON campaign_job_targets(status);

-- 3. Usage events for credit-bag billing
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'voice')),
  units INTEGER NOT NULL DEFAULT 1,
  unit_cost_usd REAL NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'billable' CHECK (status IN ('billable', 'audit_zero')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_job ON usage_events(job_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_contact ON usage_events(contact_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON usage_events(created_at);

-- 4. REPEP PROFECO suppression store (hashed numbers, version + cut-off date, 35-day validity)
CREATE TABLE IF NOT EXISTS repep_list (
  id TEXT PRIMARY KEY,
  phone_hash TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'voice')),
  list_version INTEGER NOT NULL DEFAULT 1,
  cut_off_date TEXT NOT NULL, -- ISO date of the official list cut-off
  expires_at TEXT NOT NULL, -- cut_off_date + 35 days
  source TEXT NOT NULL DEFAULT 'manual_upload', -- 'manual_upload' | 'official_profeco'
  uploaded_by_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_repep_phone_hash ON repep_list(phone_hash);
CREATE INDEX IF NOT EXISTS idx_repep_expires ON repep_list(expires_at);
CREATE INDEX IF NOT EXISTS idx_repep_version ON repep_list(list_version);

-- REPEP list version metadata (atomic version states)
CREATE TABLE IF NOT EXISTS repep_list_version (
  id TEXT PRIMARY KEY DEFAULT 'current',
  list_version INTEGER NOT NULL DEFAULT 1,
  cut_off_date TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending')),
  source TEXT NOT NULL DEFAULT 'manual_upload',
  uploaded_by_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Per-contact frequency / weekly caps (durable in D1)
CREATE TABLE IF NOT EXISTS contact_frequency_caps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'email', 'voice')),
  week_start_date TEXT NOT NULL, -- ISO date, Monday of the week
  sent_count INTEGER NOT NULL DEFAULT 0,
  max_per_week INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_frequency_caps_unique ON contact_frequency_caps(tenant_id, contact_id, channel, week_start_date);
CREATE INDEX IF NOT EXISTS idx_contact_frequency_caps_tenant ON contact_frequency_caps(tenant_id);

-- 6. WhatsApp Meta HSM template registry
CREATE TABLE IF NOT EXISTS whatsapp_hsm_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- NULL = global/system template
  template_name TEXT NOT NULL,
  template_version TEXT NOT NULL DEFAULT '1',
  language_code TEXT NOT NULL DEFAULT 'es-MX',
  category TEXT NOT NULL DEFAULT 'utility' CHECK (category IN ('marketing', 'utility', 'authentication')),
  components_json TEXT NOT NULL, -- HSM components (body, button, etc.)
  variables_json TEXT NOT NULL DEFAULT '[]', -- expected variable names
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paused')),
  meta_template_id TEXT, -- Meta's template ID once approved
  created_by_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_hsm_templates_name_version ON whatsapp_hsm_templates(template_name, template_version, COALESCE(tenant_id, '__global__'));
CREATE INDEX IF NOT EXISTS idx_whatsapp_hsm_templates_tenant ON whatsapp_hsm_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_hsm_templates_status ON whatsapp_hsm_templates(status);
