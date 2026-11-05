-- 0022_update_ark_ledger_official_template.sql: Plantilla Oficial Altum/Ark Ledger (20 Herramientas Fiscales DOF)
-- Actualiza la plantilla oficial para despachos contables y fiscalistas en México

INSERT OR REPLACE INTO email_templates (
  id,
  tenant_id,
  name,
  slug,
  category,
  subject,
  html_content,
  variables_json,
  is_active,
  created_at,
  updated_at
) VALUES (
  'tmpl_ark_ledger_invitacion_despachos',
  'acc_ark_ledger',
  'Ark Ledger · Suite 20 Herramientas Fiscales DOF (Oficial)',
  'invitacion_despacho_ark_ledger',
  'onboarding',
  'Estimado Contador / Contadora: Prueba Gratis las 20 Herramientas Fiscales DOF 2026',
  '<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Estimado Contador / Contadora: Prueba Gratis las 20 Herramientas Fiscales</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
  <style>
    /* Reset and base styles for email clients */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #fdf2f4; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif; }

    /* Mobile responsiveness */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .mobile-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .cta-button { width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #fdf2f4; width: 100%;">

  <!-- Preheader con espaciado invisible para vista previa en inbox -->
  <div style="display: none; font-size: 1px; color: #fdf2f4; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    Actualizado diariamente con el DOF. Acceso libre a la suite completa de 20 herramientas de cálculo y cumplimiento fiscal en México.
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fdf2f4; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 10px;">
        
        <!-- Main Container Table -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(190, 24, 93, 0.08);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="background-color: #4c1d34; padding: 32px 30px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #f472b6;">Infraestructura Contable • México</span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: 0.5px; line-height: 1.2;">ARK LEDGER</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td class="mobile-padding" style="padding: 36px 36px 20px 36px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color: #18181b; font-size: 16px; font-weight: 700; padding-bottom: 14px;">
                    Estimado(a) Colega Contador / Despacho Contable:
                  </td>
                </tr>
                <tr>
                  <td style="color: #3f3f46; font-size: 14px; line-height: 1.6; padding-bottom: 18px;">
                    Sabemos que la práctica profesional en México enfrenta hoy una sobrecarga regulatoria sin precedentes: plazos fatales, criterios complejos y cero margen de error ante el <strong>SAT, IMSS y la STPS</strong>.
                  </td>
                </tr>
                <tr>
                  <td style="color: #3f3f46; font-size: 14px; line-height: 1.6; padding-bottom: 22px;">
                    Por ello, te extendemos una invitación abierta para <strong style="color: #be185d;">probar gratis en producción la suite completa de 20 herramientas de alta precisión</strong> de ARK LEDGER.
                  </td>
                </tr>

                <!-- Highlight Box DOF -->
                <tr>
                  <td style="background-color: #fff1f2; border-left: 4px solid #db2777; padding: 18px 20px; border-radius: 0 8px 8px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="color: #831843; font-size: 14px; font-weight: 700; padding-bottom: 6px;">
                          ⚡ Sincronización Diaria con el Diario Oficial de la Federación (DOF)
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #4b5563; font-size: 13.5px; line-height: 1.55;">
                          Nuestros motores de cálculo (INPC, UMA 2026, recargos CFF Art. 17-A/21, RESICO, Modalidad 40 IMSS y tablas ISR) se actualizan en automático para garantizar papeles de trabajo infalibles.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Tools bullet preview -->
                <tr>
                  <td style="padding-top: 24px; padding-bottom: 24px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="color: #18181b; font-size: 15px; font-weight: 700; padding-bottom: 12px;">
                          ¿Qué incluye la suite para tu despacho?
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #3f3f46; font-size: 13.5px; line-height: 1.7; padding-bottom: 8px;">
                          <strong style="color: #be185d;">✓</strong> <strong>Cierre de Nómina Masivo & Cruce LFT:</strong> Concentrados y cédulas con Sello QR.
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #3f3f46; font-size: 13.5px; line-height: 1.7; padding-bottom: 8px;">
                          <strong style="color: #be185d;">✓</strong> <strong>Validador CFDI 4.0 & Detector EFOS:</strong> Cruce directo contra listas negras del Art. 69-B.
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #3f3f46; font-size: 13.5px; line-height: 1.7; padding-bottom: 8px;">
                          <strong style="color: #be185d;">✓</strong> <strong>Calculadoras Especializadas:</strong> ISN (32 estados), SBC, Finiquitos, RESICO y Balance General.
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #3f3f46; font-size: 13.5px; line-height: 1.7;">
                          <strong style="color: #be185d;">✓</strong> <strong>Bóveda Digital Art. 30 CFF:</strong> Soberanía y respaldo SHA-256 autónomo a 10 años.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td align="center" style="padding: 10px 0 28px 0;">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="background-color: #be185d; border-radius: 8px;">
                          <a href="https://ledger.arksystems.site/?utm_source=email&utm_medium=invitation&utm_campaign=20_herramientas" target="_blank" class="cta-button" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; border: 1px solid #be185d; display: inline-block;">
                            Probar las 20 Herramientas Gratis &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer / Compliance & Deliverability Opt-out -->
          <tr>
            <td align="center" style="background-color: #fafafa; padding: 24px 30px; border-top: 1px solid #f4e8ee; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="color: #71717a; font-size: 11.5px; line-height: 1.5; padding-bottom: 10px;">
                    Has recibido este comunicado institucional dirigido a profesionales contables y fiscales en México.<br>
                    <strong>ARK LEDGER • Infraestructura Fiscal y Tecnológica</strong>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="color: #a1a1aa; font-size: 11px;">
                    <a href="https://ledger.arksystems.site" target="_blank" style="color: #be185d; text-decoration: underline;">ledger.arksystems.site</a> | 
                    <a href="mailto:ventas@mail.arksystems.site?subject=Baja%20de%20lista%20Ark%20Ledger" style="color: #71717a; text-decoration: underline;">Darme de baja</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- End Main Container Table -->

      </td>
    </tr>
  </table>

</body>
</html>',
  '["despacho_nombre", "nombre"]',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
