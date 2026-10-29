import { Hono } from "hono";
import { Env, LeadIngestPayload } from "../types";
import { ToolExecutor } from "../tools";
import { ensureAccountContactForLead } from "../crm/automation";

export const webhookRouter = new Hono<{ Bindings: Env }>();

webhookRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { email, despacho_nombre, tamano, dolor_principal, productos_interes, origen } = body;

    if (!email || typeof email !== "string") {
      return c.json({ error: "El campo 'email' es obligatorio." }, 400);
    }

    const leadId = crypto.randomUUID();
    const toolExecutor = new ToolExecutor(c.env);

    // 1. Diagnosticar despacho para enrutamiento por dolor
    const diag = toolExecutor.diagnosticarDespacho(
      dolor_principal || "Consulta general de despacho",
      tamano,
      productos_interes
    );

    // 2. Persistir en sales_leads
    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO sales_leads (id, email, despacho_nombre, tamano, dolor_detectado, especialista_asignado, estado, score, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'nuevo', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        leadId,
        email,
        despacho_nombre || null,
        tamano || "1-5",
        diag.dolor_detectado,
        diag.especialista_asignado
      ).run();
      await ensureAccountContactForLead(c.env.DB, { id: leadId, email, despacho_nombre, tamano: tamano || "1-5" });
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

webhookRouter.post("/x-twitter", async (c) => {
  try {
    const body = await c.req.json();
    const { username, queja_sat } = body;

    if (!username || !queja_sat) {
      return c.json({ error: "Los campos 'username' y 'queja_sat' son obligatorios." }, 400);
    }

    const leadId = crypto.randomUUID();
    const email = `${username}@x.com`;
    const dolorDetectado = "sat_fiscal_calculo";
    const especialistaAsignado = "riesgo";
    const flagSummary = `[pending_twitter_tag] ${queja_sat}`;

    if (c.env.DB) {
      await c.env.DB.prepare(`
        INSERT INTO sales_leads (id, email, dolor_detectado, especialista_asignado, estado, score, conversation_summary, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'nuevo', 20, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(
        leadId,
        email,
        dolorDetectado,
        especialistaAsignado,
        flagSummary
      ).run();
      await ensureAccountContactForLead(c.env.DB, { id: leadId, email });
    }

    if (c.env.SALES_AGENT) {
      try {
        const doId = c.env.SALES_AGENT.idFromName(leadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            message: `Lead ingresado desde webhook X (Twitter). Dolor detectado: queja SAT.`,
            email,
          }),
        });
      } catch (err) {
        console.warn("[webhookRouter] No se pudo precalentar DO para X:", err);
      }
    }

    return c.json({
      success: true,
      lead_id: leadId,
      message: "Lead de X (Twitter) registrado exitosamente y marcado para respuesta autónoma.",
    }, 201);
  } catch (err: any) {
    console.error("[webhookRouter] Error en /webhooks/x-twitter:", err);
    return c.json({ error: err.message || "Error procesando webhook de X" }, 500);
  }
});
