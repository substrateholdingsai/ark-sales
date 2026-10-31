-- 0008_superadmin_templates_campaigns.sql: Super Admin Resend Templates & Telnyx Voice AI Campaigns
-- Soporte multi-tenant para control de correo y voz agéntica

-- 1. Tabla de Plantillas HTML de Correo
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- NULL para plantillas globales/sistema, o account_id/tenant_id específico
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'propuesta' CHECK (category IN ('propuesta', 'onboarding', 'due_diligence', 'recuperacion', 'general')),
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_slug_tenant 
  ON email_templates(slug, COALESCE(tenant_id, '__global__'));
CREATE INDEX IF NOT EXISTS idx_email_templates_tenant ON email_templates(tenant_id);

-- 2. Bitácora de Envíos Resend (Dispatches)
CREATE TABLE IF NOT EXISTS email_dispatches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  account_id TEXT,
  contact_id TEXT,
  template_slug TEXT,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  variables_payload_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'simulated')),
  resend_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_dispatches_tenant ON email_dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_dispatches_email ON email_dispatches(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_dispatches_created ON email_dispatches(created_at);

-- 3. Campañas de Voz AI Telnyx
CREATE TABLE IF NOT EXISTS voice_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, -- NULL = omni-tenant / global
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
  assistant_id TEXT,
  dolor_principal TEXT DEFAULT 'sat_fiscal_calculo',
  total_targets INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  created_by_user_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_campaigns_tenant ON voice_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_campaigns_status ON voice_campaigns(status);

-- 4. Destinatarios de Campañas de Voz (Targets)
CREATE TABLE IF NOT EXISTS voice_campaign_targets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES voice_campaigns(id) ON DELETE CASCADE,
  tenant_id TEXT,
  account_id TEXT,
  contact_id TEXT,
  lead_id TEXT,
  despacho_nombre TEXT,
  to_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'initiated', 'completed', 'failed', 'no_answer')),
  call_control_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_targets_campaign ON voice_campaign_targets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_targets_status ON voice_campaign_targets(status);
CREATE INDEX IF NOT EXISTS idx_voice_targets_phone ON voice_campaign_targets(to_phone);

-- 5. Semilla de Plantillas HTML Pre-diseñadas (Enterprise ARK)

-- A. Propuesta Paquete Enterprise
INSERT OR IGNORE INTO email_templates (id, tenant_id, name, slug, category, subject, html_content, variables_json, is_active)
VALUES (
  'tmpl_enterprise_proposal',
  NULL,
  'Propuesta Paquete Enterprise (Ark Angel + Ark Ledger)',
  'propuesta_enterprise',
  'propuesta',
  'Propuesta Formal ARK Systems: Paquete Enterprise para {{despacho_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Propuesta Comercial ARK Systems</title>
<style>
  body { margin:0; padding:0; background-color:#020617; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#f8fafc; }
  .wrapper { width:100%; max-width:640px; margin:0 auto; padding:32px 16px; box-sizing:border-box; }
  .card { background-color:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:36px 32px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); }
  .badge { display:inline-block; padding:4px 12px; background:rgba(37,99,235,0.15); border:1px solid #2563eb; color:#60a5fa; border-radius:9999px; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:16px; }
  h1 { font-size:24px; font-weight:700; color:#ffffff; margin:0 0 12px 0; line-height:1.3; }
  p { font-size:15px; color:#94a3b8; line-height:1.6; margin:0 0 16px 0; }
  .spec-box { background-color:#020617; border:1px solid #334155; border-radius:12px; padding:20px; margin:24px 0; }
  .spec-item { margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid #1e293b; }
  .spec-item:last-child { margin-bottom:0; padding-bottom:0; border-bottom:none; }
  .spec-title { font-size:14px; font-weight:600; color:#38bdf8; margin-bottom:4px; }
  .spec-desc { font-size:13px; color:#94a3b8; margin:0; }
  .price-highlight { font-size:26px; font-weight:800; color:#34d399; margin:8px 0; }
  .cta-btn { display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; font-size:15px; text-align:center; transition:background 0.2s; }
  .footer { margin-top:32px; text-align:center; font-size:12px; color:#64748b; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <span class="badge">Infraestructura Agéntica Oficial</span>
    <h1>Propuesta Comercial Enterprise</h1>
    <p>Estimado/a <strong>{{contacto_nombre}}</strong> de <strong>{{despacho_nombre}}</strong>:</p>
    <p>Presentamos la arquitectura integral de cobranza institucional con inteligencia artificial y blindaje fiscal inmutable diseñada para su operación.</p>
    
    <div class="spec-box">
      <div class="spec-item">
        <div class="spec-title">1. Ark Angel — Cobranza Multicanal & Telefonía de Voz IA</div>
        <div class="spec-desc">Gestión autónoma en llamadas salientes con voz en español neutro Telnyx ($0.25 USD/min) y WhatsApp Business ($0.20 USD/msg) bajo motor legal fail-closed (12 reglas CONDUSEF / NOM-184).</div>
      </div>
      <div class="spec-item">
        <div class="spec-title">2. Ark Ledger — Blindaje Fiscal & Sellado SHA-256</div>
        <div class="spec-desc">Timbrado CFDI 4.0, conciliación Anexo 24 y emisión de papeles de trabajo inmutables con sello criptográfico SHA-256 + QR oficial SAT.</div>
      </div>
      <div class="spec-item">
        <div class="spec-title">3. Modelo de Inversión Sugerido</div>
        <div class="price-highlight">{{precio_mxn}}</div>
        <div class="spec-desc">Facturación mensual transparente por consumo real + módulo fiscal fijo. Sin cargos ocultos de licenciamiento.</div>
      </div>
    </div>

    <p style="text-align:center; margin:28px 0 16px 0;">
      <a href="{{cta_url}}" class="cta-btn">Confirmar y Agendar Onboarding</a>
    </p>
    <p style="font-size:12px; color:#64748b; text-align:center;">Vigencia de cotización: {{vigencia_dias}} días. Contrato federado LEAD_INGEST_V3.</p>
  </div>
  <div class="footer">
    ARK Systems &copy; 2026 &middot; Ciudad de México &middot; sales.arksystems.site
  </div>
</div>
</body>
</html>',
  '["despacho_nombre", "contacto_nombre", "precio_mxn", "cta_url", "vigencia_dias"]',
  1
);

-- B. Onboarding y Bienvenida
INSERT OR IGNORE INTO email_templates (id, tenant_id, name, slug, category, subject, html_content, variables_json, is_active)
VALUES (
  'tmpl_onboarding_welcome',
  NULL,
  'Bienvenida & Activación de Infraestructura ARK',
  'onboarding_bienvenida',
  'onboarding',
  '¡Bienvenido a ARK Systems! Activación de tenant para {{despacho_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bienvenida a ARK</title>
<style>
  body { margin:0; padding:0; background-color:#020617; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#f8fafc; }
  .wrapper { width:100%; max-width:640px; margin:0 auto; padding:32px 16px; }
  .card { background-color:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:36px 32px; }
  .badge { display:inline-block; padding:4px 12px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#34d399; border-radius:9999px; font-size:12px; font-weight:600; margin-bottom:16px; }
  h1 { font-size:24px; font-weight:700; color:#ffffff; margin:0 0 12px 0; }
  p { font-size:15px; color:#94a3b8; line-height:1.6; margin:0 0 16px 0; }
  .steps { margin:24px 0; }
  .step-row { display:flex; gap:12px; margin-bottom:16px; }
  .num { width:28px; height:28px; border-radius:50%; background:#2563eb; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:13px; flex-shrink:0; }
  .step-text { font-size:14px; color:#cbd5e1; }
  .cta-btn { display:inline-block; background-color:#10b981; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; font-size:15px; text-align:center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <span class="badge">Cuenta Activada Exitosamente</span>
    <h1>Su infraestructura agéntica está lista</h1>
    <p>Hola <strong>{{contacto_nombre}}</strong>, su organización <strong>{{despacho_nombre}}</strong> ha sido provisionada en la red edge de ARK Systems.</p>
    
    <div class="steps">
      <div class="step-row">
        <div class="num">1</div>
        <div class="step-text"><strong>Acceda a su Consola:</strong> Ingrese al CRM con su correo de administrador ({{admin_email}}).</div>
      </div>
      <div class="step-row">
        <div class="num">2</div>
        <div class="step-text"><strong>Conecte sus Canales:</strong> Habilite su número telefónico Telnyx (+52) y su plantilla WhatsApp Business.</div>
      </div>
      <div class="step-row">
        <div class="num">3</div>
        <div class="step-text"><strong>Cargue su Cartera:</strong> Suba su archivo de cuentas por cobrar o integre su ERP mediante API.</div>
      </div>
    </div>

    <p style="text-align:center; margin:28px 0 16px 0;">
      <a href="{{portal_url}}" class="cta-btn">Entrar al Panel de Control</a>
    </p>
  </div>
</div>
</body>
</html>',
  '["despacho_nombre", "contacto_nombre", "admin_email", "portal_url"]',
  1
);

-- C. Due Diligence Patrimonial & Cross-Border (US Proptech + Hermes)
INSERT OR IGNORE INTO email_templates (id, tenant_id, name, slug, category, subject, html_content, variables_json, is_active)
VALUES (
  'tmpl_due_diligence_hermes',
  NULL,
  'Due Diligence Patrimonial & Cross-Border (Hermes Intel)',
  'due_diligence_inmobiliario',
  'due_diligence',
  'Auditoría y Rastreo Patrimonial Cross-Border para {{despacho_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hermes US Intel</title>
<style>
  body { margin:0; padding:0; background-color:#020617; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#f8fafc; }
  .wrapper { width:100%; max-width:640px; margin:0 auto; padding:32px 16px; }
  .card { background-color:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:36px 32px; }
  .badge { display:inline-block; padding:4px 12px; background:rgba(217,119,6,0.15); border:1px solid #d97706; color:#fbbf24; border-radius:9999px; font-size:12px; font-weight:600; margin-bottom:16px; }
  h1 { font-size:24px; font-weight:700; color:#ffffff; margin:0 0 12px 0; }
  p { font-size:15px; color:#94a3b8; line-height:1.6; margin:0 0 16px 0; }
  .feature-pill { display:inline-block; background:#1e293b; padding:6px 12px; border-radius:6px; font-size:13px; color:#38bdf8; margin:4px; }
  .cta-btn { display:inline-block; background-color:#d97706; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; font-size:15px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <span class="badge">Inteligencia Transfronteriza</span>
    <h1>Debida Diligencia & UBO Resolution</h1>
    <p>Estimado/a <strong>{{contacto_nombre}}</strong>:</p>
    <p>Para su equipo en <strong>{{despacho_nombre}}</strong>, resolver la identidad de socios detrás de LLCs en EE.UU. y auditar el patrimonio de inversionistas inmobiliarios ahora es 100% automatizado con <strong>Hermes US Intel</strong>.</p>
    <div style="margin:20px 0;">
      <span class="feature-pill">&check; Delaware, Texas, Florida, Nevada</span>
      <span class="feature-pill">&check; SEC Form D & FINRA Check</span>
      <span class="feature-pill">&check; Equity de Propiedades por Condado</span>
      <span class="feature-pill">&check; Skip-trace TCPA Compliant</span>
    </div>
    <p style="text-align:center; margin:28px 0;">
      <a href="{{demo_url}}" class="cta-btn">Ver Demo de Dossier Patrimonial</a>
    </p>
  </div>
</div>
</body>
</html>',
  '["despacho_nombre", "contacto_nombre", "demo_url"]',
  1
);

-- D. Reactivación y Rescate de Flujo
INSERT OR IGNORE INTO email_templates (id, tenant_id, name, slug, category, subject, html_content, variables_json, is_active)
VALUES (
  'tmpl_recuperacion_flujo',
  NULL,
  'Reactivación de Cartera Morosa & Cobranza con IA',
  'recuperacion_cartera_flujo',
  'recuperacion',
  'Optimización de Liquidez: Reducción de Cartera Vencida para {{despacho_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recuperación de Cartera</title>
<style>
  body { margin:0; padding:0; background-color:#020617; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#f8fafc; }
  .wrapper { width:100%; max-width:640px; margin:0 auto; padding:32px 16px; }
  .card { background-color:#0f172a; border:1px solid #1e293b; border-radius:16px; padding:36px 32px; }
  .badge { display:inline-block; padding:4px 12px; background:rgba(239,68,68,0.15); border:1px solid #ef4444; color:#f87171; border-radius:9999px; font-size:12px; font-weight:600; margin-bottom:16px; }
  h1 { font-size:24px; font-weight:700; color:#ffffff; margin:0 0 12px 0; }
  p { font-size:15px; color:#94a3b8; line-height:1.6; margin:0 0 16px 0; }
  .stat-card { background:#020617; border:1px solid #1e293b; border-radius:8px; padding:16px; text-align:center; margin:16px 0; }
  .stat-val { font-size:32px; font-weight:800; color:#34d399; }
  .cta-btn { display:inline-block; background-color:#2563eb; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:600; font-size:15px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <span class="badge">Flujo y Liquidez Inmediata</span>
    <h1>Recupere su Cartera Vencida con IA</h1>
    <p>Estimado/a <strong>{{contacto_nombre}}</strong>:</p>
    <p>En <strong>{{despacho_nombre}}</strong>, los días de cartera vencida representan costo financiero directo. Nuestra solución <strong>Ark Angel</strong> gestiona contactos automáticos con Inteligencia Artificial conversacional.</p>
    <div class="stat-card">
      <div class="stat-val">+38%</div>
      <div style="font-size:13px; color:#94a3b8;">Incremento promedio en promesas de pago en los primeros 14 días</div>
    </div>
    <p style="text-align:center; margin:28px 0;">
      <a href="{{agenda_url}}" class="cta-btn">Agendar Sesión de Diagnóstico Gratuito</a>
    </p>
  </div>
</div>
</body>
</html>',
  '["despacho_nombre", "contacto_nombre", "agenda_url"]',
  1
);
