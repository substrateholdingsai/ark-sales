-- 0016_canaco_arkledger_pricing_tiers.sql: Ecosistema CANACO, Ark Ledger & Arkangel
-- Define el tier Freemium ($0), Plan PRO Despacho ($399 MXN/mes) y la Landing Ark-Commerce Gratuita para Agremiados CANACO (CAC trojano).

-- 1. Actualizar o insertar Ark Ledger PRO Despacho ($399 MXN / mes)
INSERT INTO sales_config (id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status)
VALUES (
  'cfg_ledger_pro',
  'ledger_pro',
  'Ark Ledger — Plan PRO Despacho',
  399.00,
  NULL,
  'MXN',
  'mensual',
  'despacho',
  'subscription',
  399.00,
  'Monetización del Valor Operativo para despachos contables: Impresión de Papeles de Trabajo Oficiales en formato Carta (@media print), Sellado Criptográfico SHA-256 inmutable + Código QR de Verificación Pública sin login, Consultas ilimitadas de IA (Workers AI / Llama 3.3 70B), Expediente Único y almacenamiento multi-tenant en la nube.',
  '["Impresión de Papeles de Trabajo Oficiales en formato Carta (@media print)", "Sellado Criptográfico SHA-256 inmutable + Código QR de Verificación Pública sin login (/verify)", "Consultas ilimitadas de IA con Noah AI (Workers AI / Llama 3.3 70B)", "Expediente Único y resguardo fiscal multi-tenant por 5 a 10 años (Art. 30 CFF)", "20 herramientas fiscales y financieras DOF en vivo"]',
  'active'
)
ON CONFLICT(product_key) DO UPDATE SET
  name = excluded.name,
  price_mxn = excluded.price_mxn,
  currency = excluded.currency,
  billing_period = excluded.billing_period,
  unit = excluded.unit,
  pricing_model = excluded.pricing_model,
  min_monthly_mxn = excluded.min_monthly_mxn,
  description = excluded.description,
  features_json = excluded.features_json,
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

-- 2. Registrar Nivel Freemium ($0 MXN) de Ark Ledger
INSERT INTO sales_config (id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status)
VALUES (
  'cfg_ledger_freemium',
  'ledger_freemium',
  'Ark Ledger — Freemium (Captación y Enganche)',
  0.00,
  NULL,
  'MXN',
  'mensual',
  'usuario',
  'subscription',
  0.00,
  'Cero fricción sin tarjeta de crédito. Uso ilimitado de las 20 herramientas fiscales y financieras para cálculos en pantalla y hasta 10 consultas mensuales con Noah AI.',
  '["Uso ilimitado de 20 calculadoras y simuladores fiscales DOF en pantalla", "Hasta 10 consultas mensuales con Asistente Noah AI", "Sin tarjeta de crédito de arranque", "Diseñado para generar hábito diario en contadores y comercios"]',
  'active'
)
ON CONFLICT(product_key) DO UPDATE SET
  name = excluded.name,
  price_mxn = excluded.price_mxn,
  description = excluded.description,
  features_json = excluded.features_json,
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

-- 3. Actualizar producto base 'ledger' para reflejar el plan PRO Despacho de $399 MXN
UPDATE sales_config 
SET 
  name = 'Ark Ledger (Plan PRO Despacho)',
  price_mxn = 399.00,
  currency = 'MXN',
  billing_period = 'mensual',
  unit = 'despacho',
  pricing_model = 'subscription',
  min_monthly_mxn = 399.00,
  description = 'Suscripción PRO para Despachos Contables ($399 MXN/mes): Impresión de Papeles Oficiales Carta (@media print), Sello Criptográfico SHA-256 + QR público, Noah AI ilimitado y Expediente Único resguardado.',
  features_json = '["Impresión Papeles de Trabajo Carta (@media print)", "Sellado Criptográfico SHA-256 inmutable + QR público sin login", "Consultas ilimitadas de IA (Noah AI / Llama 3.3 70B)", "Expediente Único resguardado por 5-10 años (Art. 30 CFF)", "20 herramientas DOF y conciliación fiscal"]',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP
WHERE product_key = 'ledger';

-- 4. Registrar la Alianza CANACO / Ark-Commerce Landing Gratuita (CAC $0)
INSERT INTO sales_config (id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status)
VALUES (
  'cfg_commerce_canaco',
  'commerce_canaco',
  'Ark Commerce — Alianza CANACO (Landing Gratuita)',
  0.00,
  NULL,
  'MXN',
  'mensual',
  'comercio',
  'subscription',
  0.00,
  'Beneficio exclusivo para agremiados CANACO (vía trámite SIEM obligatorio): Landing page y catálogo comercial Ark-Commerce sin costo (precio regular $299 MXN/mes financiado al 100% como canal de adquisición).',
  '["Landing page institucional y catálogo de venta online para agremiados CANACO", "Activación inmediata ligada al registro SIEM", "Integración nativa con Ark Ledger (cálculos fiscales $0) y Arkangel", "Sin costo mensual para el comerciante ($0 MXN vs $299 MXN precio regular)"]',
  'active'
)
ON CONFLICT(product_key) DO UPDATE SET
  name = excluded.name,
  price_mxn = excluded.price_mxn,
  description = excluded.description,
  features_json = excluded.features_json,
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

-- 5. Actualizar Ark-Commerce regular ($299 MXN / mes)
INSERT INTO sales_config (id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status)
VALUES (
  'cfg_commerce_regular',
  'commerce',
  'Ark Commerce (Tienda & Landing Page)',
  299.00,
  NULL,
  'MXN',
  'mensual',
  'tienda',
  'subscription',
  299.00,
  'Tienda en línea y landing page comercial de alta conversión sobre Cloudflare Edge para comercios y PyMEs.',
  '["Landing page de alta velocidad desplegada en Cloudflare Edge", "Catálogo digital de productos y servicios", "Checkout integrado SPEI / Tarjeta", "Integración con Ark Ledger y Arkangel"]',
  'active'
)
ON CONFLICT(product_key) DO UPDATE SET
  name = excluded.name,
  price_mxn = 299.00,
  currency = 'MXN',
  billing_period = 'mensual',
  unit = 'tienda',
  pricing_model = 'subscription',
  min_monthly_mxn = 299.00,
  description = excluded.description,
  features_json = excluded.features_json,
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

-- 6. Actualizar o insertar Add-ons de Arkangel (Voz, WhatsApp, SMS, Email)
INSERT INTO sales_config (id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status)
VALUES 
  (
    'cfg_angel_voice_std',
    'angel_voice',
    'Ark Angel — Voz AI Omnicanal',
    5.00,
    0.25,
    'USD',
    'por_minuto',
    'minuto',
    'usage',
    NULL,
    'Llamada con IA de voz natural (Llamada + STT + LLM + TTS + Motor Legal fail-closed). Tarifa oficial: $0.25 USD/min (Margen ~56-64%).',
    '["Voz en tiempo real con latencia de milisegundos", "Transcripción Deepgram Nova-3 + TTS ultra realista", "Motor Legal fail-closed (CONDUSEF/REDECO/NOM-184)", "Cancelación inmediata de colas ante confirmación SPEI"]',
    'active'
  ),
  (
    'cfg_angel_whatsapp_std',
    'angel_whatsapp',
    'Ark Angel — WhatsApp Business Legal',
    4.00,
    0.20,
    'USD',
    'por_mensaje',
    'mensaje',
    'usage',
    NULL,
    'WhatsApp Business con Motor Legal fail-closed y Grok Bot. Tarifa oficial: $0.20 USD/mensaje (Margen ~50-60%).',
    '["Mensajes interactivos con plantillas oficiales Meta", "Motor Legal fail-closed integrado", "Auditoría en tiempo real y CLABE de 18 dígitos", "Sincronización con CRM"]',
    'active'
  ),
  (
    'cfg_angel_sms_std',
    'angel_sms',
    'Ark Angel — SMS Transaccional',
    3.00,
    0.15,
    'USD',
    'por_mensaje',
    'mensaje',
    'usage',
    NULL,
    'SMS Transaccional para avisos urgentes y recordatorios. Tarifa: $0.15 USD/mensaje.',
    '["Envío masivo o individual", "Ruta directa de entrega", "Integración con CRM"]',
    'active'
  ),
  (
    'cfg_angel_email_std',
    'angel_email',
    'Ark Angel — Email Transaccional',
    1.20,
    0.06,
    'USD',
    'por_correo',
    'correo',
    'usage',
    NULL,
    'Email Transaccional auditado para estados de cuenta y notificaciones formales. Tarifa: $0.06 USD/correo.',
    '["Plantillas HTML responsive", "Tracking de aperturas y clics", "Entrega garantizada con DKIM y SPF"]',
    'active'
  ),
  (
    'cfg_ledger_enterprise_addon',
    'ledger_enterprise',
    'Ark Ledger — Módulo Fiscal Corporativo (Enterprise)',
    6000.00,
    NULL,
    'MXN',
    'mensual',
    'empresa',
    'subscription',
    4500.00,
    'Add-on Enterprise para corporativos y grandes despachos: $4,500 – $12,000 MXN / mes según volumen de timbrado y multi-razones sociales.',
    '["Multi-razón social ilimitada", "Conciliación masiva Anexo 24 y ERP", "Monitor Antilavado LFPIORPI Art. 17", "SLA prioritario y soporte contable dedicado"]',
    'active'
  )
ON CONFLICT(product_key) DO UPDATE SET
  name = excluded.name,
  price_mxn = excluded.price_mxn,
  price_usd = excluded.price_usd,
  currency = excluded.currency,
  billing_period = excluded.billing_period,
  unit = excluded.unit,
  pricing_model = excluded.pricing_model,
  min_monthly_mxn = excluded.min_monthly_mxn,
  description = excluded.description,
  features_json = excluded.features_json,
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;
