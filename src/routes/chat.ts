import { Hono } from "hono";
import { Env } from "../types";
import { z } from "zod";
import { ensureAccountContactForLead } from "../crm/automation";

const chatSchema = z.object({
  message: z.string().min(1),
  lead_id: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  despacho_nombre: z.string().optional(),
  tamano: z.string().optional(),
  stream: z.boolean().optional(),
});

export const chatRouter = new Hono<{ Bindings: Env }>();

chatRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Payload inválido", details: parsed.error.flatten() }, 400);
    }
    const { lead_id, message, email, despacho_nombre, tamano, stream } = parsed.data;

    if (!message || typeof message !== "string") {
      return c.json({ error: "El campo 'message' es obligatorio y debe ser texto." }, 400);
    }

    // Si no viene lead_id, generar un UUID nuevo para este prospecto
    const effectiveLeadId = lead_id || crypto.randomUUID();

    // Si es un lead nuevo y viene email, registrar en sales_leads
    if (c.env.DB && (!lead_id || email)) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO sales_leads (id, email, despacho_nombre, tamano, especialista_asignado, estado, score, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'intake', 'nuevo', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            email = coalesce(excluded.email, sales_leads.email),
            despacho_nombre = coalesce(excluded.despacho_nombre, sales_leads.despacho_nombre),
            tamano = coalesce(excluded.tamano, sales_leads.tamano),
            updated_at = CURRENT_TIMESTAMP
        `).bind(
          effectiveLeadId,
          email || "anonimo@lead.arksystems.site",
          despacho_nombre || null,
          tamano || null
        ).run();
        await ensureAccountContactForLead(c.env.DB, { id: effectiveLeadId, email: email || "anonimo@lead.arksystems.site", despacho_nombre, tamano });
      } catch (dbErr) {
        console.error("[chatRouter] Error insertando o actualizando lead en D1:", dbErr);
      }
    }

    // Conectar con el Durable Object SalesAgent asignado al lead_id
    const doId = c.env.SALES_AGENT.idFromName(effectiveLeadId);
    const stub = c.env.SALES_AGENT.get(doId);

    const doResponse = await stub.fetch("https://sales-agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: effectiveLeadId,
        message,
        email,
        despacho_nombre,
        tamano,
        stream: stream === true,
      }),
    });

    if (!doResponse.ok) {
      const errText = await doResponse.text();
      return c.json({ error: `Error en SalesAgent DO: ${errText}` }, 500);
    }

    if (stream === true) {
      return new Response(doResponse.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await doResponse.json();
    return c.json(data);
  } catch (err: any) {
    console.error("[chatRouter] Error:", err);
    return c.json({ error: err.message || "Error interno procesando chat" }, 500);
  }
});
