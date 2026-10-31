-- migrations/0007_telnyx_voice_ai.sql
CREATE TABLE IF NOT EXISTS sales_voice_sessions (
    id TEXT PRIMARY KEY,                       -- call_control_id o session_id de Telnyx
    lead_id TEXT REFERENCES sales_leads(id),
    account_id TEXT REFERENCES sales_accounts(id),
    contact_id TEXT REFERENCES sales_contacts(id),
    direction TEXT NOT NULL,                   -- 'inbound' | 'outbound'
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    recording_url TEXT,
    full_transcript TEXT,
    summary TEXT,
    detected_intent TEXT,                      -- 'fiscal' | 'cobranza' | 'bundle' | 'otro'
    outcome TEXT,                              -- 'calificado' | 'no_interesado' | 'buzon' | 'demo_agendada'
    tools_executed_json TEXT,                  -- Array de herramientas llamadas durante la llamada
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_lead ON sales_voice_sessions(lead_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_direction ON sales_voice_sessions(direction);
