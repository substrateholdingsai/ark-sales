import { Hono } from "hono";
import { Env, EmailTemplate, EmailDispatch, VoiceCampaign, VoiceCampaignTarget } from "../types";
import { AuthVariables, requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";
import { normalizarTelefonoE164 } from "../voice/telnyx";
import { ConektaService } from "../services/conekta";

export const superadminRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Toda el área Super Admin requiere autenticación y rol de admin
superadminRouter.use("*", requireAuth());
superadminRouter.use("*", requireRole("admin"));

// Helper para interpolación de variables {{variable}}
export function interpolateTemplate(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null ? String(variables[key]) : `{{${key}}}`;
  });
}

// -------------------------------------------------------------
// 1. Resend Status & Test Email
// -------------------------------------------------------------
superadminRouter.get("/resend/status", async (c) => {
  const hasKey = Boolean(c.env.RESEND_API_KEY && c.env.RESEND_API_KEY.trim());
  const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@arksystems.site";
  const maskedKey = hasKey
    ? `${c.env.RESEND_API_KEY!.slice(0, 5)}...${c.env.RESEND_API_KEY!.slice(-4)}`
    : null;

  let totalDispatches = 0;
  let sentCount = 0;
  let failedCount = 0;

  if (c.env.DB) {
    try {
      const stats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status IN ('sent', 'simulated') THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM email_dispatches
      `).first<any>();
      if (stats) {
        totalDispatches = stats.total || 0;
        sentCount = stats.sent || 0;
        failedCount = stats.failed || 0;
      }
    } catch {
      // Si la tabla no ha sido migrada en memoria, manejar con elegancia
    }
  }

  return c.json({
    status: hasKey ? "connected" : "simulated_mode",
    has_api_key: hasKey,
    masked_key: maskedKey,
    from_email: fromEmail,
    stats: {
      total: totalDispatches,
      sent: sentCount,
      failed: failedCount,
    },
  });
});

superadminRouter.post("/resend/test", async (c) => {
  try {
    const body = await c.req.json();
    const toEmail = body.to || c.get("user")?.email || "admin@arksystems.site";
    const subject = body.subject || "Prueba de Conexión Resend · ARK Systems Super Admin";
    const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@arksystems.site";

    if (!c.env.RESEND_API_KEY) {
      // Modo simulado
      const dispatchId = `disp_sim_${crypto.randomUUID().slice(0, 8)}`;
      if (c.env.DB) {
        try {
          await c.env.DB.prepare(`
            INSERT INTO email_dispatches (id, recipient_email, recipient_name, subject, status, resend_id, created_at)
            VALUES (?, ?, ?, ?, 'simulated', ?, CURRENT_TIMESTAMP)
          `).bind(dispatchId, toEmail, "Admin Tester", subject, dispatchId).run();
        } catch {}
      }
      return c.json({
        success: true,
        simulated: true,
        message: `Modo simulado: Correo de prueba registrado para ${toEmail}`,
        dispatch_id: dispatchId,
      });
    }

    const htmlContent = `
      <div style="font-family:sans-serif; background:#020617; color:#f8fafc; padding:32px; border-radius:12px;">
        <h2 style="color:#38bdf8;">ARK Systems · Test Resend Exitoso</h2>
        <p>Este es un correo de prueba enviado desde el <strong>Panel Super Admin</strong> de Ark Sales.</p>
        <p><strong>Remitente:</strong> ${fromEmail}<br><strong>Destinatario:</strong> ${toEmail}</p>
        <p style="color:#94a3b8; font-size:12px;">Timestamp: ${new Date().toISOString()}</p>
      </div>
    `;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html: htmlContent,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return c.json({ success: false, error: "RESEND_API_ERROR", details: errText }, 400);
    }

    const data: any = await resp.json();
    const dispatchId = `disp_${crypto.randomUUID().slice(0, 8)}`;
    if (c.env.DB) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO email_dispatches (id, recipient_email, recipient_name, subject, status, resend_id, created_at)
          VALUES (?, ?, ?, ?, 'sent', ?, CURRENT_TIMESTAMP)
        `).bind(dispatchId, toEmail, "Admin Tester", subject, data.id).run();
      } catch {}
    }

    return c.json({
      success: true,
      simulated: false,
      resend_id: data.id,
      dispatch_id: dispatchId,
      message: `Correo enviado exitosamente a ${toEmail}`,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "TEST_FAILED" }, 500);
  }
});

// -------------------------------------------------------------
// 2. Plantillas HTML (Templates CRUD & Preview & Send)
// -------------------------------------------------------------
superadminRouter.get("/templates", async (c) => {
  const tenantId = c.req.query("tenant_id");
  let query = "SELECT * FROM email_templates WHERE 1=1";
  const params: any[] = [];

  if (tenantId) {
    query += " AND (tenant_id IS NULL OR tenant_id = ?)";
    params.push(tenantId);
  }

  query += " ORDER BY category ASC, created_at DESC";

  let results: any[] = [];
  if (c.env.DB) {
    try {
      const stmt = c.env.DB.prepare(query);
      const res = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      results = res.results || [];
    } catch (e) {
      console.warn("[superadmin:templates] Error reading templates:", e);
    }
  }

  return c.json({ count: results.length, templates: results });
});

superadminRouter.get("/templates/:id", async (c) => {
  const id = c.req.param("id");
  let template: any = null;
  if (c.env.DB) {
    try {
      template = await c.env.DB.prepare("SELECT * FROM email_templates WHERE id = ? OR slug = ?")
        .bind(id, id)
        .first();
    } catch {}
  }
  if (!template) {
    return c.json({ error: "Plantilla no encontrada" }, 404);
  }
  return c.json({ template });
});

superadminRouter.post("/templates", async (c) => {
  try {
    const body = await c.req.json();
    const { name, slug, category, subject, html_content, variables, tenant_id } = body || {};

    if (!name || !slug || !subject || !html_content) {
      return c.json({ error: "name, slug, subject y html_content son campos obligatorios." }, 400);
    }

    const id = `tmpl_${crypto.randomUUID().slice(0, 8)}`;
    const varsJson = JSON.stringify(variables || []);
    const cat = category || "propuesta";

    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO email_templates (id, tenant_id, name, slug, category, subject, html_content, variables_json, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(id, tenant_id || null, name, slug, cat, subject, html_content, varsJson).run();
    }

    return c.json({
      success: true,
      template: { id, tenant_id: tenant_id || null, name, slug, category: cat, subject, html_content, variables_json: varsJson },
    }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error al crear plantilla" }, 400);
  }
});

superadminRouter.put("/templates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { name, subject, html_content, variables, category, is_active } = body || {};

    if (c.env.DB) {
      await c.env.DB.prepare(`
        UPDATE email_templates
        SET 
          name = COALESCE(?, name),
          subject = COALESCE(?, subject),
          html_content = COALESCE(?, html_content),
          variables_json = COALESCE(?, variables_json),
          category = COALESCE(?, category),
          is_active = COALESCE(?, is_active),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? OR slug = ?
      `).bind(
        name ?? null,
        subject ?? null,
        html_content ?? null,
        variables ? JSON.stringify(variables) : null,
        category ?? null,
        is_active ?? null,
        id,
        id
      ).run();
    }

    return c.json({ success: true, message: "Plantilla actualizada correctamente" });
  } catch (err: any) {
    return c.json({ error: err.message || "Error al actualizar plantilla" }, 400);
  }
});

// Previsualización en vivo con variables dinámicas
superadminRouter.post("/templates/:id/preview", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const customVars = body.variables || {};

    let template: any = null;
    if (c.env.DB) {
      template = await c.env.DB.prepare("SELECT * FROM email_templates WHERE id = ? OR slug = ?")
        .bind(id, id)
        .first();
    }

    if (!template) {
      return c.json({ error: "Plantilla no encontrada" }, 404);
    }

    // Variables de ejemplo por defecto para enriquecer el preview si no se especificaron
    const defaultVars: Record<string, string> = {
      despacho_nombre: "Despacho Contable Morales & Asoc.",
      contacto_nombre: "Lic. Carlos Morales",
      precio_mxn: "$8,000 MXN/mes",
      cta_url: "https://sales.arksystems.site/onboarding",
      portal_url: "https://sales.arksystems.site/crm",
      admin_email: "carlos@moralescontadores.com",
      demo_url: "https://hermes.arksystems.site/demo",
      agenda_url: "https://sales.arksystems.site/agenda",
      vigencia_dias: "15",
    };

    const finalVars = { ...defaultVars, ...customVars };
    const renderedHtml = interpolateTemplate(template.html_content, finalVars);
    const renderedSubject = interpolateTemplate(template.subject, finalVars);

    return c.json({
      success: true,
      subject: renderedSubject,
      html: renderedHtml,
      variables_applied: finalVars,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Error generando preview" }, 500);
  }
});

// Enviar plantilla directamente (Disparador de correo)
superadminRouter.post("/templates/:id/send", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { to, recipient_name, variables, tenant_id, account_id, contact_id } = body || {};

    if (!to) {
      return c.json({ error: "El campo 'to' (correo destino) es obligatorio." }, 400);
    }

    let template: any = null;
    if (c.env.DB) {
      template = await c.env.DB.prepare("SELECT * FROM email_templates WHERE id = ? OR slug = ?")
        .bind(id, id)
        .first();
    }

    if (!template) {
      return c.json({ error: "Plantilla no encontrada" }, 404);
    }

    const vars = variables || {};
    const renderedHtml = interpolateTemplate(template.html_content, vars);
    const renderedSubject = interpolateTemplate(template.subject, vars);
    const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@arksystems.site";

    const dispatchId = `disp_${crypto.randomUUID().slice(0, 8)}`;
    let resendId: string | null = null;
    let status: "sent" | "failed" | "simulated" = "simulated";
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
            from: fromEmail,
            to: [to],
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

    // Registrar en email_dispatches
    if (c.env.DB) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO email_dispatches (
            id, tenant_id, account_id, contact_id, template_slug, recipient_email, recipient_name, subject, variables_payload_json, status, resend_id, error_message, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          dispatchId,
          tenant_id || account_id || null,
          account_id || null,
          contact_id || null,
          template.slug,
          to,
          recipient_name || null,
          renderedSubject,
          JSON.stringify(vars),
          status,
          resendId,
          errorMessage
        ).run();

        // Si hay account_id, registrar actividad en CRM
        if (account_id) {
          await c.env.DB.prepare(`
            INSERT INTO sales_activities (id, account_id, contact_id, type, author_user_id, content, metadata_json, created_at)
            VALUES (?, ?, ?, 'email', ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            `act_${crypto.randomUUID().slice(0, 8)}`,
            account_id,
            contact_id || null,
            c.get("user")?.sub || null,
            `Correo enviado: ${renderedSubject} (Plantilla: ${template.slug})`,
            JSON.stringify({ dispatch_id: dispatchId, resend_id: resendId, status })
          ).run();
        }
      } catch (dbErr) {
        console.warn("[superadmin:send] Error guardando bitácora de correo:", dbErr);
      }
    }

    return c.json({
      success: status !== "failed",
      status,
      dispatch_id: dispatchId,
      resend_id: resendId,
      recipient: to,
      subject: renderedSubject,
      error: errorMessage,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Error al despachar correo" }, 500);
  }
});

// Bitácora de correos despachados
superadminRouter.get("/email/dispatches", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  const tenantId = c.req.query("tenant_id");

  let query = "SELECT * FROM email_dispatches WHERE 1=1";
  const params: any[] = [];

  if (tenantId) {
    query += " AND (tenant_id = ? OR account_id = ?)";
    params.push(tenantId, tenantId);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  let dispatches: any[] = [];
  if (c.env.DB) {
    try {
      const res = await c.env.DB.prepare(query).bind(...params).all();
      dispatches = res.results || [];
    } catch {}
  }

  return c.json({ count: dispatches.length, dispatches });
});

// -------------------------------------------------------------
// 3. Campañas de Voz AI Telnyx (Omni-tenant & Batch Launcher)
// -------------------------------------------------------------
superadminRouter.get("/voice/campaigns", async (c) => {
  const tenantId = c.req.query("tenant_id");
  let query = "SELECT * FROM voice_campaigns WHERE 1=1";
  const params: any[] = [];

  if (tenantId) {
    query += " AND (tenant_id IS NULL OR tenant_id = ?)";
    params.push(tenantId);
  }
  query += " ORDER BY created_at DESC";

  let campaigns: any[] = [];
  if (c.env.DB) {
    try {
      const res = await c.env.DB.prepare(query).bind(...params).all();
      campaigns = res.results || [];
    } catch {}
  }
  return c.json({ count: campaigns.length, campaigns });
});

superadminRouter.post("/voice/campaigns", async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, tenant_id, dolor_principal, assistant_id } = body || {};

    if (!name) {
      return c.json({ error: "El campo 'name' es obligatorio para la campaña." }, 400);
    }

    const campaignId = `vcamp_${crypto.randomUUID().slice(0, 8)}`;
    const userId = c.get("user")?.sub || null;

    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO voice_campaigns (id, tenant_id, name, description, dolor_principal, assistant_id, status, created_by_user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        campaignId,
        tenant_id || null,
        name,
        description || null,
        dolor_principal || "sat_fiscal_calculo",
        assistant_id || c.env.TELNYX_AI_ASSISTANT_ID || null,
        userId
      ).run();
    }

    return c.json({
      success: true,
      campaign: {
        id: campaignId,
        tenant_id: tenant_id || null,
        name,
        description,
        dolor_principal: dolor_principal || "sat_fiscal_calculo",
        status: "draft",
      },
    }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error creando campaña de voz" }, 400);
  }
});

superadminRouter.get("/voice/campaigns/:id", async (c) => {
  const id = c.req.param("id");
  let campaign: any = null;
  let targets: any[] = [];

  if (c.env.DB) {
    try {
      campaign = await c.env.DB.prepare("SELECT * FROM voice_campaigns WHERE id = ?").bind(id).first();
      if (campaign) {
        const res = await c.env.DB.prepare("SELECT * FROM voice_campaign_targets WHERE campaign_id = ? ORDER BY created_at DESC").bind(id).all();
        targets = res.results || [];
      }
    } catch {}
  }

  if (!campaign) {
    return c.json({ error: "Campaña no encontrada" }, 404);
  }

  return c.json({ campaign, targets_count: targets.length, targets });
});

// Agregar destinatarios a la campaña (manual o auto-poblado desde CRM)
superadminRouter.post("/voice/campaigns/:id/targets", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { targets, auto_populate_tenant_id } = body || {};

    let addedCount = 0;

    if (auto_populate_tenant_id && c.env.DB) {
      // Auto-popular desde contactos y leads con teléfono
      let query = `
        SELECT c.id as contact_id, c.account_id, c.name, c.phone, a.name as despacho_nombre
        FROM sales_contacts c
        JOIN sales_accounts a ON a.id = c.account_id
        WHERE c.phone IS NOT NULL AND c.phone != ''
      `;
      const params: any[] = [];
      if (auto_populate_tenant_id !== "all") {
        query += " AND c.account_id = ?";
        params.push(auto_populate_tenant_id);
      }

      const { results } = await c.env.DB.prepare(query).bind(...params).all<any>();
      if (results && results.length > 0) {
        for (const r of results) {
          const norm = normalizarTelefonoE164(r.phone);
          if (norm.valid && norm.e164) {
            const targetId = `vtar_${crypto.randomUUID().slice(0, 8)}`;
            try {
              await c.env.DB.prepare(`
                INSERT INTO voice_campaign_targets (id, campaign_id, tenant_id, account_id, contact_id, despacho_nombre, to_phone, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(targetId, id, r.account_id, r.account_id, r.contact_id, r.despacho_nombre || r.name, norm.e164).run();
              addedCount++;
            } catch {}
          }
        }
      }
    } else if (Array.isArray(targets)) {
      for (const t of targets) {
        if (!t.to_phone && !t.phone) continue;
        const norm = normalizarTelefonoE164(t.to_phone || t.phone);
        if (norm.valid && norm.e164) {
          const targetId = `vtar_${crypto.randomUUID().slice(0, 8)}`;
          if (c.env.DB) {
            try {
              await c.env.DB.prepare(`
                INSERT INTO voice_campaign_targets (id, campaign_id, tenant_id, account_id, contact_id, lead_id, despacho_nombre, to_phone, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `).bind(
                targetId,
                id,
                t.tenant_id || t.account_id || null,
                t.account_id || null,
                t.contact_id || null,
                t.lead_id || null,
                t.despacho_nombre || "Despacho Prospecto",
                norm.e164
              ).run();
              addedCount++;
            } catch {}
          }
        }
      }
    }

    if (c.env.DB) {
      await c.env.DB.prepare(`
        UPDATE voice_campaigns 
        SET total_targets = (SELECT COUNT(*) FROM voice_campaign_targets WHERE campaign_id = ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(id, id).run();
    }

    return c.json({ success: true, targets_added: addedCount });
  } catch (err: any) {
    return c.json({ error: err.message || "Error agregando targets" }, 400);
  }
});

// DISPARAR LA CAMPAÑA DE VOZ AI
superadminRouter.post("/voice/campaigns/:id/dispatch", async (c) => {
  try {
    const id = c.req.param("id");
    let campaign: any = null;
    let targets: any[] = [];

    if (c.env.DB) {
      campaign = await c.env.DB.prepare("SELECT * FROM voice_campaigns WHERE id = ?").bind(id).first();
      if (campaign) {
        const res = await c.env.DB.prepare(`
          SELECT * FROM voice_campaign_targets 
          WHERE campaign_id = ? AND status IN ('pending', 'failed')
          LIMIT 50
        `).bind(id).all();
        targets = res.results || [];
      }
    }

    if (!campaign) {
      return c.json({ error: "Campaña no encontrada" }, 404);
    }

    if (targets.length === 0) {
      return c.json({ success: true, message: "No hay targets pendientes en esta campaña." });
    }

    // Marcar campaña como running
    if (c.env.DB) {
      await c.env.DB.prepare("UPDATE voice_campaigns SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
    }

    const fromNumber = c.env.TELNYX_PHONE_NUMBER || "+525500000000";
    let completedCount = 0;
    let failedCount = 0;
    const executionLogs: any[] = [];

    for (const target of targets) {
      let callControlId: string | null = null;
      let status: "initiated" | "failed" = "initiated";
      let errorMsg: string | null = null;

      if (!c.env.TELNYX_API_KEY) {
        // Modo simulado
        callControlId = `sim_call_${crypto.randomUUID().slice(0, 8)}`;
        status = "initiated";
        completedCount++;
      } else {
        try {
          const payload: any = {
            to: target.to_phone,
            from: fromNumber,
            dynamic_variables: {
              lead_id: target.lead_id || target.id,
              despacho_nombre: target.despacho_nombre || "Despacho Colega",
              dolor_principal: campaign.dolor_principal || "sat_fiscal_calculo",
            },
            metadata: {
              campaign_id: id,
              target_id: target.id,
              tenant_id: target.tenant_id || target.account_id || null,
              source: "ark-sales-superadmin-campaign",
            },
          };

          if (campaign.assistant_id || c.env.TELNYX_AI_ASSISTANT_ID) {
            payload.assistant_id = campaign.assistant_id || c.env.TELNYX_AI_ASSISTANT_ID;
          }
          if (c.env.TELNYX_CONNECTION_ID) {
            payload.connection_id = c.env.TELNYX_CONNECTION_ID;
          }

          const resp = await fetch("https://api.telnyx.com/v2/ai/conversations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (resp.ok) {
            const data: any = await resp.json();
            callControlId = data?.call_control_id || data?.id || `telnyx_${crypto.randomUUID().slice(0, 8)}`;
            status = "initiated";
            completedCount++;
          } else {
            status = "failed";
            errorMsg = await resp.text();
            failedCount++;
          }
        } catch (callErr: any) {
          status = "failed";
          errorMsg = callErr?.message || "TELNYX_DISPATCH_EXCEPTION";
          failedCount++;
        }
      }

      if (c.env.DB) {
        try {
          await c.env.DB.prepare(`
            UPDATE voice_campaign_targets 
            SET status = ?, call_control_id = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(status, callControlId, errorMsg, target.id).run();
        } catch {}
      }

      executionLogs.push({
        target_id: target.id,
        phone: target.to_phone,
        despacho: target.despacho_nombre,
        status,
        call_control_id: callControlId,
        error: errorMsg,
      });
    }

    // Actualizar progreso final en campaña
    if (c.env.DB) {
      await c.env.DB.prepare(`
        UPDATE voice_campaigns 
        SET completed_calls = completed_calls + ?,
            failed_calls = failed_calls + ?,
            status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(completedCount, failedCount, id).run();
    }

    return c.json({
      success: true,
      campaign_id: id,
      total_dispatched: targets.length,
      initiated: completedCount,
      failed: failedCount,
      execution_logs: executionLogs,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Error despachando campaña" }, 500);
  }
});

// Consultar todas las sesiones de voz en vivo (grabaciones y transcripciones)
superadminRouter.get("/voice/sessions", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  let sessions: any[] = [];
  if (c.env.DB) {
    try {
      const res = await c.env.DB.prepare(`
        SELECT * FROM sales_voice_sessions 
        ORDER BY created_at DESC 
        LIMIT ?
      `).bind(limit).all();
      sessions = res.results || [];
    } catch {}
  }
  return c.json({ count: sessions.length, sessions });
});

// -------------------------------------------------------------
// 4. Visión Multi-Tenant Consolidada
// -------------------------------------------------------------
superadminRouter.get("/tenants/overview", async (c) => {
  let accounts: any[] = [];
  if (c.env.DB) {
    try {
      const res = await c.env.DB.prepare(`
        SELECT 
          a.id, a.name, a.size, a.city, a.origin, a.created_at,
          COUNT(DISTINCT c.id) as total_contacts,
          COUNT(DISTINCT o.id) as total_opportunities,
          COUNT(DISTINCT d.id) as total_emails_sent,
          COUNT(DISTINCT v.id) as total_voice_sessions
        FROM sales_accounts a
        LEFT JOIN sales_contacts c ON c.account_id = a.id
        LEFT JOIN sales_opportunities o ON o.account_id = a.id
        LEFT JOIN email_dispatches d ON (d.account_id = a.id OR d.tenant_id = a.id)
        LEFT JOIN sales_voice_sessions v ON (v.account_id = a.id)
        GROUP BY a.id
        ORDER BY a.name ASC
      `).all();
      accounts = res.results || [];
    } catch (e) {
      console.warn("[superadmin:tenants] Error aggregating tenants:", e);
    }
  }

  return c.json({
    count: accounts.length,
    tenants: accounts,
  });
});

// -------------------------------------------------------------
// 5. Cobranza Conekta (SPEI STP & Hosted Checkout)
// -------------------------------------------------------------

// Estado de Conekta y resumen de cobranza
superadminRouter.get("/billing/status", async (c) => {
  const hasKey = Boolean(c.env.CONEKTA_API_KEY && c.env.CONEKTA_API_KEY.trim());
  const maskedKey = hasKey
    ? `${c.env.CONEKTA_API_KEY!.slice(0, 6)}...${c.env.CONEKTA_API_KEY!.slice(-4)}`
    : null;

  let totalOrders = 0;
  let paidOrders = 0;
  let pendingOrders = 0;
  let totalRevenueMxn = 0;

  if (c.env.DB) {
    try {
      const stats = await c.env.DB.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END) as revenue_cents
        FROM sales_payment_orders
      `).first<any>();
      if (stats) {
        totalOrders = stats.total || 0;
        paidOrders = stats.paid || 0;
        pendingOrders = stats.pending || 0;
        totalRevenueMxn = (stats.revenue_cents || 0) / 100;
      }
    } catch {}
  }

  return c.json({
    status: hasKey ? "connected" : "simulated_mode",
    has_api_key: hasKey,
    masked_key: maskedKey,
    stats: {
      total_orders: totalOrders,
      paid_orders: paidOrders,
      pending_orders: pendingOrders,
      total_revenue_mxn: totalRevenueMxn,
    },
  });
});

// Listar órdenes de pago
superadminRouter.get("/billing/orders", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
  let orders: any[] = [];
  if (c.env.DB) {
    try {
      const res = await c.env.DB.prepare(`
        SELECT 
          p.*,
          a.name as account_name,
          l.email as lead_email,
          l.despacho_nombre as lead_despacho
        FROM sales_payment_orders p
        LEFT JOIN sales_accounts a ON a.id = p.account_id
        LEFT JOIN sales_leads l ON l.id = p.lead_id
        ORDER BY p.created_at DESC 
        LIMIT ?
      `).bind(limit).all();
      orders = res.results || [];
    } catch (e) {
      console.warn("[superadmin:billing] Error querying orders:", e);
    }
  }
  return c.json({ count: orders.length, orders });
});

// Emitir nueva orden de pago (SPEI / Checkout)
superadminRouter.post("/billing/create-order", async (c) => {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const {
    account_id,
    lead_id,
    opportunity_id,
    contact_id,
    customer_name,
    customer_email,
    customer_phone,
    amount_mxn,
    product_name,
    method,
  } = body;

  if (!customer_email) {
    return c.json({ error: "El correo del cliente/despacho es obligatorio." }, 400);
  }
  if (!amount_mxn || amount_mxn <= 0) {
    return c.json({ error: "El monto en MXN debe ser mayor a 0." }, 400);
  }

  const conekta = new ConektaService(c.env);
  const result = await conekta.createPaymentOrder({
    accountId: account_id || undefined,
    leadId: lead_id || undefined,
    opportunityId: opportunity_id || undefined,
    contactId: contact_id || undefined,
    customerName: customer_name || "Despacho Contable",
    customerEmail: customer_email,
    customerPhone: customer_phone || undefined,
    amountCents: Math.round(amount_mxn * 100),
    productName: product_name || "Servicio ARK Systems",
    method: method === "checkout" ? "checkout" : "spei",
  });

  if (c.env.DB && user) {
    await new AuditService(c.env.DB).record({
      actor_user_id: user.sub,
      action: "billing_order_created",
      entity_type: "sales_payment_orders",
      entity_id: result.orderId,
      metadata: { method, amount_mxn, customer_email, order_id: result.orderId },
      ip: clientIp(c),
    });
  }

  return c.json(result);
});

// Simular pago completado (order.paid) para pruebas / desarrollo
superadminRouter.post("/billing/simulate-paid", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { conekta_order_id } = body;
  if (!conekta_order_id) {
    return c.json({ error: "conekta_order_id es requerido." }, 400);
  }

  const conekta = new ConektaService(c.env);
  const webhookResult = await conekta.processWebhookEvent({
    type: "order.paid",
    data: {
      object: {
        id: conekta_order_id,
        payment_status: "paid",
        created_at: Math.floor(Date.now() / 1000),
      },
    },
  });

  return c.json({
    success: webhookResult.success,
    message: webhookResult.success
      ? `Orden ${conekta_order_id} marcada como PAGADA. Oportunidad avanzada a ganado.`
      : webhookResult.error,
    details: webhookResult,
  });
});

export default superadminRouter;
