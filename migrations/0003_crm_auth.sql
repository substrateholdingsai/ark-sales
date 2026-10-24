-- 0003_crm_auth.sql: Acceso privado, autorización y auditoría (Fase 1 CRM)

CREATE TABLE IF NOT EXISTS crm_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor', 'lector')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crm_audit_log (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  ip TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_users_email ON crm_users(email);
CREATE INDEX IF NOT EXISTS idx_crm_audit_created ON crm_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_audit_actor ON crm_audit_log(actor_user_id);

-- Usuario administrador inicial (solo si no existe). Contraseña inicial: Admin123! (cambiar en producción)
-- Se inserta de forma idempotente; el hash se regenera en la app si se requiere rotación.
INSERT OR IGNORE INTO crm_users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  'usr_bootstrap_admin',
  'admin@arksystems.site',
  'pbkdf2$100000$0kClp7NNk3e9rnzpXfbeIw==$MYkbaByqyxdVRjIhEuIJEe8p7tDOrIo05oFBem8gN78=',
  'Administrador ARK',
  'admin',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);