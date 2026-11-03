-- 0017_canaco_mailing_campaigns_and_domains.sql: Monitoreo de Campañas SIEM CANACO (1,200 socios)
-- Estrategia de barrido en Resend Free Tier (100 emails/día cada 12 días) y Dominio Dedicado por refacturar

-- 1. Tabla de Configuración y Métricas de la Campaña CANACO
CREATE TABLE IF NOT EXISTS canaco_campaign_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'canaco',
  name TEXT NOT NULL,
  total_subscribers INTEGER NOT NULL DEFAULT 1200,
  daily_batch_limit INTEGER NOT NULL DEFAULT 100, -- Límite del plan gratuito de Resend
  cycle_days INTEGER NOT NULL DEFAULT 12, -- 1,200 socios / 100 diarios = 12 días por ciclo
  current_cycle INTEGER NOT NULL DEFAULT 1,
  current_day_in_cycle INTEGER NOT NULL DEFAULT 1,
  last_batch_dispatched_at TIMESTAMP,
  dispatched_total INTEGER NOT NULL DEFAULT 0,
  delivered_total INTEGER NOT NULL DEFAULT 0,
  opened_total INTEGER NOT NULL DEFAULT 0,
  clicks_total INTEGER NOT NULL DEFAULT 0,
  conversions_siem_total INTEGER NOT NULL DEFAULT 0,
  conversions_pro_total INTEGER NOT NULL DEFAULT 0,
  dedicated_domain TEXT NOT NULL DEFAULT 'siem-canaco.com.mx',
  domain_cost_mxn REAL NOT NULL DEFAULT 299.00,
  domain_billing_status TEXT NOT NULL DEFAULT 'pendiente_refacturacion' CHECK (domain_billing_status IN ('pendiente_refacturacion', 'facturado', 'cobrado')),
  from_email TEXT NOT NULL DEFAULT 'afiliacion@siem-canaco.com.mx',
  landing_base_url TEXT NOT NULL DEFAULT 'https://canacomerida.arksystems.site/registro-siem',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Socios Agremiados para la Campaña (1,200 Socios)
CREATE TABLE IF NOT EXISTS canaco_subscribers (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES canaco_campaign_config(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL,
  socio_nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  siem_id TEXT,
  tamano TEXT DEFAULT '1-5',
  batch_number INTEGER NOT NULL DEFAULT 1, -- 1 al 12 (día asignado en el ciclo)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'registered_siem', 'converted_pro', 'bounced')),
  last_sent_at TIMESTAMP,
  cycle_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canaco_subs_batch ON canaco_subscribers(campaign_id, batch_number, status);
CREATE INDEX IF NOT EXISTS idx_canaco_subs_email ON canaco_subscribers(email);

-- 3. Semilla de Configuración Inicial de la Campaña
INSERT OR REPLACE INTO canaco_campaign_config (
  id,
  tenant_id,
  name,
  total_subscribers,
  daily_batch_limit,
  cycle_days,
  current_cycle,
  current_day_in_cycle,
  dispatched_total,
  opened_total,
  clicks_total,
  conversions_siem_total,
  conversions_pro_total,
  dedicated_domain,
  domain_cost_mxn,
  domain_billing_status,
  from_email,
  landing_base_url,
  status
) VALUES (
  'camp_canaco_siem_1200',
  'canaco',
  'Campaña Oficial SIEM CANACO · 1,200 Socios',
  1200,
  100,
  12,
  1,
  1,
  0,
  0,
  0,
  0,
  0,
  'siem-canaco.com.mx',
  299.00,
  'pendiente_refacturacion',
  'afiliacion@siem-canaco.com.mx',
  'https://canacomerida.arksystems.site/registro-siem',
  'active'
);

-- 4. Semilla de Plantilla de Correo Brandeada CANACO & SIEM
INSERT OR REPLACE INTO email_templates (
  id,
  tenant_id,
  name,
  slug,
  category,
  subject,
  html_content,
  variables_json,
  is_active
) VALUES (
  'tmpl_canaco_siem_invitacion',
  'canaco',
  'CANACO · Invitación Exclusiva SIEM & Tienda Ark Commerce',
  'canaco_siem_invitacion',
  'onboarding',
  'CANACO: Beneficio Institucional SIEM — Tienda Digital y Cierre Fiscal 2026 para {{empresa_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CANACO · Beneficio Institucional SIEM</title>
<style>
  body { margin:0; padding:0; background-color:#0b1329; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#f8fafc; }
  .wrapper { width:100%; max-width:620px; margin:0 auto; padding:32px 16px; box-sizing:border-box; }
  .card { background-color:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:36px 32px; box-shadow:0 12px 30px -8px rgba(0,0,0,0.5); }
  .header { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; padding-bottom:18px; margin-bottom:24px; }
  .logo-text { font-size:20px; font-weight:800; letter-spacing:0.04em; color:#38bdf8; text-transform:uppercase; }
  .badge { display:inline-block; padding:4px 12px; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:9999px; font-size:11px; font-weight:700; text-transform:uppercase; }
  h1 { font-size:22px; font-weight:700; color:#ffffff; margin:0 0 16px 0; line-height:1.3; }
  p { font-size:15px; color:#cbd5e1; line-height:1.6; margin:0 0 16px 0; }
  .benefit-box { background:rgba(30,41,59,0.7); border:1px solid #334155; border-radius:8px; padding:20px; margin:20px 0; }
  .benefit-item { display:flex; align-items:flex-start; margin-bottom:12px; }
  .check-icon { color:#10b981; font-weight:bold; margin-right:10px; }
  .cta-container { text-align:center; margin:32px 0 24px 0; }
  .cta-btn { display:inline-block; background-gradient:linear-gradient(to right, #0284c7, #2563eb); background-color:#0284c7; color:#ffffff !important; text-decoration:none; padding:15px 32px; border-radius:8px; font-weight:700; font-size:15px; box-shadow:0 8px 20px rgba(2,132,199,0.35); }
  .footer { font-size:11px; color:#64748b; text-align:center; margin-top:28px; line-height:1.5; border-top:1px solid #1e293b; padding-top:18px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div class="logo-text">CANACO <span style="color:#ffffff;">SERVYTUR</span></div>
      <div class="badge">Afiliación SIEM 2026</div>
    </div>
    <h1>Estimado(a) {{socio_nombre}},</h1>
    <p>Como parte de tu membresía y registro obligatorio en el <strong>SIEM (Sistema de Información Empresarial Mexicano)</strong>, la CANACO pone a disposición de <strong>{{empresa_nombre}}</strong> un paquete de digitalización e infraestructura operativa 100% bonificado:</p>
    
    <div class="benefit-box">
      <div class="benefit-item">
        <span class="check-icon">✓</span>
        <div><strong>Landing Page y Tienda Digital en Ark Commerce:</strong> Sin costo mensual ($0 MXN vs $299 regular). Tu negocio visible en internet al instante.</div>
      </div>
      <div class="benefit-item">
        <span class="check-icon">✓</span>
        <div><strong>Ark Ledger Freemium:</strong> 20 calculadoras y simuladores fiscales DOF en pantalla con asistencia de Noah AI.</div>
      </div>
      <div class="benefit-item">
        <span class="check-icon">✓</span>
        <div><strong>Blindaje SAT Opcional (Plan PRO Despacho):</strong> Impresión oficial Carta (@media print), sellado SHA-256 con QR y resguardo fiscal de 5 a 10 años (Art. 30 CFF).</div>
      </div>
    </div>

    <div class="cta-container">
      <a href="{{registration_link}}" class="cta-btn">Validar Registro SIEM y Reclamar Tienda Digital</a>
    </div>

    <p style="font-size:13px; color:#94a3b8; text-align:center;">Este enlace es único y seguro para tu razón social. Validez para el ciclo de registro en curso.</p>

    <div class="footer">
      Mensaje oficial emitido en coordinación con la Cámara Nacional de Comercio, Servicios y Turismo (CANACO) y la Secretaría de Economía.<br>
      Dominio verificado: {{from_email}} · No compartas este enlace.
    </div>
  </div>
</div>
</body>
</html>',
  '["empresa_nombre", "socio_nombre", "registration_link", "from_email"]',
  1
);

-- 5. Registrar Cohorte CANACO en sales_cohorts
INSERT OR REPLACE INTO sales_cohorts (cohort_id, name, description, query_sql, vertical, created_by)
VALUES (
  'canaco_socios_siem',
  'Socios CANACO para Regularización SIEM (1,200 comercios)',
  'Directorio de 1,200 comercios y empresas agremiadas a CANACO para barrido de mailing en 12 días (100 diarios vía Resend Free)',
  'SELECT DISTINCT a.* FROM sales_accounts a WHERE a.origin = ''canaco_siem'' OR a.origin = ''canaco_landing_white_label''',
  'ecommerce',
  'superadmin'
);
