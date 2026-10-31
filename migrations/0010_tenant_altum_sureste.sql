-- 0010_tenant_altum_sureste.sql: Alta del Tenant ALTUM Sureste (Bienes Raíces & Desarrollos Caribe)
-- Cero contaminación gráfica: registro de cuenta, contactos comerciales, oportunidades y catálogo dinámico independiente.

-- 1. Alta de la Cuenta / Organización (Tenant)
INSERT OR IGNORE INTO sales_accounts (
  id, name, normalized_name, size, city, origin, duplicate_review_status, created_at, updated_at
) VALUES (
  'acc_altum_sureste',
  'ALTUM Sureste · Real Estate & Desarrollos Caribe',
  'altum sureste',
  '21-50',
  'Mérida & Riviera Maya',
  'proptech_inmobiliaria',
  'reviewed',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2. Contactos Clave del Tenant
-- Director Comercial
INSERT OR IGNORE INTO sales_contacts (
  id, account_id, name, email, phone, title, consent_status, contact_preferences_json, created_at, updated_at
) VALUES (
  'cnt_altum_rodrigo',
  'acc_altum_sureste',
  'Lic. Rodrigo Montalvo Cárdenas',
  'rmontalvo@altumsureste.mx',
  '+529991234567',
  'Director Comercial & Expansión',
  'opted_in',
  '{"canal_preferido":"whatsapp_voz","horario":"09:00-18:00"}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Inversionista Prospecto
INSERT OR IGNORE INTO sales_contacts (
  id, account_id, name, email, phone, title, consent_status, contact_preferences_json, created_at, updated_at
) VALUES (
  'cnt_altum_regina',
  'acc_altum_sureste',
  'Dra. Regina Alcocer Méndez',
  'inversiones@alcocer.mx',
  '+529987654321',
  'Inversionista Patrimonial (Family Office)',
  'opted_in',
  '{"canal_preferido":"correo_spei","tipo_inversion":"rentas_vacacionales"}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 3. Catálogo Dinámico Inmobiliario de ALTUM Sureste en sales_config (Cero Hardcoding)
-- Apartado de Lote Residencial en Mérida Norte
INSERT OR IGNORE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_altum_apartado_lote',
  'altum_apartado_lote',
  'ALTUM · Apartado Lote Residencial (Mérida Norte)',
  20000.00,
  NULL,
  'MXN',
  'one_time',
  'lote',
  'package',
  NULL,
  'Apartado en firme de lote residencial en preventa (350 m2). Congela precio lista cero por 15 días con certeza jurídica ante el Registro Público (RPP) de Yucatán.',
  '["Certeza Jurídica RPP Yucatán", "Seguridad 24/7 y Casa Club", "Congelamiento de Precio Lista Cero", "CLABE SPEI STP Inmediata"]',
  'active',
  CURRENT_TIMESTAMP
);

-- Enganche Preventa Condo Boutique en Tulum / Riviera Maya
INSERT OR IGNORE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_altum_enganche_condo',
  'altum_enganche_condo',
  'ALTUM · Enganche Preventa Condo Boutique (Tulum)',
  50000.00,
  NULL,
  'MXN',
  'one_time',
  'unidad_condo',
  'package',
  NULL,
  'Enganche para departamento boutique de lujo en preventa Tulum. Alberca swim-up privada, cenote natural y administración condo-hotelera para rentas vacacionales (ROI estimado 14% USD).',
  '["Alberca privada tipo swim-up", "Cenote natural & Beach Club access", "Administración Condo-Hotelera Airbnb", "ROI estimado 14% en USD", "CLABE SPEI STP"]',
  'active',
  CURRENT_TIMESTAMP
);

-- Macrolote Comercial & Mixto
INSERT OR IGNORE INTO sales_config (
  id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status, updated_at
) VALUES (
  'cfg_altum_macrolote_comercial',
  'altum_macrolote_comercial',
  'ALTUM · Reserva Macrolote Comercial & Mixto',
  150000.00,
  NULL,
  'MXN',
  'one_time',
  'macrolote',
  'package',
  NULL,
  'Reserva institucional de macrolote comercial sobre avenida principal en corredor de alta plusvalía Riviera Maya / Periférico Mérida para desarrollo vertical o corporativo.',
  '["Uso de suelo mixto comercial", "Acceso directo sobre avenida principal", "Factibilidad de CFE y agua potable", "Escrituración inmediata ante Notario"]',
  'active',
  CURRENT_TIMESTAMP
);

-- 4. Oportunidad en Pipeline para Demostración
INSERT OR IGNORE INTO sales_opportunities (
  id, account_id, contact_id, lead_id, stage, owner_user_id, products_interest_json, estimated_value, currency, expected_close_date, loss_reason, created_at, updated_at
) VALUES (
  'opp_altum_001',
  'acc_altum_sureste',
  'cnt_altum_regina',
  NULL,
  'propuesta_enviada',
  NULL,
  '["altum_enganche_condo"]',
  50000.00,
  'MXN',
  '2026-11-15',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
