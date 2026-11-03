-- 0020_email_template_gancho_ledger_freemium.sql: Plantilla Oficial Gancho Ark Ledger (Freemium $0)
-- Permite disparar la campaña de prospección a despachos contables y fiscalistas sin costo de por vida

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
  'tmpl_gancho_ledger_freemium',
  'acc_ark_ledger',
  'Ark Ledger · Gancho Freemium Fiscal & Calculadoras DOF ($0)',
  'gancho_ark_ledger_freemium',
  'onboarding',
  'Control fiscal inteligente sin costo para ti, {{nombre}}',
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Asistente Fiscal y Calculadoras DOF · Ark Ledger</title>
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

  <!-- Preheader Oculto (Vista Previa en Inbox) -->
  <div style="display: none; font-size: 1px; color: #0b0f19; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Accede gratis de por vida a 20 calculadoras fiscales del DOF y consultas con Noah AI para tu despacho.
  </div>

  <center>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="content-table">
      
      <!-- Encabezado / Branding -->
      <tr>
        <td style="padding: 32px 36px 20px 36px; border-bottom: 1px solid #1f2937; background: linear-gradient(180deg, #161f36 0%, #111827 100%);" class="p-responsive">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <span style="display: inline-block; padding: 4px 10px; background-color: rgba(14,165,233,0.15); border: 1px solid rgba(56,189,248,0.3); border-radius: 6px; color: #38bdf8; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">
                  ARK LEDGER &bull; FREEMIUM 2026
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 14px;">
                <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; line-height: 1.3;">
                  Control fiscal inteligente sin costo para ti, {{nombre}}.
                </h1>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Cuerpo del Mensaje -->
      <tr>
        <td style="padding: 28px 36px; color: #d1d5db; font-size: 15px; line-height: 1.6;" class="p-responsive">
          <p style="margin: 0 0 16px 0;">
            Estimado/a <strong>{{nombre}}</strong>,
          </p>
          <p style="margin: 0 0 16px 0; color: #9ca3af;">
            Sabemos que en los despachos contables y la gestión de <strong>{{empresa}}</strong> el tiempo vale oro y las consultas normativas en el Diario Oficial de la Federación (DOF) requieren precisión milimétrica.
          </p>
          <p style="margin: 0 0 24px 0;">
            Por ello, habilitamos tu acceso a <strong>Ark Ledger Freemium</strong>, una plataforma diseñada para automatizar cálculos complejos y respaldar tu toma de decisiones financieras <strong style="color: #ffffff;">sin costo de por vida</strong>:
          </p>

          <!-- Tarjeta de Beneficios / Arsenal Freemium -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 26px;">
            <tr>
              <td style="padding: 20px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding-bottom: 12px; color: #ffffff; font-size: 14px; font-weight: 600;">
                      <span style="color: #38bdf8; margin-right: 8px;">✓</span> 20 calculadoras fiscales del DOF actualizadas en pantalla
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px; color: #ffffff; font-size: 14px; font-weight: 600;">
                      <span style="color: #38bdf8; margin-right: 8px;">✓</span> 10 consultas mensuales con Noah AI (Asistente Fiscal inteligente)
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 12px; color: #ffffff; font-size: 14px; font-weight: 600;">
                      <span style="color: #38bdf8; margin-right: 8px;">✓</span> Interfaz optimizada para despachos y contadores independientes
                    </td>
                  </tr>
                  <tr>
                    <td style="color: #ffffff; font-size: 14px; font-weight: 600;">
                      <span style="color: #38bdf8; margin-right: 8px;">✓</span> Sin tarjetas de crédito ni letras chiquitas ($0 de por vida)
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin: 0 0 24px 0; font-size: 14px; color: #9ca3af;">
            Comienza a utilizar las herramientas fiscales de inmediato haciendo clic en el botón de abajo.
            <br /><span style="font-size: 12px; color: #64748b;">(Nota: Los cálculos en pantalla son libres sin costo. Si requieres timbrado masivo CFDI 4.0 o imprimir papeles de trabajo oficiales con sello criptográfico inmutable SHA-256 + QR, la versión PRO es opcional).</span>
          </p>

          <!-- Botón de Llamado a la Acción (Bulletproof CTA con Referral Tracking) -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
            <tr>
              <td align="center">
                <a href="{{link_activacion}}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(2,132,199,0.4); text-align: center;">
                  Entrar a Ark Ledger Freemium &rarr;
                </a>
              </td>
            </tr>
          </table>

          <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
            Acceso inmediato &bull; Sin tarjeta bancaria requerida
          </p>
        </td>
      </tr>

      <!-- Pie de Página Institucional & Desuscripción -->
      <tr>
        <td style="padding: 24px 36px; background-color: #0f172a; border-top: 1px solid #1f2937; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5;" class="p-responsive">
          <p style="margin: 0 0 8px 0;">
            Mensaje emitido por <strong>ARK Systems</strong> en colaboración con la red de servicios contables y tecnológicos.
          </p>
          <p style="margin: 0 0 12px 0;">
            Mérida, Yucatán &bull; Infraestructura Cloudflare &bull; Ark Ledger Division
          </p>
          <p style="margin: 0;">
            Si prefieres no recibir más invitaciones operativas, puedes <a href="{{unsubscribe_url}}" style="color: #94a3b8; text-decoration: underline;">darte de baja aquí</a>.
          </p>
        </td>
      </tr>

    </table>
  </center>

</body>
</html>',
  '["nombre", "empresa", "link_activacion", "unsubscribe_url"]',
  1
);
