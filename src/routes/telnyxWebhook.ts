import { Hono } from "hono";
import { Env } from "../types";
import { procesarEventoTelnyx, dispararLlamadaCortesia, verificarFirmaTelnyx } from "../voice/telnyx";

export const telnyxRouter = new Hono<{ Bindings: Env }>();

/**
 * Webhook oficial de Telnyx Call Control
 * Recibe eventos de llamada: call.initiated, call.answered, call.speak.ended, call.hangup
 */
telnyxRouter.post("/", async (c) => {
  try {
    const bodyText = await c.req.text();
    if (c.env.TELNYX_PUBLIC_KEY) {
      const signature = c.req.header("telnyx-signature-ed25519") || "";
      const timestamp = c.req.header("telnyx-timestamp") || "";
      const ok = await verificarFirmaTelnyx(c.env.TELNYX_PUBLIC_KEY, signature, timestamp, bodyText);
      if (!ok) {
        return c.json({ error: "Firma de Telnyx inválida." }, 403);
      }
    }
    const event = bodyText ? JSON.parse(bodyText) : {};
    const result = await procesarEventoTelnyx(c.env, event);
    return c.json({ success: true, ...result });
  } catch (err: any) {
    console.error("[telnyxRouter] Error procesando webhook:", err);
    return c.json({ error: err.message || "Error procesando webhook de Telnyx" }, 500);
  }
});

/**
 * Endpoint para disparar llamadas de cortesía desde el CRM o integraciones
 */
telnyxRouter.post("/call", async (c) => {
  try {
    const body = await c.req.json();
    const { to, despacho_nombre, lead_id, contact_id, account_id, industry, custom_message } = body;

    if (!to) {
      return c.json({ error: "El campo 'to' (teléfono) es obligatorio." }, 400);
    }

    const result = await dispararLlamadaCortesia(c.env, {
      to,
      despachoNombre: despacho_nombre,
      leadId: lead_id,
      contactId: contact_id,
      accountId: account_id,
      industry,
      customMessage: custom_message,
    });

    return c.json(result, result.success ? 200 : 400);
  } catch (err: any) {
    console.error("[telnyxRouter] Error en /webhooks/telnyx/call:", err);
    return c.json({ error: err.message || "Error disparando llamada" }, 500);
  }
});