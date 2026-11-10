-- 0027_vendedores_ark_ledger.sql: Alta y actualización de vendedores para operar leads del tenant Ledger
-- Vendedor 1: horus.i2d@gmail.com / CanacoMerida2026!
-- Vendedor 2: hola@aceptabitcoin.org / temporal123

INSERT INTO crm_users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  'usr_vendedor_horus',
  'horus.i2d@gmail.com',
  'pbkdf2$100000$haClTSn0vIfle9fY0jSaBQ==$7oDsL/Emjx3NSX/CNqGvi2KBVz7DvX4cCwJpo8Xtm/I=',
  'Horus - Ventas Ledger',
  'vendedor',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = 'pbkdf2$100000$haClTSn0vIfle9fY0jSaBQ==$7oDsL/Emjx3NSX/CNqGvi2KBVz7DvX4cCwJpo8Xtm/I=',
  name = 'Horus - Ventas Ledger',
  role = 'vendedor',
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO crm_users (id, email, password_hash, name, role, is_active, created_at, updated_at)
VALUES (
  'usr_futura_daniel',
  'hola@aceptabitcoin.org',
  'pbkdf2$100000$9/MuofkwlqDrQH9lkOoSnQ==$dGlwj3ACD9H3y12o245AHnH7q2836dnvn4VawMbFX+4=',
  'Daniel Alfonso Benítez',
  'vendedor',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO UPDATE SET
  password_hash = 'pbkdf2$100000$9/MuofkwlqDrQH9lkOoSnQ==$dGlwj3ACD9H3y12o245AHnH7q2836dnvn4VawMbFX+4=',
  role = 'vendedor',
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;
