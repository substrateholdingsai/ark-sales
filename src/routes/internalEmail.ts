import { Hono } from "hono";
import { Env } from "../types";
import { InternalVariables } from "./internal";
import { interpolateTemplate, syncEmailDispatchToPipeline } from "./superadmin";
import { PreSendGate } from "../services/gate";

export const internalEmailRouter = new Hono<{ Bindings: Env; Variables: InternalVariables }>();

const DEFAULT_ALLOWED_TEST_RECIPIENTS = [
  "pablo@arksystems.site",
  "admin@arksystems.site",
  "ventas@arksystems.site",
  "ventas@mail.arksystems.site",
];

// Helper para obtener lista de correos de prueba permitidos
function getAllowedTestRecipients(env: Env): Set<string> {
  const allowed = new Set(DEFAULT_ALLOWED_TEST_RECIPIENTS.map((e) => e.toLowerCase()));
  if (env.TEST_RECIPIENT_EMAIL && env.TEST_RECIPIENT_EMAIL.trim()) {
    allowed.add(env.TEST_RECIPIENT_EMAIL.toLowerCase().trim());
  }
  return allowed;
}

// -----------------------------------------------------------------------------
// 1. GET /api/internal/email/templates
// Lista las plantillas activas: id, nombre, slug, variables_requeridas, descripcion
// -----------------------------------------------------------------------------
internalEmailRouter.get("/templates", async (c) => {
  if (!c.env.DB) {
    return c.json({ count: 0, templates: [] });
  }

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT id, name, slug, category, subject, variables_json, is_active 
       FROM email_templates 
       WHERE is_active = 1 
       ORDER BY category ASC, id ASC 
       LIMIT 100`
    ).all();

    const templates = (results || []).map((t: any) => {
      let vars: string[] = [];
      try {
        vars = typeof t.variables_json === "string" ? JSON.parse(t.variables_json) : (t.variables_json || []);
      } catch {
        vars = [];
      }
      return {
        id: t.id,
        nombre: t.name,
        slug: t.slug,
        category: t.category,
        subject: t.subject,
        variables_requeridas: vars,
        descripcion: `Plantilla categoría ${t.category}: ${t.name}`,
      };
    });

    return c.json({ count: templates.length, templates });
  } catch (err: any) {
    return c.json({ error: "DATABASE_ERROR", message: err.message }, 500);
  }
});

// -----------------------------------------------------------------------------
// 2. GET/POST /api/internal/email/templates/:id/preview
// Vista previa HTML con variables inyectadas, sin enviar nada.
// -----------------------------------------------------------------------------
async function handlePreview(c: any) {
  const id = c.req.param("id");
  if (!c.env.DB) {
    return c.json({ error: "Base de datos no disponible" }, 503);
  }

  const template: any = await c.env.DB.prepare(
    "SELECT * FROM email_templates WHERE (id = ? OR slug = ?) AND is_active = 1 LIMIT 1"
  ).bind(id, id).first();

  if (!template) {
    return c.json({ error: `Plantilla '${id}' no encontrada o inactiva.` }, 404);
  }

  let vars: Record<string, any> = {};
  if (c.req.method.toUpperCase() === "POST") {
    try {
      const body = await c.req.json();
      vars = body.variables || body || {};
    } catch {}
  } else {
    vars = { ...c.req.query() };
  }

  const leadId = vars.lead_id || c.req.query("lead_id");
  if (leadId) {
    try {
      const lead: any = await c.env.DB.prepare(
        "SELECT id, email, despacho_nombre FROM sales_leads WHERE id = ? LIMIT 1"
      ).bind(leadId).first();
      if (lead) {
        if (!vars.despacho_nombre) vars.despacho_nombre = lead.despacho_nombre || "Empresa";
        if (!vars.email) vars.email = lead.email;
      }
    } catch {}
  }

  const rawSubject = interpolateTemplate(template.subject, vars);
  const rawHtml = interpolateTemplate(template.html_content, vars);
  const gate = PreSendGate.check(rawSubject, rawHtml);

  return c.json({
    success: true,
    template_id: template.id,
    slug: template.slug,
    subject: gate.sanitizedSubject || rawSubject,
    html: gate.sanitizedBody || rawHtml,
    variables_used: vars,
    gate_ok: gate.ok,
    gate_reasons: gate.reasons || [],
  });
}

internalEmailRouter.get("/templates/:id/preview", handlePreview);
internalEmailRouter.post("/templates/:id/preview", handlePreview);

// -----------------------------------------------------------------------------
// 3. GET /api/internal/email/status
// Estado de Resend: conectado sí/no, remitente y conteos con límites
// -----------------------------------------------------------------------------
internalEmailRouter.get("/status", async (c) => {
  const hasKey = Boolean(c.env.RESEND_API_KEY && c.env.RESEND_API_KEY.trim());
  const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@mail.arksystems.site";
  let dailySendsCount = 0;
  let hourlySendsCount = 0;

  if (c.env.DB) {
    try {
      const daily = await c.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM email_dispatches WHERE created_at >= datetime('now', '-24 hours')"
      ).first<{ cnt: number }>();
      dailySendsCount = daily?.cnt || 0;

      const hourly = await c.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM email_dispatches WHERE created_at >= datetime('now', '-1 hour')"
      ).first<{ cnt: number }>();
      hourlySendsCount = hourly?.cnt || 0;
    } catch (e) {
      console.warn("[internal:email:status] Error counting dispatches:", e);
    }
  }

  return c.json({
    status: hasKey ? "connected" : "simulated_mode",
    connected: hasKey,
    has_api_key: hasKey,
    from_email: fromEmail,
    daily_sends_count: dailySendsCount,
    hourly_sends_count: hourlySendsCount,
    limits: {
      hourly: 20,
      daily: 100,
    },
  });
});

// -----------------------------------------------------------------------------
// 4. POST /api/internal/email/test
// Envío de prueba SOLO a destinatario autorizado (Pablo / Admin)
// -----------------------------------------------------------------------------
internalEmailRouter.post("/test", async (c) => {
  try {
    const body = await c.req.json();
    const to = (body?.to || "").toLowerCase().trim();

    const allowed = getAllowedTestRecipients(c.env);
    if (!to || !allowed.has(to)) {
      return c.json({
        error: "Forbidden: Destinatario no autorizado para pruebas. Solo se permite enviar pruebas a correos autorizados.",
        allowed_recipients: Array.from(allowed),
      }, 403);
    }

    const subject = body.subject || "Prueba Interna de Conexión Resend - Ark Sales (StayPuft)";
    const htmlContent = body.html_content || `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Prueba Exitosa de Conexión con Resend</h2>
        <p>Este es un correo de prueba generado por el operador StayPuft.</p>
        <p><strong>Remitente configurado:</strong> ${c.env.RESEND_FROM_EMAIL || "ventas@mail.arksystems.site"}</p>
        <p><strong>Destinatario autorizado:</strong> ${to}</p>
        <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
      </div>
    `;

    const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@mail.arksystems.site";
    const dispatchId = `disp_${crypto.randomUUID().slice(0, 8)}`;
    let resendId: string | null = null;
    let status: "sent" | "simulated" = "simulated";

    if (c.env.RESEND_API_KEY) {
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail.includes("<") ? fromEmail : `ARK Systems <${fromEmail}>`,
          to: [to],
          subject,
          html: htmlContent,
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        return c.json({ success: false, error: "RESEND_API_ERROR", details: errText }, 400);
      }

      const resData: any = await resp.json();
      resendId = resData.id;
      status = "sent";
    } else {
      resendId = `sim_${dispatchId}`;
      status = "simulated";
    }

    if (c.env.DB) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO email_dispatches (id, recipient_email, recipient_name, subject, variables_payload_json, status, resend_id, created_at)
          VALUES (?, ?, 'Admin Tester', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(dispatchId, to, subject, JSON.stringify({ _operator: "staypuft", test_mode: true }), status, resendId).run();
      } catch (dbErr) {
        console.warn("[internal:email:test] Error saving dispatch record:", dbErr);
      }
    }

    return c.json({
      success: true,
      simulated: status === "simulated",
      resend_id: resendId,
      dispatch_id: dispatchId,
      recipient: to,
      message: `Correo de prueba enviado exitosamente a ${to}`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "TEST_FAILED" }, 500);
  }
});

// -----------------------------------------------------------------------------
// 5. POST /api/internal/email/send
// Envío real a un lead con validación fail-closed
// Body: { lead_id, template_id, variables, dry_run }
// -----------------------------------------------------------------------------
internalEmailRouter.post("/send", async (c) => {
  try {
    const body = await c.req.json();
    const { lead_id, template_id, variables, dry_run } = body || {};

    if (!lead_id || typeof lead_id !== "string" || !lead_id.trim()) {
      return c.json({ error: "El campo 'lead_id' es obligatorio y debe ser un texto." }, 400);
    }
    if (!template_id || typeof template_id !== "string" || !template_id.trim()) {
      return c.json({ error: "El campo 'template_id' es obligatorio y debe ser un texto." }, 400);
    }

    if (!c.env.DB) {
      return c.json({ error: "Base de datos D1 no disponible." }, 503);
    }

    // 1. Validar existencia del lead en D1
    let lead: any = await c.env.DB.prepare(
      "SELECT id, email, despacho_nombre FROM sales_leads WHERE id = ? LIMIT 1"
    ).bind(lead_id).first();

    if (!lead) {
      // Fallback: verificar en sales_accounts y sales_contacts
      const acc: any = await c.env.DB.prepare(
        "SELECT id, name as despacho_nombre FROM sales_accounts WHERE id = ? LIMIT 1"
      ).bind(lead_id).first();
      if (acc) {
        const contact: any = await c.env.DB.prepare(
          "SELECT id, email, name FROM sales_contacts WHERE account_id = ? AND email IS NOT NULL LIMIT 1"
        ).bind(acc.id).first();
        if (contact && contact.email) {
          lead = {
            id: acc.id,
            email: contact.email,
            despacho_nombre: acc.despacho_nombre,
            contacto_nombre: contact.name,
          };
        }
      }
    }

    if (!lead) {
      return c.json({ error: `Lead con ID '${lead_id}' no encontrado en D1.` }, 404);
    }
    if (!lead.email || !lead.email.trim()) {
      return c.json({ error: `El lead '${lead_id}' no tiene un correo electrónico registrado.` }, 400);
    }

    const leadEmail = lead.email.toLowerCase().trim();

    // 2. Prohibido enviar a correo arbitrario si se especifica en body
    if (body.to) {
      const providedTo = String(body.to).toLowerCase().trim();
      if (providedTo !== leadEmail) {
        return c.json({
          error: `Prohibido enviar a un correo arbitrario. El correo de destino debe ser el registrado para el lead (${leadEmail}).`,
          registered_email: leadEmail,
          provided_email: providedTo,
        }, 400);
      }
    }

    // 3. Validar existencia y estado de la plantilla
    const template: any = await c.env.DB.prepare(
      "SELECT * FROM email_templates WHERE (id = ? OR slug = ?) AND is_active = 1 LIMIT 1"
    ).bind(template_id, template_id).first();

    if (!template) {
      return c.json({ error: `Plantilla '${template_id}' no existe o no está activa.` }, 404);
    }

    // 4. Validar variables requeridas por la plantilla
    let requiredVars: string[] = [];
    try {
      requiredVars = typeof template.variables_json === "string"
        ? JSON.parse(template.variables_json)
        : (template.variables_json || []);
    } catch {
      requiredVars = [];
    }

    const vars: Record<string, any> = { ...(variables || {}) };
    if (!vars.despacho_nombre && lead.despacho_nombre) {
      vars.despacho_nombre = lead.despacho_nombre;
    }

    const missingVars: string[] = [];
    for (const reqVar of requiredVars) {
      if (vars[reqVar] === undefined || vars[reqVar] === null || String(vars[reqVar]).trim() === "") {
        missingVars.push(reqVar);
      }
    }

    if (missingVars.length > 0) {
      return c.json({
        error: `Falta una o más variables requeridas por la plantilla: ${missingVars.join(", ")}`,
        required_variables: requiredVars,
        missing_variables: missingVars,
      }, 400);
    }

    // 5. Deduplicación (24 horas)
    const prevDispatch: any = await c.env.DB.prepare(`
      SELECT id, recipient_email, template_slug, status, resend_id, created_at
      FROM email_dispatches
      WHERE (recipient_email = ? OR account_id = ?)
        AND template_slug = ?
        AND status IN ('sent', 'simulated')
        AND created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(leadEmail, lead.id, template.slug).first();

    if (prevDispatch) {
      return c.json({
        success: true,
        deduplicated: true,
        message: `La plantilla '${template.slug}' ya fue enviada a este lead en las últimas 24 horas. Evitando duplicado.`,
        previous_dispatch: prevDispatch,
      }, 200);
    }

    // 6. Rate limits para StayPuft (máximo 20/hora y 100/día)
    const hourlyRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM email_dispatches WHERE created_at >= datetime('now', '-1 hour')"
    ).first<{ cnt: number }>();
    if ((hourlyRow?.cnt || 0) >= 20) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO sales_activities (id, account_id, contact_id, type, author_user_id, content, metadata_json, created_at)
          VALUES (?, ?, NULL, 'email', ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          `act_${crypto.randomUUID().slice(0, 8)}`,
          lead.id,
          "staypuft",
          "Intento de envío bloqueado por superar límite de 20 correos/hora para StayPuft",
          JSON.stringify({ lead_id: lead.id, template_id: template.id, reason: "HOURLY_LIMIT_EXCEEDED" })
        ).run();
      } catch {}

      return c.json({
        error: "Too Many Requests: Límite horario de StayPuft excedido (máximo 20 envíos por hora).",
        limit: 20,
        current_hourly_count: hourlyRow?.cnt || 0,
      }, 429);
    }

    const dailyRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM email_dispatches WHERE created_at >= datetime('now', '-24 hours')"
    ).first<{ cnt: number }>();
    if ((dailyRow?.cnt || 0) >= 100) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO sales_activities (id, account_id, contact_id, type, author_user_id, content, metadata_json, created_at)
          VALUES (?, ?, NULL, 'email', ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          `act_${crypto.randomUUID().slice(0, 8)}`,
          lead.id,
          "staypuft",
          "Intento de envío bloqueado por superar límite de 100 correos/día para StayPuft",
          JSON.stringify({ lead_id: lead.id, template_id: template.id, reason: "DAILY_LIMIT_EXCEEDED" })
        ).run();
      } catch {}

      return c.json({
        error: "Too Many Requests: Límite diario de StayPuft excedido (máximo 100 envíos por día).",
        limit: 100,
        current_daily_count: dailyRow?.cnt || 0,
      }, 429);
    }

    // 7. Interpolar y someter a PreSendGate
    const rawRenderedSubject = interpolateTemplate(template.subject, vars);
    const rawRenderedHtml = interpolateTemplate(template.html_content, vars);

    const gate = PreSendGate.check(rawRenderedSubject, rawRenderedHtml);
    if (!gate.ok) {
      return c.json({
        error: "PRE_SEND_GATE_VIOLATION",
        reasons: gate.reasons,
        details: "El correo fue bloqueado por el Guardián Pre-Envío por violar directrices de calidad o variables sin resolver.",
      }, 422);
    }

    const renderedSubject = gate.sanitizedSubject || rawRenderedSubject;
    const renderedHtml = gate.sanitizedBody || rawRenderedHtml;

    // 8. Modo dry_run (Validación estricta sin despacho a Resend ni registro)
    const isDryRun = dry_run !== false; // Si dry_run es true o no se envía false explícito
    if (isDryRun) {
      return c.json({
        success: true,
        dry_run: true,
        message: "Validación exitosa (dry_run). No se llamó a Resend ni se registró envío en bitácora.",
        lead_id: lead.id,
        recipient: leadEmail,
        template_id: template.id,
        template_slug: template.slug,
        subject: renderedSubject,
        html: renderedHtml,
        variables_used: vars,
      });
    }

    // 9. Envío Real (dry_run: false)
    const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@mail.arksystems.site";
    const dispatchId = `disp_${crypto.randomUUID().slice(0, 8)}`;
    let resendId: string | null = null;
    let status: "sent" | "simulated" | "failed" = "simulated";
    let errorMessage: string | null = null;

    if (c.env.RESEND_API_KEY) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail.includes("<") ? fromEmail : `ARK Systems <${fromEmail}>`,
            to: [leadEmail],
            subject: renderedSubject,
            html: renderedHtml,
          }),
        });

        if (resp.ok) {
          const resData: any = await resp.json();
          resendId = resData.id;
          status = "sent";
        } else {
          status = "failed";
          errorMessage = await resp.text();
        }
      } catch (e: any) {
        status = "failed";
        errorMessage = e?.message || "RESEND_NETWORK_ERROR";
      }
    } else {
      resendId = `sim_${dispatchId}`;
      status = "simulated";
    }

    // 10. Registrar en email_dispatches
    const variablesPayload = {
      ...vars,
      _operator: "staypuft",
      _lead_id: lead.id,
      _template_id: template.id,
    };

    await c.env.DB.prepare(`
      INSERT INTO email_dispatches (
        id, tenant_id, account_id, contact_id, template_slug, recipient_email, recipient_name, subject, variables_payload_json, status, resend_id, error_message, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      dispatchId,
      lead.id,
      lead.id,
      template.slug,
      leadEmail,
      lead.despacho_nombre || "Titular",
      renderedSubject,
      JSON.stringify(variablesPayload),
      status,
      resendId,
      errorMessage
    ).run();

    // 11. Registrar en sales_activities con autor staypuft
    try {
      await c.env.DB.prepare(`
        INSERT INTO sales_activities (id, account_id, contact_id, type, author_user_id, content, metadata_json, created_at)
        VALUES (?, ?, NULL, 'email', ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        `act_${crypto.randomUUID().slice(0, 8)}`,
        lead.id,
        "staypuft",
        `Correo enviado por StayPuft: ${renderedSubject} (Plantilla: ${template.slug})`,
        JSON.stringify({
          dispatch_id: dispatchId,
          resend_id: resendId,
          status,
          operator: "staypuft",
          template_id: template.id,
          lead_id: lead.id,
          variables: vars,
        })
      ).run();
    } catch (actErr) {
      console.warn("[internal:email:send] Error recording activity:", actErr);
    }

    // 12. Sincronizar pipeline (oportunidad en propuesta_enviada)
    if (status === "sent" || status === "simulated") {
      await syncEmailDispatchToPipeline(c.env.DB, {
        accountId: lead.id,
        email: leadEmail,
        subject: renderedSubject,
        templateSlug: template.slug,
        dispatchId,
        resendId,
        userId: "staypuft",
        status,
      });
    }

    return c.json({
      success: status !== "failed",
      dry_run: false,
      dispatch_id: dispatchId,
      resend_id: resendId,
      status,
      recipient: leadEmail,
      subject: renderedSubject,
      error: errorMessage,
    }, status === "failed" ? 502 : 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error procesando envío de correo" }, 500);
  }
});

// -----------------------------------------------------------------------------
// 6. GET /api/internal/email/history?lead_id=...
// Historial de envíos de ese lead desde email_dispatches, tope 100
// -----------------------------------------------------------------------------
internalEmailRouter.get("/history", async (c) => {
  const leadId = c.req.query("lead_id");
  if (!leadId) {
    return c.json({ error: "El parámetro query 'lead_id' es obligatorio." }, 400);
  }

  const limitParam = parseInt(c.req.query("limit") || "50", 10);
  const limit = Math.min(Math.max(isNaN(limitParam) ? 50 : limitParam, 1), 100);

  if (!c.env.DB) {
    return c.json({ lead_id: leadId, count: 0, limit, dispatches: [] });
  }

  let leadEmail = "";
  try {
    const lead: any = await c.env.DB.prepare(
      "SELECT email FROM sales_leads WHERE id = ? LIMIT 1"
    ).bind(leadId).first();
    if (lead?.email) {
      leadEmail = lead.email;
    }
  } catch {}

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, tenant_id, account_id, contact_id, template_slug, recipient_email, recipient_name, subject, variables_payload_json, status, resend_id, error_message, created_at
      FROM email_dispatches
      WHERE account_id = ? OR recipient_email = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(leadId, leadEmail || leadId, limit).all();

    const dispatches = results || [];
    return c.json({
      lead_id: leadId,
      count: dispatches.length,
      limit,
      dispatches,
    });
  } catch (err: any) {
    return c.json({ error: "DATABASE_ERROR", message: err.message }, 500);
  }
});
