-- 0018_tenant_ark_ledger.sql: Alta del Tenant Ark Ledger (Suite Fiscal & Contable)
-- Incluye:
-- 1. Cuenta Tenant (acc_ark_ledger) para aislamiento multitenant de campañas y superadmin
-- 2. Contacto Institucional de Ark Ledger
-- 3. Cohorte dedicada en sales_cohorts para despachos contables y fiscalistas
-- 4. Plantilla brandeada oficial de invitación a despachos contables (tmpl_ark_ledger_invitacion_despachos)

-- 1. Cuenta Tenant
INSERT OR IGNORE INTO sales_accounts (
  id, name, normalized_name, size, city, origin, duplicate_review_status, scian_code, harvest_source, created_at, updated_at
) VALUES (
  'acc_ark_ledger',
  'Ark Ledger · Suite Fiscal y Contable',
  'ark ledger',
  '6-20',
  'Mérida, Yucatán (Nacional)',
  'internal_product',
  'reviewed',
  '541211',
  'direct_onboarding',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 2. Contacto Institucional
INSERT OR REPLACE INTO sales_contacts (
  id, account_id, name, email, phone, title, consent_status, contact_preferences_json, created_at, updated_at
) VALUES (
  'cnt_ark_ledger_admin',
  'acc_ark_ledger',
  'Pavel · Dirección Ark Ledger',
  'pavel@arksystems.site',
  '+525657062511',
  'Director de Producto · Ark Ledger',
  'opted_in',
  '{"canal_preferido":"email","soporte_whatsapp":"+525657062511","remitente_oficial":"ARK LEDGER <no-reply@mail.arksystems.site>"}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 3. Cohorte en sales_cohorts para Despachos Contables y Fiscalistas CFF/DOF
INSERT OR REPLACE INTO sales_cohorts (cohort_id, name, description, query_sql, vertical, created_by)
VALUES (
  'ark_ledger_despachos',
  'Ark Ledger · Despachos Contables y Fiscalistas (CFF & DOF)',
  'Despachos contables, auditores fiscales y agencias de nómina perfilados por Lead Harvester con códigos SCIAN 541211, 541212, 541219, 541110 para colocación de Plan PRO Despacho ($399 MXN) y Freemium',
  'SELECT DISTINCT a.* FROM sales_accounts a LEFT JOIN sales_leads l ON l.account_id = a.id LEFT JOIN sales_observations o ON a.id = o.account_id WHERE a.scian_code IN (''541211'', ''541212'', ''541219'', ''541110'', ''561490'', ''541210'') OR a.tenant_id = ''acc_ark_ledger'' OR l.dolor_detectado IN (''fiscal'', ''cierre_fiscal_y_cfdi'', ''papeles_trabajo_despacho'', ''calculo_nomina_isn'') OR o.signal_code IN (''DOLOR_SAT'', ''DOLOR_CFDI'', ''SOFTWARE_CONTABLE'')',
  'fiscal',
  'system_onboarding'
);

-- 4. Plantilla Brandeada Oficial de Invitación a Despachos Contables
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
  'tmpl_ark_ledger_invitacion_despachos',
  'acc_ark_ledger',
  'Ark Ledger · Invitación Oficial a Despacho Contable (20 Herramientas DOF)',
  'invitacion_despacho_ark_ledger',
  'prospeccion',
  'Herramientas DOF y Papeles de Trabajo 2026 para {{despacho_nombre}} — Acceso Despacho',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ark Ledger · Suite Contable y Fiscal</title>
<style>
  body { margin:0; padding:0; background-color:#0b0f19; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#f1f5f9; }
  .wrapper { width:100%; max-width:620px; margin:0 auto; padding:36px 16px; box-sizing:border-box; }
  .card { background-color:#111827; border:1px solid #1f2937; border-radius:12px; padding:36px 32px; box-shadow:0 20px 40px -15px rgba(0,0,0,0.5); }
  .brand-bar { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #1f2937; padding-bottom:18px; margin-bottom:24px; }
  .brand-title { font-size:20px; font-weight:800; letter-spacing:0.05em; color:#38bdf8; text-transform:uppercase; }
  .brand-tagline { font-family:monospace; font-size:11px; color:#94a3b8; letter-spacing:0.08em; }
  .badge { display:inline-block; padding:4px 12px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.3); color:#38bdf8; border-radius:9999px; font-size:11px; font-weight:600; font-family:monospace; margin-bottom:16px; }
  h1 { font-size:22px; font-weight:700; color:#f8fafc; margin:0 0 14px 0; line-height:1.3; }
  p { font-size:14px; color:#cbd5e1; line-height:1.65; margin:0 0 16px 0; }
  .tool-grid { background:#1e293b; border:1px solid #334155; border-radius:8px; padding:18px; margin:20px 0; }
  .tool-item { font-size:13px; color:#e2e8f0; margin-bottom:8px; line-height:1.4; }
  .tool-item strong { color:#38bdf8; }
  .cta-container { text-align:center; margin:28px 0; }
  .cta-btn { display:inline-block; background-color:#0284c7; color:#ffffff !important; text-decoration:none; padding:14px 28px; border-radius:8px; font-weight:700; font-size:14px; box-shadow:0 4px 14px rgba(2,132,199,0.4); }
  .footer-text { font-family:monospace; font-size:11px; color:#64748b; text-align:center; margin-top:28px; line-height:1.5; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="brand-bar">
      <div>
        <div class="brand-title">ARK LEDGER</div>
        <div class="brand-tagline">Cloudflare Edge &bull; Fiscal y Contable</div>
      </div>
      <span class="badge">Acceso Colegiado</span>
    </div>

    <h1>Estimados Contadores de {{despacho_nombre}},</h1>

    <p>Sabemos que las continuas actualizaciones en criterios del SAT, las tasas de ISN diferenciadas en 32 entidades y la auditoría preventiva de CFDI 4.0 consumen horas valiosas en su operación.</p>

    <p>Hemos puesto a disposición de su despacho la suite en la nube <strong>Ark Ledger</strong> con acceso inmediato a 20 herramientas fiscales actualizadas al DOF 2026:</p>

    <div class="tool-grid">
      <div class="tool-item">&bull; <strong>Cálculo ISN Estatal:</strong> Tasas y sobretasas actualizadas de las 32 entidades federativas.</div>
      <div class="tool-item">&bull; <strong>Auditor CFDI y XML &rarr; Excel:</strong> Conversión y validación de consistencia fiscal en lote.</div>
      <div class="tool-item">&bull; <strong>SBC, Nómina y Finiquitos:</strong> Salario base con topes UMA e integración IMSS.</div>
      <div class="tool-item">&bull; <strong>Monitor LFPIORPI & RESICO:</strong> Umbrales antilavado y régimen simplificado de confianza.</div>
    </div>

    <p>Puede utilizar las calculadoras directamente en el navegador sin instalar ningún software ni registrar tarjetas de crédito.</p>

    <div class="cta-container">
      <a href="https://ledger.arksystems.site" class="cta-btn">Abrir Suite de Herramientas Ark Ledger &rarr;</a>
    </div>

    <div class="footer-text">
      Operado bajo infraestructura multitenant de ARK Sales &bull; Tenant: acc_ark_ledger<br>
      Substrate Holdings LLC &bull; Si no desea recibir estas invitaciones responda "BAJA".
    </div>
  </div>
</div>
</body>
</html>',
  '["despacho_nombre"]',
  1
);
