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

    let leadId = (typeof body.lead_id === "string" && body.lead_id.trim())
      ? body.lead_id.trim()
      : (c.req.header("X-Idempotency-Key")?.trim() || null);
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

    let finalLeadId = leadId;
    let targetAccountId = `acc_${leadId || crypto.randomUUID()}`;
    let targetContactId = `ct_${leadId || crypto.randomUUID()}`;

    // 2. Persistir en sales_leads con deduplicación inteligente
    if (c.env.DB) {
      let existingLead: any = null;
      if (leadId) {
        existingLead = await c.env.DB.prepare("SELECT id, account_id, contact_id, score, phone FROM sales_leads WHERE id = ? LIMIT 1")
          .bind(leadId).first();
      }
      if (!existingLead && email) {
        existingLead = await c.env.DB.prepare("SELECT id, account_id, contact_id, score, phone FROM sales_leads WHERE LOWER(email) = LOWER(?) ORDER BY score DESC, created_at ASC LIMIT 1")
          .bind(email).first();
      }

      if (existingLead) {
        finalLeadId = existingLead.id;
        targetAccountId = existingLead.account_id || `acc_${finalLeadId}`;
        targetContactId = existingLead.contact_id || `ct_${finalLeadId}`;
        const finalScore = Math.max(existingLead.score, initialScore);
        const finalPhone = normalizedPhone || existingLead.phone || null;

        await c.env.DB.prepare(`
          UPDATE sales_leads
          SET despacho_nombre = COALESCE(?, despacho_nombre),
              tamano = COALESCE(?, tamano),
              score = ?,
              phone = COALESCE(?, phone),
              dolor_detectado = COALESCE(?, dolor_detectado),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(despacho_nombre || null, effectiveTamano, finalScore, finalPhone, diag.dolor_detectado, finalLeadId).run();
      } else {
        finalLeadId = leadId || crypto.randomUUID();
        targetAccountId = `acc_${finalLeadId}`;
        targetContactId = `ct_${finalLeadId}`;

        await c.env.DB.prepare(`
          INSERT INTO sales_leads (id, email, despacho_nombre, tamano, dolor_detectado, especialista_asignado, estado, score, phone, account_id, contact_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'nuevo', ?, ?, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          finalLeadId,
          email,
          despacho_nombre || null,
          effectiveTamano,
          diag.dolor_detectado,
          diag.especialista_asignado,
          initialScore,
          normalizedPhone || null
        ).run();
      }

      const ensured = await ensureAccountContactForLead(c.env.DB, {
        id: finalLeadId,
        email,
        despacho_nombre,
        tamano: effectiveTamano,
        accountId: targetAccountId,
        contactId: targetContactId
      });
      targetAccountId = ensured.accountId;
      targetContactId = ensured.contactId;

      if (normalizedPhone) {
        try {
          await c.env.DB.prepare(`UPDATE sales_contacts SET phone = COALESCE(?, phone), name = COALESCE(?, name) WHERE id = ? OR account_id = ?`)
            .bind(normalizedPhone, contact_name || "Contacto Corporativo", targetContactId, targetAccountId).run();
        } catch {}
      }
      const ubicacion = ctx.ubicacion || body.ciudad || null;
      try {
        await c.env.DB.prepare(`
          UPDATE sales_accounts
          SET scian_code = COALESCE(?, scian_code),
              harvest_source = COALESCE(?, harvest_source),
              city = COALESCE(?, city),
              last_enriched_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(scian_code || null, harvest_source || "denue", ubicacion, targetAccountId).run();
      } catch {}
      if (contact_email) {
        try {
          const existingCt: any = await c.env.DB.prepare("SELECT id FROM sales_contacts WHERE account_id = ? OR LOWER(email) = LOWER(?) LIMIT 1")
            .bind(targetAccountId, contact_email).first();
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
            `).bind(targetContactId, targetAccountId, contact_name || "Contacto Corporativo", contact_email, normalizedPhone, "Dirección General").run();
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
            `obs_hermes_${finalLeadId}`,
            targetAccountId,
            signalCode,
            JSON.stringify({ state: hLead.state, equityDollars: hLead.equityDollars, marketValueDollars: hLead.marketValueDollars })
          ).run();
        } catch {}
      }
    }

    // 3. Inicializar el Durable Object para tener el contexto listo SOLO si no es cosecha masiva de fondo
    // En ingestas masivas (denue, hermes, background) EVITAMOS precalentar para no agotar cuota de escritura en D1 ni quemar tokens LLM
    const isBackgroundHarvest = Boolean(
      harvest_source === "denue" ||
      origen === "denue" ||
      origen === "hermes_us_proptech" ||
      body.harvest_source ||
      body.skip_chat_preheat
    );
    const shouldPreheatDO = !isBackgroundHarvest && Boolean(
      body.chat_preheat === true || origen === "web" || origen === "chat"
    );

    if (c.env.SALES_AGENT && shouldPreheatDO) {
      try {
        const doId = c.env.SALES_AGENT.idFromName(finalLeadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: finalLeadId,
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
      lead_id: finalLeadId,
      diagnostico: diag,
      message: "Lead registrado exitosamente y clasificado por dolor operativo.",
    }, 201);
  } catch (err: any) {
    console.error("[webhookRouter] Error en /webhooks/ingest:", err);
    return c.json({ error: err.message || "Error procesando webhook" }, 500);
  }
});
