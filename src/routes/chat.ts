import { Hono } from "hono";
import { Env } from "../types";
import { z } from "zod";
import { ensureAccountContactForLead } from "../crm/automation";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  lead_id: z.string().max(128).optional(),
  email: z.string().email().optional().or(z.literal("")),
  despacho_nombre: z.string().max(200).optional(),
  tamano: z.string().max(32).optional(),
  stream: z.boolean().optional(),
});

export const chatRouter = new Hono<{ Bindings: Env }>();

// Rate limit por IP/lead para proteger Neuronas de Workers AI y Durable Objects
const chatRateMap = new Map<string, number[]>();
const CHAT_WINDOW_MS = 60 * 1000;
const CHAT_MAX_REQ_PER_MIN = 25;

function isChatRateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (chatRateMap.get(key) || []).filter((ts) => now - ts < CHAT_WINDOW_MS);
  if (arr.length >= CHAT_MAX_REQ_PER_MIN) {
    chatRateMap.set(key, arr);
    return true;
  }
  arr.push(now);
  chatRateMap.set(key, arr);
  return false;
}

chatRouter.post("/", async (c) => {
  try {
    const ip = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "";
    if (ip && isChatRateLimited(`ip:${ip}`)) {
      return c.json({ error: "Demasiados mensajes por minuto. Por favor espera unos segundos." }, 429);
    }
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
