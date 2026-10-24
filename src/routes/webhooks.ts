import { Hono } from "hono";
import { Env, LeadIngestPayload } from "../types";
import { ToolExecutor } from "../tools";

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
