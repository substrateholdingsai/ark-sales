-- 0011_altum_email_templates.sql: Plantilla de Correo Brandeada ALTUM Sureste
-- Estrictamente aislada bajo tenant_id = 'acc_altum_sureste' con Tokens del Design System Altum

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
)
VALUES (
  'tmpl_altum_propuesta_inmobiliaria',
  'acc_altum_sureste',
  'ALTUM · Ficha de Selección y Apartado Inmobiliario',
  'propuesta_inmobiliaria_altum',
  'propuesta',
  'ALTUM Sureste: Ficha de Selección y Apartado para {{contacto_nombre}} — {{propiedad_nombre}}',
  '<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ALTUM Sureste · Real Estate Caribe</title>
<style>
  body { margin:0; padding:0; background-color:#F7F4ED; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:#1A2B3B; }
  .wrapper { width:100%; max-width:620px; margin:0 auto; padding:36px 16px; box-sizing:border-box; }
  .card { background-color:#FFFDF7; border:1px solid #D9C9B0; border-radius:6px; padding:36px 32px; box-shadow:0 12px 30px -8px rgba(26,43,59,0.08); }
  .brand-bar { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #D9C9B0; padding-bottom:18px; margin-bottom:24px; }
  .brand-title { font-family:Georgia,serif; font-size:20px; font-weight:700; letter-spacing:0.08em; color:#094F5B; text-transform:uppercase; }
  .brand-tagline { font-family:monospace; font-size:10px; color:#6B7682; letter-spacing:0.12em; text-transform:uppercase; }
  .badge { display:inline-block; padding:4px 12px; background:rgba(14,107,122,0.12); border:1px solid rgba(14,107,122,0.3); color:#094F5B; border-radius:9999px; font-size:11px; font-weight:600; font-family:monospace; text-transform:uppercase; margin-bottom:16px; }
  h1 { font-family:Georgia,serif; font-size:24px; font-weight:700; color:#1A2B3B; margin:0 0 12px 0; line-height:1.25; }
  p { font-size:15px; color:#3E4F5C; line-height:1.65; margin:0 0 16px 0; }
  .property-box { background-color:#F7F4ED; border:1px solid #D9C9B0; border-radius:4px; padding:20px; margin:20px 0; }
  .property-title { font-family:Georgia,serif; font-size:18px; font-weight:700; color:#094F5B; margin-bottom:6px; }
  .property-loc { font-family:monospace; font-size:12px; color:#6B7682; margin-bottom:14px; }
  .spei-box { background-color:#0F1E1A; border-radius:6px; padding:22px; text-align:center; color:#F7F4ED; margin:24px 0; }
  .spei-label { font-family:monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.1em; color:#2FB8CC; margin-bottom:8px; }
  .spei-clabe { font-family:monospace; font-size:22px; font-weight:700; letter-spacing:0.08em; color:#F7F4ED; margin:6px 0; }
  .spei-amount { font-family:monospace; font-size:18px; font-weight:600; color:#C9573F; margin-top:4px; }
  .cta-btn { display:inline-block; background-color:#0E6B7A; color:#FFFFFF !important; text-decoration:none; padding:14px 28px; border-radius:4px; font-weight:600; font-size:15px; text-align:center; }
  .footer-text { font-family:monospace; font-size:11px; color:#6B7682; text-align:center; margin-top:28px; line-height:1.5; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="brand-bar">
      <div>
        <div class="brand-title">ALTUM SURESTE</div>
        <div class="brand-tagline">Real Estate Caribe Mexicano</div>
      </div>
      <span class="badge">Ficha de Apartado</span>
    </div>

    <h1>Estimado/a {{contacto_nombre}},</h1>
    <p>
      Le presentamos la ficha técnica y orden de apartado prioritario para <strong>{{propiedad_nombre}}</strong> en la región de <strong>{{region_destino}}</strong>.
    </p>
    <p>
      En ALTUM presentamos destinos con identidad, proporción y cal maya viva. Cada propiedad seleccionada cuenta con dictamen legal, certeza jurídica y viabilidad ambiental plena.
    </p>

    <div class="property-box">
      <div class="property-title">{{propiedad_nombre}}</div>
      <div class="property-loc">Región: {{region_destino}} &bull; Destino Curado ALTUM</div>
      <p style="font-size:13px; color:#6B7682; margin:0;">
        El inmueble queda apartado y bloqueado para su adquisición durante 48 horas una vez registrado el depósito de apartado interbancario.
      </p>
    </div>

    <div class="spei-box">
      <div class="spei-label">Transferencia SPEI · Cuenta STP de Apartado</div>
      <div class="spei-clabe">{{clabe_stp}}</div>
      <div class="spei-amount">Monto de Reserva: {{monto_apartado}}</div>
      <div style="font-size:11px; color:#D9C9B0; margin-top:6px;">Banco Receptor: STP (Sistema de Transferencias y Pagos) &bull; Acreditación inmediata</div>
    </div>

    <p style="text-align:center; margin:28px 0 16px 0;">
      <a href="{{checkout_url}}" class="cta-btn">Confirmar Apartado en Línea</a>
    </p>

    <div class="footer-text">
      ALTUM Real Estate · Riviera Maya &bull; Mérida &bull; Tulum &bull; Holbox &bull; Bacalar &bull; Cozumel<br>
      Operado bajo infraestructura multitenant de ARK Sales CRM &bull; Tenant: acc_altum_sureste
    </div>
  </div>
</div>
</body>
</html>',
  '["contacto_nombre", "propiedad_nombre", "region_destino", "clabe_stp", "monto_apartado", "checkout_url"]',
  1
);
