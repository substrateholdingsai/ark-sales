import { Hono } from "hono";
import { Env } from "../types";
import { procesarEventoTelnyx, dispararLlamadaCortesia, verificarFirmaTelnyx, normalizarTelefonoE164 } from "../voice/telnyx";
import { isAuthenticated } from "../client/crmPage";
import { DncService } from "../services/dnc";
import { IntentHandler } from "../services/intentHandler";

export const telnyxRouter = new Hono<{ Bindings: Env }>();

function hasValidInternalOrWebhookSecret(c: any): boolean {
  const expectedSecrets = [c.env.INTERNAL_SERVICE_KEY, c.env.INTERNAL_API_TOKEN, c.env.WEBHOOK_SECRET, c.env.ARK_WEBHOOK_SECRET].filter(
    (s) => typeof s === "string" && s.trim().length > 0,
  );

  if (expectedSecrets.length === 0) return false;

  const authHeader = c.req.header("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const provided = c.req.header("X-Ark-Internal-Key") || c.req.header("X-Internal-Token") || c.req.header("X-Ark-Webhook-Secret") || bearer;

  return Boolean(provided && expectedSecrets.includes(provided));
}

/**
 * Webhook oficial de Telnyx Call Control
 * Recibe eventos de llamada: call.initiated, call.answered, call.speak.ended, call.hangup
 */
telnyxRouter.post("/", async (c) => {
  try {
    const bodyText = await c.req.text();
    const isProd = (c.env.ENVIRONMENT || "").toLowerCase() === "production";
    if (isProd && !c.env.TELNYX_PUBLIC_KEY) {
      return c.json({ error: "TELNYX_PUBLIC_KEY requerida en producción." }, 503);
    }
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
 * Endpoint para disparar llamadas de cortesía desde el CRM o integraciones (Protegido contra Toll Fraud)
 */
telnyxRouter.post("/call", async (c) => {
  try {
    const isInternal = hasValidInternalOrWebhookSecret(c);
    const isCrmUser = await isAuthenticated(c.req.raw, c.env);
    if (!isInternal && !isCrmUser) {
      return c.json({ error: "No autorizado: Se requiere sesión activa en CRM o llave interna para disparar llamadas." }, 401);
    }

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

/**
 * G5: Inbound WhatsApp/SMS opt-out webhook.
 * Receives inbound messages from Telnyx, runs the deterministic opt-out detector
 * (IntentHandler.classifyDeterministic, "BAJA"/"STOP"), and inserts the contact
 * into the DNC list automatically. No re-send to a suppressed contact, ever.
 */
telnyxRouter.post("/messages", async (c) => {
  try {
    const bodyText = await c.req.text();
    const isProd = (c.env.ENVIRONMENT || "").toLowerCase() === "production";
    if (isProd && !c.env.TELNYX_PUBLIC_KEY) {
      return c.json({ error: "TELNYX_PUBLIC_KEY requerida en producción." }, 503);
    }
    if (c.env.TELNYX_PUBLIC_KEY) {
      const signature = c.req.header("telnyx-signature-ed25519") || "";
      const timestamp = c.req.header("telnyx-timestamp") || "";
      const ok = await verificarFirmaTelnyx(c.env.TELNYX_PUBLIC_KEY, signature, timestamp, bodyText);
      if (!ok) {
        return c.json({ error: "Firma de Telnyx inválida." }, 403);
      }
    }

    const body = bodyText ? JSON.parse(bodyText) : {};
    const payload = body?.payload || body?.data || body;
    const from = payload?.from || payload?.from_number || "";
    const text = payload?.text || payload?.message || payload?.body || "";
    const channel = payload?.channel || payload?.media_type || "whatsapp";

    if (!from || !text) {
      return c.json({ error: "from y text son requeridos." }, 400);
    }

    const norm = normalizarTelefonoE164(from);
    const phoneE164 = norm.valid ? norm.e164 : null;

    // Run deterministic opt-out detector
    const intent = IntentHandler.classifyDeterministic(text);
    const isOptOut = intent?.intent === "unsubscribe" || intent?.permanentDnc === true;

    if (!isOptOut) {
      return c.json({ handled: true, action: "no_opt_out_detected", intent: intent?.intent ?? null }, 200);
    }

    // Insert into DNC list (G5: auto-suppress)
    if (!c.env.DB) {
      return c.json({ error: "D1 no disponible." }, 503);
    }

    const dnc = new DncService(c.env.DB);
    if (phoneE164) {
      await dnc.add(phoneE164, "opt_out", undefined, phoneE164);
    }
    // Also block by raw from if it's an email-like address
    if (from.includes("@")) {
      await dnc.add(from, "opt_out", undefined, phoneE164 ?? undefined);
    }

    return c.json(
      {
        handled: true,
        action: "opt_out_added_to_dnc",
        from,
        phone_e164: phoneE164,
        channel,
        intent: intent?.intent,
        message: "Contacto agregado a lista DNC por opt-out. No se reenviará.",
      },
      200,
    );
  } catch (err: any) {
    console.error("[telnyxRouter] Error en /webhooks/telnyx/messages:", err);
    return c.json({ error: err.message || "Error procesando mensaje entrante." }, 500);
  }
});
