-- 0012_admin_user_substrate.sql: Alta y sincronización del usuario Super Admin y Demo
-- Username: substrateholdingsai@gmail.com
-- Password: 150ft550LB (PBKDF2 100,000 iteraciones SHA-256)

INSERT INTO crm_users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  'usr_substrate_superadmin',
  'substrateholdingsai@gmail.com',
  'pbkdf2$100000$wyzAJhmtZP5pO8h+3qMkag==$HGuPpdw1haoS/uZ3DJLy7KiUCgPeEMWd8kwIxRiXWEc=',
  'Substrate Holdings Super Admin',
  'admin',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = 'pbkdf2$100000$wyzAJhmtZP5pO8h+3qMkag==$HGuPpdw1haoS/uZ3DJLy7KiUCgPeEMWd8kwIxRiXWEc=',
  role = 'admin',
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

-- Sincronización de cuenta institucional demo para usar las mismas credenciales
UPDATE crm_users 
SET password_hash = 'pbkdf2$100000$wyzAJhmtZP5pO8h+3qMkag==$HGuPpdw1haoS/uZ3DJLy7KiUCgPeEMWd8kwIxRiXWEc=',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'admin@arksystems.site';
