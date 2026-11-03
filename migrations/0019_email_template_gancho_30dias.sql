-- 0019_email_template_gancho_30dias.sql: Plantilla Oficial Gancho Ark Commerce (30 Días Gratis)
-- Permite disparar la campaña de prospección freemium de baja fricción a comercios, pymes y despachos

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
  'tmpl_gancho_landing_30dias',
  NULL,
  'Ark Commerce · Gancho Landing & Catálogo 30 Días Gratis',
  'gancho_landing_30dias',
  'onboarding',
  '{{nombre}}, te activamos 30 días de tu landing y catálogo en la nube (sin costo)',
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Activación de Entorno Digital · ARK Systems</title>
  <style type="text/css">
    body { margin: 0; padding: 0; min-width: 100%; width: 100% !important; height: 100% !important; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif; }
    table { border-spacing: 0; font-family: inherit; }
    td { padding: 0; }
    img { border: 0; }
    .content-table { width: 100%; max-width: 600px; margin: 0 auto; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden; }
    @media screen and (max-width: 600px) {
      .content-table { width: 100% !important; border-radius: 0 !important; }
      .p-responsive { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 30px 10px; background-color: #0b0f19;">
  <div style="display: none; font-size: 1px; color: #0b0f19; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Tu landing page y catálogo en Cloudflare Edge listos sin tarjeta de crédito. Acceso 30 días sin costo.
  </div>
  <center>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="content-table">
      <tr>
        <td style="padding: 32px 36px 20px 36px; border-bottom: 1px solid #1f2937; background: linear-gradient(180deg, #161f36 0%, #111827 100%);" class="p-responsive">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <span style="display: inline-block; padding: 4px 10px; background-color: rgba(37,99,235,0.15); border: 1px solid rgba(59,130,246,0.3); border-radius: 6px; color: #60a5fa; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
                  ARK COMMERCE &bull; ALIANZA 2026
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 14px;">
                <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; line-height: 1.3;">
                  Tu presencia comercial en la nube está lista, {{nombre}}.
                </h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 28px 36px; color: #d1d5db; font-size: 15px; line-height: 1.6;" class="p-responsive">
          <p style="margin: 0 0 16px 0;">Hola <strong>{{nombre}}</strong>,</p>
          <p style="margin: 0 0 16px 0; color: #9ca3af;">
            Sabemos que digitalizar el catálogo de <strong>{{empresa}}</strong> y habilitar pedidos por WhatsApp suele implicar cotizaciones caras, diseñadores que tardan semanas y configuraciones técnicas complejas.
          </p>
          <p style="margin: 0 0 24px 0;">
            Para eliminar esa fricción, habilitamos un entorno comercial para tu negocio con <strong style="color: #ffffff;">30 días de cortesía total</strong> (sin contratos forzosos y sin necesidad de ingresar tarjeta bancaria):
          </p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 26px;">
            <tr>
              <td style="padding: 20px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td style="padding-bottom: 12px; color: #ffffff; font-size: 14px; font-weight: 600;"><span style="color: #38bdf8; margin-right: 8px;">✓</span> Landing Page ultrarrápida en Cloudflare Edge</td></tr>
                  <tr><td style="padding-bottom: 12px; color: #ffffff; font-size: 14px; font-weight: 600;"><span style="color: #38bdf8; margin-right: 8px;">✓</span> Catálogo móvil de productos y servicios con fotos y precios</td></tr>
                  <tr><td style="padding-bottom: 12px; color: #ffffff; font-size: 14px; font-weight: 600;"><span style="color: #38bdf8; margin-right: 8px;">✓</span> Botón directo a tu WhatsApp para recibir pedidos al instante</td></tr>
                  <tr><td style="color: #ffffff; font-size: 14px; font-weight: 600;"><span style="color: #38bdf8; margin-right: 8px;">✓</span> Módulo opcional de cobro vía transferencia SPEI en línea</td></tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin: 0 0 24px 0; font-size: 14px; color: #9ca3af;">
            El objetivo es que veas cómo funciona en la práctica. Si te funciona y te trae ventas, continúas; si no, la desactivas sin haber pagado un solo centavo.
          </p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
            <tr>
              <td align="center">
                <a href="{{link_activacion}}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(37,99,235,0.4); text-align: center;">
                  Activar mi entorno de 30 días gratis &rarr;
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
            No requiere tarjeta de crédito &bull; Activación en 2 minutos
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px 36px; background-color: #0f172a; border-top: 1px solid #1f2937; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;" class="p-responsive">
          <p style="margin: 0 0 8px 0;">Mensaje emitido por <strong>ARK Systems</strong> en colaboración con la red empresarial de Yucatán.</p>
          <p style="margin: 0 0 12px 0;">Mérida, Yucatán &bull; Infraestructura Cloudflare &bull; Motor Comercial Autónomo</p>
          <p style="margin: 0;">Si prefieres no recibir más invitaciones operativas, puedes <a href="{{unsubscribe_url}}" style="color: #94a3b8; text-decoration: underline;">darte de baja aquí</a>.</p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>',
  '["nombre", "empresa", "link_activacion", "unsubscribe_url"]',
  1
);
