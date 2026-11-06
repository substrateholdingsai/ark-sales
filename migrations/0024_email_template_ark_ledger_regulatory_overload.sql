-- 0024_email_template_ark_ledger_regulatory_overload.sql
-- Plantilla de campaña Ark Ledger para despachos con sobrecarga regulatoria.

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
  'tmpl_ark_ledger_sobrecarga_regulatoria',
  'acc_ark_ledger',
  'Ark Ledger · Sobrecarga Regulatoria',
  'ark_ledger_sobrecarga_regulatoria',
  'onboarding',
  '¿Tu despacho enfrenta sobrecarga regulatoria? Prueba gratis ARK LEDGER',
  '<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARK LEDGER - Sobrecarga Regulatoria</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030712; font-family: Arial, Helvetica, sans-serif; color: #f3f4f6;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #030712; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 4px 12px; border-radius: 20px;">
                                        <span style="color: #34d399; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">● En producción</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 40px 30px 40px;">
                            <h1 style="margin: 0; font-size: 30px; font-weight: 800; color: #ffffff; line-height: 1.25; text-align: center; letter-spacing: -0.025em;">
                                ¿Tu despacho enfrenta sobrecarga regulatoria?
                            </h1>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 40px 30px 40px;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #111827 0%, #030712 100%); border: 1px solid #374151; border-radius: 12px; padding: 30px 20px;">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">ARK LEDGER</p>
                                        <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">20 herramientas integradas</p>
                                        <div style="width: 60px; height: 3px; background: linear-gradient(90deg, #3b82f6, #10b981); border-radius: 2px; margin: 0 auto;"></div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 40px 30px 40px;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #111827; border: 1px solid #4b5563; border-radius: 12px;">
                                <tr>
                                    <td style="padding: 20px 24px;">
                                        <a href="https://ledger.arksystems.site" target="_blank" style="text-decoration: none; display: block;">
                                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                                <tr>
                                                    <td>
                                                        <span style="display: block; color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 4px;">Solución: Prueba gratis ARK LEDGER</span>
                                                        <span style="display: block; color: #9ca3af; font-size: 14px; font-weight: 400;">La suite de alta precisión sincronizada al DOF.</span>
                                                    </td>
                                                    <td align="right" style="color: #ffffff; font-size: 22px; font-weight: 600;">&rsaquo;</td>
                                                </tr>
                                            </table>
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 0 40px 30px 40px;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; border: 1px solid #1f2937; border-radius: 10px; padding: 14px 18px;">
                                <tr>
                                    <td style="color: #9ca3af; font-size: 14px;">🔍 ¿Dudas o demo guiada? <a href="mailto:pavel@arksystems.site" style="color: #60a5fa; text-decoration: none; font-weight: 500;">Contáctanos</a></td>
                                    <td align="right" style="color: #6b7280; font-size: 14px;"></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px 40px; border-top: 1px solid #1f2937;">
                            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="padding-top: 25px;">
                                <tr>
                                    <td style="color: #9ca3af; font-size: 13px; padding-bottom: 12px;">🧮 <strong>Alta Precisión</strong> / Sincronización diaria DOF</td>
                                </tr>
                                <tr>
                                    <td style="color: #9ca3af; font-size: 13px;">⚖️ Mérida: <a href="tel:5586765117" style="color: #cbd5e1; text-decoration: none;">+55 8676 5117</a> / CDMX: <a href="tel:525657062511" style="color: #cbd5e1; text-decoration: none;">+52 56 5706 2511</a></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>',
  '[]',
  1
);
