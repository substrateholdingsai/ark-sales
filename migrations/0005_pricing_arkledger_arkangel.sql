-- 0005_pricing_arkledger_arkangel.sql: Actualización oficial de catálogo y lista de precios Octubre 2026
-- Soporta cobranza por uso real en USD (Ark Angel) y add-on de cierre fiscal en MXN (Ark Ledger)

-- 1. Ampliar columnas en sales_config si no existen para modelos de uso y moneda
ALTER TABLE sales_config ADD COLUMN price_usd REAL DEFAULT NULL;
ALTER TABLE sales_config ADD COLUMN currency TEXT DEFAULT 'MXN';
ALTER TABLE sales_config ADD COLUMN pricing_model TEXT DEFAULT 'subscription'; -- 'subscription', 'usage', 'package', 'hybrid'
ALTER TABLE sales_config ADD COLUMN unit TEXT DEFAULT 'mes'; -- 'mes', 'minuto', 'mensaje', 'correo', 'consumo'
ALTER TABLE sales_config ADD COLUMN min_monthly_mxn REAL DEFAULT NULL;

-- 2. Actualizar Ark Ledger (anteriormente Ark Tools / Cierre Fiscal y Contable)
UPDATE sales_config 
SET 
  name = 'Ark Ledger (Cierre Fiscal y Contable)',
  price_mxn = 6000.00,
  currency = 'MXN',
  billing_period = 'mensual',
  unit = 'mes',
  pricing_model = 'subscription',
  min_monthly_mxn = 4500.00,
  description = 'Cierre fiscal y contable fail-closed: Cálculo CFF, Timbrado CFDI 4.0, Conciliación Anexo 24, Papel de Trabajo con Sello SHA-256 + QR, Ledger inmutable y asientos a Alegra.',
  features_json = '["Cálculo CFF y auditoría preventiva SAT", "Timbrado masivo CFDI 4.0", "Conciliación automática Anexo 24", "Papel de trabajo con sello criptográfico inmutable SHA-256 + QR", "Ledger inmutable con asientos a Alegra / ERP", "Add-on integrable con Ark Angel (Desde $6,000 MXN/mes; rango $4,500 - $12,000; alto volumen desde $3,500)"]',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP
WHERE product_key = 'ledger';

-- 3. Actualizar Ark Angel (Cobranza Multicanal con IA)
UPDATE sales_config 
SET 
  name = 'Ark Angel (Cobranza Multicanal con IA)',
  price_mxn = 8000.00,
  price_usd = 0.20,
  currency = 'USD',
  billing_period = 'consumo',
  unit = 'consumo',
  pricing_model = 'usage',
  min_monthly_mxn = 8000.00,
  description = 'Cobranza inteligente omnicanal con IA por uso real: Voz ($0.25 USD/min), WhatsApp ($0.20 USD/msg), SMS ($0.15 USD) y Email ($0.06 USD). Motor Legal fail-closed y Grok Bot incluidos.',
  features_json = '["Llamadas de cobranza con Voz IA (STT + LLM + TTS a $0.25 USD/min)", "Cobranza automatizada por WhatsApp ($0.20 USD/msg)", "SMS ($0.15 USD) y Email ($0.06 USD)", "Motor Legal fail-closed: 12 reglas / 48 conductas integradas", "Grok Bot para decisiones automáticas, clasificación y escalamiento", "Ledger de auditoría, arquitectura multi-tenant y Softphone con Copilot", "Sin costo de setup ni licencias de arranque (Mínimo mensual recomendado $8,000 - $12,000 MXN)"]',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP
WHERE product_key = 'angel';

-- 4. Actualizar Bundle Total -> Paquete Enterprise (Ark Angel + Ark Ledger)
UPDATE sales_config 
SET 
  name = 'Paquete Enterprise (Ark Angel + Ark Ledger)',
  price_mxn = 10000.00,
  currency = 'MXN',
  billing_period = 'mensual_hibrido',
  unit = 'mes',
  pricing_model = 'package',
  min_monthly_mxn = 8000.00,
  description = 'Solución integral para despachos y operaciones financieras: Cobranza omnicanal IA (Voz + WhatsApp + SMS + Email) + Ark Ledger completo con sellado SHA-256.',
  features_json = '["Cobranza Omnicanal IA (Voz $0.25/min + WhatsApp $0.20/msg)", "Motor Legal fail-closed (12 reglas / 48 conductas)", "Grok Bot integrado para investigación y decisiones", "Módulo Fiscal y Contable Ark Ledger completo ($6,000 - $10,000 MXN)", "Papel de trabajo con sello criptográfico SHA-256 + QR", "Conciliación Anexo 24 y timbrado CFDI 4.0", "Mínimo mensual recomendado: $8,000 - $12,000 MXN (Contratos de 3 o 6 meses)"]',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP
WHERE product_key = 'bundle';

-- 5. Dar de alta canales específicos y paquetes sugeridos para consulta granular del bot
INSERT OR IGNORE INTO sales_config (id, product_key, name, price_mxn, price_usd, currency, billing_period, unit, pricing_model, min_monthly_mxn, description, features_json, status)
VALUES 
  (
    'cfg_angel_voice',
    'angel_voice',
    'Ark Angel — Voz IA (Cobranza)',
    5.00,
    0.25,
    'USD',
    'por_minuto',
    'minuto',
    'usage',
    NULL,
    'Llamada con IA de voz natural (STT + LLM + TTS + Motor Legal + Grok Bot). Rango $0.22 - $0.28 USD/min (Recomendado ancla: $0.25/min).',
    '["Voz en tiempo real con mínima latencia", "Transcripción STT y síntesis TTS ultrarrealista", "Motor Legal fail-closed integrado", "Clasificación automática de resultados con Grok Bot"]',
    'active'
  ),
  (
    'cfg_angel_whatsapp',
    'angel_whatsapp',
    'Ark Angel — WhatsApp IA',
    4.00,
    0.20,
    'USD',
    'por_mensaje',
    'mensaje',
    'usage',
    NULL,
    'Mensaje interactivo de cobranza por WhatsApp con Motor Legal + Grok Bot + auditoría. Rango $0.18 - $0.25 USD (Recomendado: $0.20/msg).',
    '["Plantillas oficiales y conversación interactiva", "Motor Legal fail-closed (12 reglas)", "Grok Bot para respuestas inteligentes y escalamiento", "Auditoría en tiempo real"]',
    'active'
  ),
  (
    'cfg_package_starter',
    'package_starter',
    'Paquete Starter (Cobranza Digital)',
    3000.00,
    0.15,
    'USD',
    'consumo',
    'mensaje',
    'package',
    5000.00,
    'WhatsApp ($0.20) + SMS ($0.15) + Email ($0.06) + Motor Legal. Ideal para despachos chicos e inmobiliarias.',
    '["Canales digitales: WhatsApp + SMS + Email", "Motor Legal fail-closed incluido", "Grok Bot para clasificación y notas", "Precio orientativo: Desde $0.15 - $0.20 USD / mensaje"]',
    'active'
  ),
  (
    'cfg_package_professional',
    'package_professional',
    'Paquete Professional (Cobranza Omnicanal + Voz)',
    6000.00,
    0.25,
    'USD',
    'consumo',
    'minuto_y_mensajes',
    'package',
    8000.00,
    'Todo lo digital + Voz IA ($0.25 USD/min). Ideal para despachos medianos con cartera morosa activa.',
    '["Voz IA ($0.25 USD/min real)", "WhatsApp ($0.20 USD) + SMS + Email", "Motor Legal fail-closed + Grok Bot", "Softphone auditado y Copilot para operadores"]',
    'active'
  );
