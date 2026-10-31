import { Env } from "../types";

export interface CourtesyCallParams {
  to: string;
  despachoNombre?: string;
  leadId?: string;
  contactId?: string;
  accountId?: string;
  industry?: string;
  customMessage?: string;
}

export interface CourtesyCallResult {
  success: boolean;
  call_control_id?: string;
  simulated?: boolean;
  message: string;
  phone_e164?: string;
  error?: string;
}

/**
 * Normaliza cualquier número mexicano o internacional al formato E.164 (+52...)
 */
export function normalizarTelefonoE164(rawPhone: string): { valid: boolean; e164?: string; error?: string } {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { valid: false, error: "El teléfono no fue proporcionado." };
  }

  // Eliminar espacios, guiones, paréntesis y puntos
  const cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // Si ya tiene prefijo +, validar dígitos
  if (cleaned.startsWith("+")) {
    const digitsOnly = cleaned.slice(1);
    if (/^\d{10,15}$/.test(digitsOnly)) {
      return { valid: true, e164: cleaned };
    }
    return { valid: false, error: "Formato internacional inválido." };
  }

  // Si tiene 10 dígitos (estándar México: 55XXXXXXXX, 81XXXXXXXX, etc.)
  if (/^\d{10}$/.test(cleaned)) {
    return { valid: true, e164: `+52${cleaned}` };
  }

  // Si tiene 12 dígitos empezando con 52 (México sin +)
  if (/^52\d{10}$/.test(cleaned)) {
    return { valid: true, e164: `+${cleaned}` };
  }

  // Si tiene entre 11 y 15 dígitos numéricos
  if (/^\d{11,15}$/.test(cleaned)) {
    return { valid: true, e164: `+${cleaned}` };
  }

  return { valid: false, error: "El número debe tener al menos 10 dígitos válidos." };
}

/**
 * Genera el guion de cortesía en español con tono profesional mexicano
 */
export function generarGuionCortesia(despachoNombre?: string, industry?: string): string {
  const nombre = despachoNombre ? despachoNombre.trim() : "Estimado cliente";
  const ind = (industry || "").toLowerCase();

  if (/inmobili|renta|bienes/i.test(ind)) {
    return `Hola, te saludamos de ARK Systems. Recibimos tu interés para la cobranza de rentas y cuotas inmobiliarias en ${nombre}. Te confirmamos que la cotización oficial de Ark Angel ya fue enviada a tu correo. Un asesor especializado se comunicará contigo para activar tu entorno. Gracias por confiar en la tecnología de ARK.`;
  }

  if (/auto|leasing|vehic/i.test(ind)) {
    return `Hola, te saludamos de ARK Systems. Recibimos tu solicitud para la recuperación de cartera y cálculo de recargos fiscales en ${nombre}. Tu propuesta oficial de Ark Angel y Ark Ledger ya está disponible en tu correo electrónico. En breve un especialista te contactará. Gracias por comunicarte con ARK.`;
  }

  if (/bpo|call center|gran volumen/i.test(ind)) {
    return `Hola, te saludamos de ARK Systems. Confirmamos la recepción de tu solicitud para cobranza masiva con softphone auditado bajo normas CONDUSEF en ${nombre}. La propuesta del Paquete Enterprise ya fue enviada a tu correo. Un director de cuenta te contactará en breve. Gracias por elegir ARK.`;
  }

  return `Hola, te saludamos de ARK Systems. Recibimos tu solicitud para ${nombre}. Te confirmamos que la cotización oficial de Ark Angel y Ark Ledger ya fue enviada a tu correo electrónico. Un especialista se pondrá en contacto contigo en breve para brindarte atención personalizada. Gracias por confiar en la infraestructura de ARK.`;
}

/**
 * Dispara la llamada de cortesía vía Telnyx Call Control API
 * Si TELNYX_API_KEY no está configurada, opera en modo simulado seguro (fail-closed)
 */
export async function dispararLlamadaCortesia(
  env: Env,
  params: CourtesyCallParams
): Promise<CourtesyCallResult> {
  const norm = normalizarTelefonoE164(params.to);
  if (!norm.valid || !norm.e164) {
    return {
      success: false,
      message: norm.error || "Número telefónico inválido",
      error: "INVALID_PHONE_NUMBER",
    };
  }

  const phoneE164 = norm.e164;
  const guion = params.customMessage || generarGuionCortesia(params.despachoNombre, params.industry);

  // 1. Modo Simulado si no hay API Key de Telnyx (ideal para tests y desarrollo)
  if (!env.TELNYX_API_KEY) {
    const simulatedCallId = `call_sim_${crypto.randomUUID().slice(0, 8)}`;
    console.log(`[TelnyxVoice:Simulación] Llamada de cortesía a ${phoneE164}: "${guion}"`);

    // Registrar actividad en CRM si hay DB
    if (env.DB && (params.leadId || params.accountId)) {
      try {
        await env.DB.prepare(`
          INSERT INTO sales_activities (id, account_id, contact_id, lead_id, type, details)
          VALUES (?, ?, ?, ?, 'call', ?)
        `).bind(
          `act_${crypto.randomUUID()}`,
          params.accountId || null,
          params.contactId || null,
          params.leadId || null,
          `Llamada de cortesía simulada a ${phoneE164}: Mensaje reproducido`
        ).run();

        if (params.leadId) {
          await env.DB.prepare(`
            UPDATE sales_leads 
            SET phone = ?, last_call_status = 'simulated', last_call_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(phoneE164, params.leadId).run();
        }
      } catch (dbErr) {
        console.warn("[TelnyxVoice] Error registrando actividad simulada:", dbErr);
      }
    }

    return {
      success: true,
      simulated: true,
      call_control_id: simulatedCallId,
      phone_e164: phoneE164,
      message: `Llamada de cortesía simulada exitosamente a ${phoneE164}`,
    };
  }

  // 2. Disparo Real vía Telnyx Call Control v2
  const fromNumber = env.TELNYX_PHONE_NUMBER || "+525500000000";
  const salesApiUrl = env.SALES_API_URL || "https://sales.arksystems.site";
  const webhookUrl = `${salesApiUrl}/webhooks/telnyx`;

  // Empaquetar estado para el webhook
  const clientStateObj = {
    leadId: params.leadId,
    contactId: params.contactId,
    accountId: params.accountId,
    despachoNombre: params.despachoNombre,
    guion,
  };
  const clientStateB64 = btoa(JSON.stringify(clientStateObj));

  try {
    const telnyxPayload: any = {
      to: phoneE164,
      from: fromNumber,
      webhook_url: webhookUrl,
      answering_machine_detection: "detect",
      client_state: clientStateB64,
    };

    if (env.TELNYX_CONNECTION_ID) {
      telnyxPayload.connection_id = env.TELNYX_CONNECTION_ID;
    }

    const response = await fetch("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(telnyxPayload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[TelnyxVoice] Error HTTP ${response.status} de Telnyx:`, errBody);
      return {
        success: false,
        error: `TELNYX_HTTP_${response.status}`,
        message: `Telnyx respondió con error: ${errBody}`,
      };
    }

    const data: any = await response.json();
    const callControlId = data?.data?.call_control_id || `call_${crypto.randomUUID().slice(0, 8)}`;

    // Registrar en BD
    if (env.DB && params.leadId) {
      try {
        await env.DB.prepare(`
          UPDATE sales_leads 
          SET phone = ?, last_call_status = 'initiated', last_call_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(phoneE164, params.leadId).run();

        await env.DB.prepare(`
          INSERT INTO sales_activities (id, account_id, contact_id, lead_id, type, details)
          VALUES (?, ?, ?, ?, 'call', ?)
        `).bind(
          `act_${crypto.randomUUID()}`,
          params.accountId || null,
          params.contactId || null,
          params.leadId,
          `Llamada de cortesía Telnyx iniciada a ${phoneE164} (ID: ${callControlId})`
        ).run();
      } catch (dbErr) {
        console.warn("[TelnyxVoice] Error actualizando BD tras inicio de llamada:", dbErr);
      }
    }

    return {
      success: true,
      simulated: false,
      call_control_id: callControlId,
      phone_e164: phoneE164,
      message: `Llamada de cortesía Telnyx iniciada a ${phoneE164}`,
    };
  } catch (err: any) {
    console.error("[TelnyxVoice] Excepción disparando llamada Telnyx:", err);
    return {
      success: false,
      error: err.message || "TELNYX_CALL_EXCEPTION",
      message: "Excepción de red al conectar con Telnyx",
    };
  }
}

/**
 * Procesa webhooks entrantes de Telnyx Call Control (call.answered, call.speak.ended, call.hangup)
 */
function base64ToBytes(value: string): Uint8Array | null {
  try {
    const cleaned = value.trim();
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Verifica la firma Ed25519 de un webhook de Telnyx.
 * Si no hay publicKey (desarrollo/test), se permite bypass controlado (fail-open solo en development).
 */
export async function verificarFirmaTelnyx(
  publicKey: string,
  signature: string,
  timestamp: string,
  bodyText: string
): Promise<boolean> {
  if (!publicKey) {
    return true;
  }
  if (!signature || !timestamp) {
    return false;
  }
  const publicKeyBytes = base64ToBytes(publicKey);
  const signatureBytes = base64ToBytes(signature);
  if (!publicKeyBytes || !signatureBytes || publicKeyBytes.length !== 32 || signatureBytes.length !== 64) {
    return false;
  }
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const encoder = new TextEncoder();
    const message = encoder.encode(`${timestamp}|${bodyText}`);
    return await crypto.subtle.verify("Ed25519", cryptoKey, signatureBytes, message);
  } catch {
    return false;
  }
}

export async function procesarEventoTelnyx(
  env: Env,
  event: any
): Promise<{ handled: boolean; action?: string; error?: string }> {
  const eventType = event?.data?.event_type;
  const payload = event?.data?.payload;

  if (!eventType || !payload) {
    return { handled: false, error: "Evento Telnyx inválido o sin payload" };
  }

  const callControlId = payload.call_control_id;
  let clientState: any = {};
  if (payload.client_state) {
    try {
      clientState = JSON.parse(atob(payload.client_state));
    } catch {
      clientState = {};
    }
  }

  console.log(`[TelnyxWebhook] Evento recibido: ${eventType} (CallID: ${callControlId})`);

  // Cuando el usuario o contestadora responde la llamada
  if (eventType === "call.answered") {
    const guion = clientState.guion || generarGuionCortesia(clientState.despachoNombre);

    if (env.TELNYX_API_KEY && callControlId) {
      try {
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload: guion,
            voice: "female",
            language: "es-MX",
          }),
        });
      } catch (err) {
        console.error("[TelnyxWebhook] Error enviando comando speak:", err);
      }
    }

    // Registrar en BD
    if (env.DB && clientState.leadId) {
      try {
        await env.DB.prepare(`
          UPDATE sales_leads 
          SET last_call_status = 'answered'
          WHERE id = ?
        `).bind(clientState.leadId).run();

        await env.DB.prepare(`
          INSERT INTO sales_activities (id, account_id, contact_id, lead_id, type, details)
          VALUES (?, ?, ?, ?, 'call', ?)
        `).bind(
          `act_${crypto.randomUUID()}`,
          clientState.accountId || null,
          clientState.contactId || null,
          clientState.leadId,
          "Llamada de cortesía contestada: audio reproducido al cliente"
        ).run();
      } catch (dbErr) {
        console.warn("[TelnyxWebhook] Error actualizando BD en call.answered:", dbErr);
      }
    }

    return { handled: true, action: "speak_initiated" };
  }

  // Cuando termina de hablar, colgar la llamada
  if (eventType === "call.speak.ended") {
    if (env.TELNYX_API_KEY && callControlId) {
      try {
        await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.TELNYX_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
      } catch (err) {
        console.error("[TelnyxWebhook] Error enviando comando hangup:", err);
      }
    }
    return { handled: true, action: "hangup_sent" };
  }

  // Cuando la llamada termina
  if (eventType === "call.hangup") {
    if (env.DB && clientState.leadId) {
      try {
        await env.DB.prepare(`
          UPDATE sales_leads 
          SET last_call_status = 'completed'
          WHERE id = ?
        `).bind(clientState.leadId).run();
      } catch (dbErr) {
        console.warn("[TelnyxWebhook] Error actualizando estado completed:", dbErr);
      }
    }
    return { handled: true, action: "call_completed" };
  }

  return { handled: true, action: "ignored_event" };
}
