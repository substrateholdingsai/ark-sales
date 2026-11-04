import { Hono } from "hono";
import { Env, LeadIngestPayload } from "../types";
import { ToolExecutor } from "../tools";
import { ensureAccountContactForLead } from "../crm/automation";
import { normalizarTelefonoE164 } from "../voice/telnyx";

export const webhookRouter = new Hono<{ Bindings: Env }>();

webhookRouter.post("/", async (c) => {
  try {
    const validSecrets = [
      c.env.WEBHOOK_SECRET,
      c.env.ARK_WEBHOOK_SECRET,
      c.env.INTERNAL_API_TOKEN,
      c.env.INTERNAL_SERVICE_KEY,
    ].filter((s) => typeof s === "string" && s.trim().length > 0);

    const authHeader = c.req.header("Authorization") || "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    const provided =
      c.req.header("X-Ark-Webhook-Secret") ||
      c.req.header("X-Ark-Internal-Key") ||
      c.req.header("X-Internal-Token") ||
      bearer ||
      "";

    if (validSecrets.length > 0) {
      if (!provided || !validSecrets.includes(provided)) {
        return c.json({ error: "Unauthorized: invalid webhook secret." }, 401);
      }
    } else if ((c.env.ENVIRONMENT || "development") === "production") {
      return c.json({ error: "Unauthorized: webhook secret not configured in production." }, 401);
    }
    const body = await c.req.json();
    const hLead = body.lead || {};
    const ctx = body.account_context || {};
    const email = body.email || hLead.email;
    const despacho_nombre = body.despacho_nombre ?? ctx.despacho_nombre ?? hLead.uboName ?? hLead.fullName;
    const tamano = body.tamano ?? ctx.tamano ?? (hLead.marketValueDollars && hLead.marketValueDollars > 1000000 ? "50+" : "6-20");
    const dolor_principal = body.dolor_principal ?? ctx.dolor_principal ?? (hLead.investorType === "accredited" ? "inversion_patrimonial" : "otro");
    const productos_interes = body.productos_interes ?? ctx.productos_interes ?? (hLead.investorType ? ["lote_residencial_playa", "parque_industrial_progreso"] : undefined);
    const origen = body.origen || (hLead.source ? "hermes_us_proptech" : "web");
    const harvest_source = body.harvest_source || (hLead.source ? "hermes_us_proptech" : "denue");
    const scian_code = body.scian_code || (hLead.investorType ? "531110" : null);
    const sitio_web = body.sitio_web;
    const contact_email = body.contact_email || hLead.email;
    const contact_name = body.contact_name || hLead.fullName || hLead.uboName;
    const rawPhone = body.contact_phone || body.telefono || body.phone || ctx.telefono || hLead.phone || null;
    let normalizedPhone: string | null = null;
    if (rawPhone) {
      const normRes = normalizarTelefonoE164(String(rawPhone));
      normalizedPhone = normRes.valid && normRes.e164 ? normRes.e164 : String(rawPhone).trim();
    }

    if (!email || typeof email !== "string") {
      return c.json({ error: "El campo 'email' es obligatorio." }, 400);
    }

    const leadId = (typeof body.lead_id === "string" && body.lead_id.trim())
      ? body.lead_id.trim()
      : (c.req.header("X-Idempotency-Key")?.trim() || crypto.randomUUID());
    const validTamanos = ["1-5", "6-20", "21-50", "50+"];
    const effectiveTamano = validTamanos.includes(tamano) ? tamano : "1-5";
    const initialScore = typeof body.score === "number" && body.score >= 0 && body.score <= 100
      ? Math.round(body.score)
      : 20;
    const toolExecutor = new ToolExecutor(c.env);

    // 1. Diagnosticar despacho para enrutamiento por dolor
    const diag = toolExecutor.diagnosticarDespacho(
      dolor_principal || "Consulta general de despacho",
      effectiveTamano,
      productos_interes
    );

    // 2. Persistir en sales_leads
    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO sales_leads (id, email, despacho_nombre, tamano, dolor_detectado, especialista_asignado, estado, score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'nuevo', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        leadId,
        email,
        despacho_nombre || null,
        effectiveTamano,
        diag.dolor_detectado,
        diag.especialista_asignado,
        initialScore
      ).run();
      await ensureAccountContactForLead(c.env.DB, { id: leadId, email, despacho_nombre, tamano: effectiveTamano });
      if (normalizedPhone) {
        try {
          await c.env.DB.prepare(`UPDATE sales_leads SET phone = COALESCE(?, phone) WHERE id = ?`)
            .bind(normalizedPhone, leadId).run();
        } catch {}
        try {
          await c.env.DB.prepare(`UPDATE sales_contacts SET phone = COALESCE(?, phone), name = COALESCE(?, name) WHERE account_id = ?`)
            .bind(normalizedPhone, contact_name || "Contacto Corporativo", `acc_${leadId}`).run();
        } catch {}
      }
      try {
        await c.env.DB.prepare(`
          UPDATE sales_accounts
          SET scian_code = COALESCE(?, scian_code),
              harvest_source = COALESCE(?, harvest_source),
              last_enriched_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(scian_code || null, harvest_source || "denue", `acc_${leadId}`).run();
      } catch {}
      if (contact_email) {
        try {
          const existingCt: any = await c.env.DB.prepare("SELECT id FROM sales_contacts WHERE account_id = ? LIMIT 1")
            .bind(`acc_${leadId}`).first();
          if (existingCt) {
            await c.env.DB.prepare(`
              UPDATE sales_contacts
              SET name = COALESCE(name, ?),
                  email = CASE WHEN email LIKE '%@harvest.arksystems.local' THEN ? ELSE email END,
                  phone = COALESCE(phone, ?),
                  title = COALESCE(title, 'Dirección General'),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(contact_name || "Contacto Corporativo", contact_email, normalizedPhone, existingCt.id).run();
          } else {
            await c.env.DB.prepare(`
              INSERT OR IGNORE INTO sales_contacts (id, account_id, name, email, phone, title, consent_status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(`ct_${leadId}`, `acc_${leadId}`, contact_name || "Contacto Corporativo", contact_email, normalizedPhone, "Dirección General").run();
          }
        } catch {}
      }
      if (hLead.source || origen === "hermes_us_proptech") {
        try {
          const signalCode = hLead.investorType === "accredited" ? "SENAL_INVERSION_PATRIMONIAL_US" : "SENAL_NEARSHORING_LOGISTICO_US";
          await c.env.DB.prepare(`
            INSERT OR REPLACE INTO sales_observations (id, account_id, signal_code, observation_value, observed_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            `obs_hermes_${leadId}`,
            `acc_${leadId}`,
            signalCode,
            JSON.stringify({ state: hLead.state, equityDollars: hLead.equityDollars, marketValueDollars: hLead.marketValueDollars })
          ).run();
        } catch {}
      }
    }

    // 3. Inicializar el Durable Object para tener el contexto listo para cuando el usuario chatee
    if (c.env.SALES_AGENT) {
      try {
        const doId = c.env.SALES_AGENT.idFromName(leadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            message: `Lead ingresado desde webhook (${origen || "web"}). Dolor detectado: ${dolor_principal || "general"}.`,
            email,
            despacho_nombre,
            tamano,
          }),
        });
      } catch (err) {
        console.warn("[webhookRouter] No se pudo precalentar DO:", err);
      }
    }

    return c.json({
      success: true,
      lead_id: leadId,
      diagnostico: diag,
      message: "Lead registrado exitosamente y clasificado por dolor operativo.",
    }, 201);
  } catch (err: any) {
    console.error("[webhookRouter] Error en /webhooks/ingest:", err);
    return c.json({ error: err.message || "Error procesando webhook" }, 500);
  }
});
