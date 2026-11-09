import { Hono, Context } from "hono";
import { z } from "zod";
import { Env, AgentSkill, LeadExecutiveContext } from "../types";
import { ensureAccountContactForLead, ensureTask } from "../crm/automation";
import { internalEmailRouter } from "./internalEmail";

export type InternalVariables = {
  operator?: "staypuft" | "grok_bot" | "internal_service";
};

export type InternalContext = Context<{ Bindings: Env; Variables: InternalVariables }>;

/**
 * Normaliza y valida números telefónicos para México en formato E.164 (+52...)
 * Regla IFT: En México todo número válido nacional tiene exactamente 10 dígitos y no inicia con 0 ni 1.
 * Rechaza números concatenados, fijos con prefijos legacy 01 o longitudes inválidas (11, 14, 15 dígitos).
 */
export function normalizeMexicanPhone(raw: string | null | undefined): {
  telefono: string | null;
  whatsapp: string | null;
  whatsapp_valid: boolean;
  malformed: boolean;
} {
  if (!raw || typeof raw !== "string") {
    return { telefono: null, whatsapp: null, whatsapp_valid: false, malformed: false };
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "n/a") {
    return { telefono: null, whatsapp: null, whatsapp_valid: false, malformed: false };
  }

  // Extraer sólo dígitos numéricos
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return { telefono: null, whatsapp: null, whatsapp_valid: false, malformed: true };
  }

  let nationalDigits = "";

  // 1. Caso internacional 13 dígitos: 521 + 10 dígitos (legacy móvil mexicano)
  if (digits.length === 13 && digits.startsWith("521")) {
    nationalDigits = digits.slice(3);
  }
  // 2. Caso internacional 12 dígitos: 52 + 10 dígitos (E.164 estándar mexicano)
  else if (digits.length === 12 && digits.startsWith("52")) {
    nationalDigits = digits.slice(2);
  }
  // 3. Caso nacional estándar: exactamente 10 dígitos
  else if (digits.length === 10) {
    nationalDigits = digits;
  }
  // Cualquier otra longitud (ej. 7, 8, 11, 14, 15 dígitos concatenados con 01) es MALFORMADA
  else {
    return { telefono: null, whatsapp: null, whatsapp_valid: false, malformed: true };
  }

  // En el plan de numeración de México (IFT), los números nacionales de 10 dígitos nunca empiezan con 0 ni con 1.
  if (nationalDigits.length !== 10 || nationalDigits.startsWith("0") || nationalDigits.startsWith("1")) {
    return { telefono: null, whatsapp: null, whatsapp_valid: false, malformed: true };
  }

  const formatted = `+52${nationalDigits}`;
  return {
    telefono: formatted,
    whatsapp: formatted,
    whatsapp_valid: true,
    malformed: false,
  };
}

// Rate limiting en memoria para llamadas internas (120 req/min)
const internalRateLimits = new Map<string, number[]>();
function checkInternalRateLimit(key: string, limit = 120, windowMs = 60000): boolean {
  const now = Date.now();
  const times = (internalRateLimits.get(key) || []).filter((t) => now - t < windowMs);
  if (times.length >= limit) return false;
  times.push(now);
  internalRateLimits.set(key, times);
  return true;
}

export const internalRouter = new Hono<{ Bindings: Env; Variables: InternalVariables }>();


internalRouter.use("*", async (c, next) => {
  const expectedService = c.env?.INTERNAL_SERVICE_KEY;
  const expectedToken = c.env?.INTERNAL_API_TOKEN;
  const expectedStayPuft = c.env?.STAYPUFT_API_KEY;

  const authHeader = c.req.header("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const provided = c.req.header("X-Ark-Internal-Key") || c.req.header("X-Internal-Token") || c.req.header("X-StayPuft-Key") || bearer;

  if (!provided) {
    return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
  }

  let operator: "staypuft" | "grok_bot" | "internal_service" = "internal_service";

  if (expectedStayPuft && provided === expectedStayPuft) {
    operator = "staypuft";
  } else if (expectedService || expectedToken) {
    if (provided === expectedService || provided === expectedToken) {
      operator = "internal_service";
    } else {
      return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
    }
  } else if ((c.env?.ENVIRONMENT || "development") === "production") {
    return c.json({ error: "Unauthorized: internal key not configured." }, 401);
  }

  // Rate Limiting anti-abuso
  const rateLimitKey = `${operator}:${provided.slice(0, 10)}`;
  if (!checkInternalRateLimit(rateLimitKey, 120, 60000)) {
    return c.json({ error: "Too Many Requests: Rate limit exceeded (120 req/min)." }, 429);
  }

  c.set("operator", operator);

  // Acceso Total Autorizado para StayPuft (Nov 2026):
  // X-StayPuft-Key autoriza todos los endpoints internos del worker.
  // La ejecución de acciones con impacto externo (envíos reales, voz, publicaciones)
  // continúa sujeta a confirmación humana por Pablo en chat.

  await next();
});

// Rutas de Email para Operador StayPuft y Servicios Internos
internalRouter.route("/email", internalEmailRouter);

/**
 * Ingesta Federada de Leads y Altas de SIEM CANACO (/api/internal/leads/ingest)
 * Recibe leads desde las Landings white-label de CANACO, formularios SIEM o hermanos ARK,
 * persiste la información en D1, crea registros CRM y despierta automáticamente al SalesAgent (Durable Object).
 */
internalRouter.post("/leads/ingest", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    // Soporta estructura plana (landing CANACO/SIEM) y anidada (LEAD_INGEST_V3 de hermanos ARK)
    const rawEmail = body.email || body.account_context?.email;
    if (!rawEmail || typeof rawEmail !== "string" || !rawEmail.includes("@")) {
      return c.json({ error: "El campo 'email' es obligatorio y debe ser un correo válido." }, 400);
    }
    const email = rawEmail.trim().toLowerCase();

    const despachoNombre = (
      body.despacho_nombre ||
      body.empresa ||
      body.razon_social ||
      body.comercio ||
      body.account_context?.despacho_nombre ||
      "Comercio Agremiado"
    ).trim();

    const tamano = body.tamano || body.account_context?.tamano || "1-5";
    const origin = body.origin || body.origen || body.source_worker || "canaco_siem";
    const siemId = body.siem_id || body.registro_siem || null;
    const landingUrl = body.landing_url || null;
    const phone = body.phone || body.telefono || null;
    const vertical = body.vertical || "fiscal";
    const destination = body.destination || "ledger";
    const score = typeof body.score === "number" ? body.score : 75;

    const leadId = body.lead_id || `lead_siem_${crypto.randomUUID().slice(0, 12)}`;

    const conversationSummary = body.conversation_summary ||
      `[ALTA SIEM CANACO]: Agremiado '${despachoNombre}' (${email}) registrado vía SIEM${siemId ? ` (#${siemId})` : ""}. ` +
      `Landing page comercial Ark Commerce bonificada al 100% ($0 MXN vs $299/mes regular). SalesAgent activado para onboarding de Ark Ledger Freemium ($0) y Plan PRO Despacho ($399).`;

    let accountId = `acc_${leadId}`;
    let contactId = `ct_${leadId}`;
    const oppId = `opp_${leadId}`;

    if (c.env.DB) {
      // 1. Persistir o actualizar en sales_leads
      await c.env.DB.prepare(`
        INSERT INTO sales_leads (
          id, email, despacho_nombre, tamano, dolor_detectado, especialista_asignado, estado, score, conversation_summary, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'sat_fiscal_calculo', 'intake', 'calificado', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          despacho_nombre = COALESCE(excluded.despacho_nombre, sales_leads.despacho_nombre),
          tamano = COALESCE(excluded.tamano, sales_leads.tamano),
          score = MAX(sales_leads.score, excluded.score),
          conversation_summary = COALESCE(excluded.conversation_summary, sales_leads.conversation_summary),
          updated_at = CURRENT_TIMESTAMP
      `).bind(leadId, email, despachoNombre, tamano, score, conversationSummary).run();

      // 2. Garantizar Cuenta y Contacto en CRM
      const res = await ensureAccountContactForLead(c.env.DB, {
        id: leadId,
        email,
        despacho_nombre: despachoNombre,
        tamano,
      });
      accountId = res.accountId;
      contactId = res.contactId;

      // Actualizar datos adicionales en cuenta y contacto
      if (landingUrl || phone) {
        await c.env.DB.prepare(`
          UPDATE sales_accounts
          SET website = COALESCE(?, website),
              phone = COALESCE(?, phone),
              origin = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(landingUrl, phone, origin, accountId).run().catch(() => {});

        if (phone) {
          await c.env.DB.prepare(`
            UPDATE sales_contacts
            SET phone = COALESCE(?, phone),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(phone, contactId).run().catch(() => {});
        }
      }

      // 3. Crear Oportunidad en CRM para Plan PRO Despacho
      await c.env.DB.prepare(`
        INSERT OR IGNORE INTO sales_opportunities (
          id, account_id, contact_id, lead_id, stage, products_interest_json, estimated_value, currency, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'calificado', '["ledger_pro", "commerce_canaco"]', 399.00, 'MXN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(oppId, accountId, contactId, leadId).run().catch(() => {});

      // 4. Crear Tarea de Onboarding
      await ensureTask(c.env.DB, {
        title: `Onboarding SIEM CANACO: Activar Landing Ark-Commerce y presentar Ark Ledger PRO ($399)`,
        description: `Agremiado CANACO (${despachoNombre}) registrado vía SIEM. Landing page activa sin costo ($0 vs $299). Onboarding a 20 herramientas fiscales gratuitas y resguardo CFF Art. 30.`,
        leadId,
        accountId,
        contactId,
        opportunityId: oppId,
        dueInDays: 2,
      });
    }

    // 5. Disparar automáticamente al SalesAgent (Durable Object)
    let salesAgentTriggered = false;
    let agentWelcomeMessage: string | null = null;
    let specialistAssigned = "intake";
    let toolsCalled: any[] = [];

    if (c.env.SALES_AGENT && typeof c.env.SALES_AGENT.idFromName === "function") {
      try {
        const doId = c.env.SALES_AGENT.idFromName(leadId);
        const stub = c.env.SALES_AGENT.get(doId);

        const syntheticPrompt = body.initial_message ||
          `[ALTA SIEM CANACO]: Se ha registrado el comercio '${despachoNombre}' (${email}, ${tamano} colaboradores). ` +
          `Su Landing Page de Ark Commerce ($299/mes regular) ha sido asignada al 100% sin costo como beneficio gremial SIEM. ` +
          `Dale la bienvenida a la CANACO, confirma la activación de su landing/tienda, y explícale que tiene a su disposición las 20 herramientas fiscales y financieras de Ark Ledger sin costo con Noah AI, y preséntale el Plan PRO Despacho ($399 MXN/mes) para emitir papeles oficiales Carta y sellar con SHA-256 ante el SAT.`;

        const doRes = await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            message: syntheticPrompt,
            email,
            despacho_nombre: despachoNombre,
            tamano,
          }),
        });

        if (doRes.ok) {
          const doData: any = await doRes.json();
          salesAgentTriggered = true;
          agentWelcomeMessage = doData.response || null;
          specialistAssigned = doData.agente_id || "intake";
          toolsCalled = doData.tools_called || [];
        } else {
          console.warn("[leads/ingest] SalesAgent respondió con status:", doRes.status);
        }
      } catch (doErr) {
        console.warn("[leads/ingest] Error despertando SalesAgent DO:", doErr);
      }
    }

    return c.json({
      success: true,
      lead_id: leadId,
      account_id: accountId,
      contact_id: contactId,
      opportunity_id: oppId,
      origin,
      vertical,
      destination,
      sales_agent_triggered: salesAgentTriggered,
      specialist_assigned: specialistAssigned,
      agent_welcome_message: agentWelcomeMessage,
      tools_called: toolsCalled,
      message: "Alta de SIEM CANACO recibida exitosamente y SalesAgent activado.",
    }, 200);
  } catch (err: any) {
    console.error("[leads/ingest] Error general:", err);
    return c.json({ error: err.message || "Error procesando ingesta de lead" }, 500);
  }
});

/**
 * 3. Endpoint de Ingesta de Contexto (/api/internal/context)
 * Grok Bot consulta este endpoint para obtener el Resumen Ejecutivo del Cliente
 * antes de abrir el CRM o interactuar con el prospecto en la computadora.
 */
internalRouter.get("/context", async (c) => {
  const leadIdRaw = c.req.query("lead_id");
  const leadIdParsed = z.string().min(1).safeParse(leadIdRaw);
  if (!leadIdParsed.success) {
    return c.json({ error: "El parÃ¡metro query 'lead_id' es obligatorio." }, 400);
  }
  const leadId = leadIdParsed.data;
  if (!leadId) {
    return c.json({ error: "El parÃ¡metro query 'lead_id' es obligatorio." }, 400);
  }
  return handleGetContext(leadId, c.env);
});

internalRouter.post("/context", async (c) => {
  try {
    const body = await c.req.json();
    const leadIdRaw = body.lead_id || c.req.query("lead_id");
    const leadIdParsed = z.string().min(1).safeParse(leadIdRaw);
    if (!leadIdParsed.success) {
      return c.json({ error: "El campo 'lead_id' es obligatorio en el body o query." }, 400);
    }
    const leadId = leadIdParsed.data;
    if (!leadId) {
      return c.json({ error: "El campo 'lead_id' es obligatorio en el body o query." }, 400);
    }
    return handleGetContext(leadId, c.env);
  } catch (err: any) {
    return c.json({ error: err.message || "Invalid JSON" }, 400);
  }
});

async function handleGetContext(leadId: string, env: Env) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "D1 no disponible" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  // 1. Obtener registro del lead
  const lead = await env.DB.prepare(`
    SELECT * FROM sales_leads WHERE id = ?
  `).bind(leadId).first<any>();

  if (!lead) {
    return new Response(JSON.stringify({ error: `Lead con ID '${leadId}' no encontrado.` }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  // 2. Obtener historial de conversaciones
  const { results: conversations } = await env.DB.prepare(`
    SELECT id, agente_id, role, content, timestamp
    FROM sales_conversations
    WHERE lead_id = ?
    ORDER BY timestamp ASC
  `).bind(leadId).all<any>();

  // 3. Sintetizar el Resumen Ejecutivo para Grok Bot
  const convList = conversations || [];
  const totalInteractions = convList.length;
  const lastInteraction = convList[convList.length - 1]?.content || "Sin interacciÃ³n previa";

  const executiveBrief = `RESUMEN EJECUTIVO PARA GROK BOT:
- Despacho: ${lead.despacho_nombre || "Despacho Contable"}
- Titular/Contacto: ${lead.email}
- TamaÃ±o: ${lead.tamano || "No especificado"} colaboradores.
- Dolor Principal Detectado: ${lead.dolor_detectado || "General"}.
- Especialista Asignado: ${lead.especialista_asignado}.
- Estado Comercial: ${lead.estado} (Score: ${lead.score}/100).
- Total de Interacciones: ${totalInteractions}.
- Ãltimo Mensaje Clave: "${lastInteraction}".
- Directriz Operativa: Proponer el Paquete Enterprise (Ark Angel cobranza IA + Ark Ledger cierre fiscal desde $6,000 MXN) con base de consumo sugerida ($8,000 - $12,000 MXN/mes).`;

  const contextResponse: LeadExecutiveContext = {
    lead_id: lead.id,
    email: lead.email,
    despacho_nombre: lead.despacho_nombre,
    tamano: lead.tamano,
    dolor_detectado: lead.dolor_detectado,
    especialista_asignado: lead.especialista_asignado,
    estado: lead.estado,
    score: lead.score,
    conversation_summary: lead.conversation_summary,
    conversations: convList,
    executive_brief: executiveBrief,
  };

  return new Response(JSON.stringify(contextResponse), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Validador de nombre real de despacho (filtro anti-basura y nombres genéricos de DENUE)
 */
export function isGenericFirmName(name: string | null | undefined): boolean {
  if (!name || typeof name !== "string") return true;
  const cleaned = name.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\-_/\\()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return true;
  const genericExact = new Set([
    "despacho", "despacho contable", "despachos", "contabilidad", "contable",
    "contador", "contadores", "asesoria", "asesorias", "consultoria", "consultorias",
    "consultores", "abogados", "sin nombre", "corporativo", "unknown", "n a", "na", "null", "none",
    "asesoria contable", "asesoria fiscal", "servicios contables", "despacho sc", "s n", "sn", "no aplica", "desconocido"
  ]);
  if (genericExact.has(cleaned)) return true;
  const stripped = cleaned
    .replace(/^(despacho\s+contable|despacho|contabilidad|contadores|contador|asesoria|consultoria)\s*/g, "")
    .replace(/\s*(despacho\s+contable|despacho|contabilidad|contadores|contador|asesoria|consultoria)$/g, "")
    .trim();
  if (stripped.length === 0) return true;
  return false;
}

/**
 * Validador de formato real de email (rechaza placeholders, dominios falsos y sintaxis errónea)
 */
export function isValidEmailFormat(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;
  if (
    trimmed.includes("@harvest.arksystems.local") ||
    trimmed.endsWith("@example.com") ||
    trimmed.endsWith(".example.com") ||
    trimmed.includes("example.com") ||
    trimmed.includes("@test.com") ||
    trimmed.includes("@placeholder.com") ||
    trimmed.includes("noemail") ||
    trimmed.includes("sincorreo") ||
    trimmed.includes("noreply") ||
    trimmed.includes("no-reply")
  ) {
    return false;
  }
  return true;
}

/**
 * Validador de esquemas de salida (JSON Schema Contract) para las Habilidades de StayPuft y Grok Bot
 */
export function validateSkillResult(skillName: string, result: any, operator: string = "staypuft"): { success: boolean; error?: string } {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { success: false, error: "El resultado debe ser un objeto JSON válido." };
  }

  if (skillName === "research_prospect_web") {
    // Para Grok Bot mantenemos su comportamiento histórico estricto e intacto
    if (operator === "grok_bot") {
      if (typeof result.tamano_estimado !== "string" || !result.tamano_estimado.trim()) {
        return { success: false, error: "Campo requerido 'tamano_estimado' es obligatorio y debe ser texto." };
      }
      if (!Array.isArray(result.fuentes) || result.fuentes.length === 0) {
        return { success: false, error: "Campo requerido 'fuentes' es obligatorio y debe ser un arreglo con al menos 1 fuente." };
      }
      if (typeof result.confianza !== "number" || result.confianza < 0 || result.confianza > 100) {
        return { success: false, error: "Campo requerido 'confianza' es obligatorio y debe ser un número entre 0 y 100." };
      }
      return { success: true };
    }

    // Para StayPuft aplicamos el esquema extendido compatible hacia atrás (Misión Parte 2)
    const isDescartar = result.descartar === true;

    if (result.descartar !== undefined && typeof result.descartar !== "boolean") {
      return { success: false, error: "Campo 'descartar' debe ser booleano (true/false)." };
    }
    if (result.motivo_descarte !== undefined && result.motivo_descarte !== null && typeof result.motivo_descarte !== "string") {
      return { success: false, error: "Campo 'motivo_descarte' debe ser texto o null." };
    }
    if (isDescartar && (!result.motivo_descarte || !String(result.motivo_descarte).trim())) {
      return { success: false, error: "Si 'descartar' es true, 'motivo_descarte' es obligatorio." };
    }

    if (result.email_valid !== undefined && typeof result.email_valid !== "boolean") {
      return { success: false, error: "Campo 'email_valid' debe ser booleano (true/false)." };
    }

    if (result.website_url !== undefined && result.website_url !== null && typeof result.website_url !== "string") {
      return { success: false, error: "Campo 'website_url' debe ser texto o null." };
    }

    if (result.linkedin_url !== undefined && result.linkedin_url !== null && typeof result.linkedin_url !== "string") {
      return { success: false, error: "Campo 'linkedin_url' debe ser texto o null." };
    }

    if (result.software_detectado !== undefined && result.software_detectado !== null &&
        typeof result.software_detectado !== "string" && !Array.isArray(result.software_detectado)) {
      return { success: false, error: "Campo 'software_detectado' debe ser texto, arreglo de textos o null." };
    }

    const validTamanos = new Set(["1-5", "6-20", "21-50", "50+", "desconocido"]);
    if (result.tamano !== undefined && result.tamano !== null && !validTamanos.has(result.tamano)) {
      return { success: false, error: "Campo 'tamano' debe ser uno de: '1-5', '6-20', '21-50', '50+', 'desconocido'." };
    }
    if (result.tamano_estimado !== undefined && typeof result.tamano_estimado !== "string") {
      return { success: false, error: "Campo 'tamano_estimado' debe ser texto." };
    }

    const rawConf = result.confidence !== undefined ? result.confidence : result.confianza;
    if (rawConf !== undefined && (typeof rawConf !== "number" || rawConf < 0 || rawConf > 100)) {
      return { success: false, error: "Campo 'confidence'/'confianza' debe ser un número entre 0 y 100." };
    }

    // Campos de Teléfono y WhatsApp para Enriquecimiento StayPuft (Nov 2026)
    if (result.telefono !== undefined && result.telefono !== null && typeof result.telefono !== "string") {
      return { success: false, error: "Campo 'telefono' debe ser texto (E.164) o null." };
    }

    if (result.whatsapp !== undefined && result.whatsapp !== null && typeof result.whatsapp !== "string") {
      return { success: false, error: "Campo 'whatsapp' debe ser texto (E.164) o null." };
    }

    if (result.whatsapp_valid !== undefined && typeof result.whatsapp_valid !== "boolean") {
      return { success: false, error: "Campo 'whatsapp_valid' debe ser booleano (true/false)." };
    }

    const validPhoneSources = new Set(["website", "google_maps", "facebook", "denue", "directorio", "otro", "ninguno"]);
    if (result.fuente_telefono !== undefined && result.fuente_telefono !== null && !validPhoneSources.has(result.fuente_telefono)) {
      return { success: false, error: "Campo 'fuente_telefono' debe ser uno de: 'website', 'google_maps', 'facebook', 'denue', 'directorio', 'otro', 'ninguno'." };
    }

    if (result.telefono_url !== undefined && result.telefono_url !== null && typeof result.telefono_url !== "string") {
      return { success: false, error: "Campo 'telefono_url' debe ser texto o null." };
    }

    if (result.telefono_verificado !== undefined && typeof result.telefono_verificado !== "boolean") {
      return { success: false, error: "Campo 'telefono_verificado' debe ser booleano (true/false)." };
    }

    if (result.sin_whatsapp !== undefined && typeof result.sin_whatsapp !== "boolean") {
      return { success: false, error: "Campo 'sin_whatsapp' debe ser booleano (true/false)." };
    }

    // Para leads no descartados se requiere al menos confianza y tamaño
    if (!isDescartar) {
      if (rawConf === undefined) {
        return { success: false, error: "Campo requerido 'confidence' o 'confianza' es obligatorio (0-100)." };
      }
      if (!result.tamano && !result.tamano_estimado) {
        return { success: false, error: "Campo 'tamano' o 'tamano_estimado' es obligatorio para prospectos no descartados." };
      }
    }

    return { success: true };
  }

  if (skillName === "generate_custom_pdf") {
    if (typeof result.pdf_url_o_id !== "string" || !result.pdf_url_o_id.trim()) {
      return { success: false, error: "Campo requerido 'pdf_url_o_id' es obligatorio y debe ser texto." };
    }
    if (!result.calculo_resumen || typeof result.calculo_resumen !== "object" || Array.isArray(result.calculo_resumen)) {
      return { success: false, error: "Campo requerido 'calculo_resumen' es obligatorio y debe ser un objeto proveniente de Ark Ledger." };
    }
    if (typeof result.sello_sha256 !== "string" || !result.sello_sha256.trim()) {
      return { success: false, error: "Campo requerido 'sello_sha256' es obligatorio y debe contener el hash SHA-256." };
    }
    if (typeof result.qr_payload !== "string" || !result.qr_payload.trim()) {
      return { success: false, error: "Campo requerido 'qr_payload' es obligatorio." };
    }
    return { success: true };
  }

  if (skillName === "tag_prospect_on_x") {
    if (typeof result.lead_creado !== "boolean") {
      return { success: false, error: "Campo requerido 'lead_creado' es obligatorio y debe ser booleano (true/false)." };
    }
    if (typeof result.lead_id !== "string" || !result.lead_id.trim()) {
      return { success: false, error: "Campo requerido 'lead_id' es obligatorio." };
    }
    if (typeof result.borrador_respuesta !== "string" || !result.borrador_respuesta.trim()) {
      return { success: false, error: "Campo requerido 'borrador_respuesta' es obligatorio." };
    }
    if (typeof result.vertical_sugerida !== "string" || !result.vertical_sugerida.trim()) {
      return { success: false, error: "Campo requerido 'vertical_sugerida' es obligatorio." };
    }
    return { success: true };
  }

  return { success: true };
}

/**
 * 4. Endpoint para Ejecución y Reporte de Skills (/api/internal/skills/execute)
 * - StayPuft: Reporta resultado { lead_id, skill, result, status } validando JSON Schema antes de guardar.
 * - Grok Bot: Solicita instrucción para runner físico { skill_name, payload }.
 */
internalRouter.post("/skills/execute", async (c) => {
  try {
    const body = await c.req.json();
    const { skill_name, skill: rawSkill, payload, result, status, lead_id, error: execError } = body;
    const effectiveSkill = skill_name || rawSkill;

    // CASO A: Reporte de Resultado de StayPuft (o callback agéntico de completion)
    if (result !== undefined || (status && (status === "completed" || status === "failed"))) {
      if (!effectiveSkill || typeof effectiveSkill !== "string") {
        return c.json({ error: "El campo 'skill' o 'skill_name' es obligatorio y debe ser texto." }, 400);
      }
      if (!lead_id || typeof lead_id !== "string") {
        return c.json({ error: "El campo 'lead_id' es obligatorio para registrar la ejecución." }, 400);
      }

      if (!c.env.DB) {
        return c.json({ error: "D1 no disponible" }, 503);
      }

      const operator = c.get("operator") || "staypuft";
      const normalizedStatus = status === "completed" || status === "success" ? "completed" : "failed";

      // 1. Si el estado es completed, validar contra el JSON Schema / contrato de la skill
      if (normalizedStatus === "completed") {
        const val = validateSkillResult(effectiveSkill, result, operator);
        if (!val.success) {
          return c.json({
            error: `Validación de JSON Schema fallida para la skill '${effectiveSkill}': ${val.error}`,
            skill: effectiveSkill,
          }, 400);
        }
      }

      // 2. Manejo de reintentos y Circuit Breaker (Máximo 3 reintentos antes de estado failed permanente)
      let finalTaskStatus = normalizedStatus;
      let currentRetries = 0;

      const existingTask = await c.env.DB.prepare(`
        SELECT id, retry_count, status FROM agent_tasks
        WHERE lead_id = ? AND skill_name = ? AND status IN ('pending', 'running')
        ORDER BY created_at DESC LIMIT 1
      `).bind(lead_id, effectiveSkill).first<any>();

      if (normalizedStatus === "failed") {
        currentRetries = (existingTask?.retry_count || 0) + 1;
        finalTaskStatus = currentRetries >= 3 ? "failed" : "pending";
      }

      const taskId = existingTask?.id || `task_${crypto.randomUUID().slice(0, 12)}`;

      if (existingTask) {
        await c.env.DB.prepare(`
          UPDATE agent_tasks
          SET status = ?,
              retry_count = ?,
              result = ?,
              error_message = ?,
              finished_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          finalTaskStatus,
          currentRetries,
          result ? JSON.stringify(result) : null,
          execError || (normalizedStatus === "failed" ? "Skill execution failed" : null),
          existingTask.id
        ).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO agent_tasks (
            id, lead_id, skill_name, operator, payload, status, retry_count, result, error_message, finished_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          taskId,
          lead_id,
          effectiveSkill,
          operator,
          payload ? JSON.stringify(payload) : null,
          finalTaskStatus,
          currentRetries,
          result ? JSON.stringify(result) : null,
          execError || (normalizedStatus === "failed" ? "Skill execution failed" : null)
        ).run();
      }

      // 3. Registrar en agent_skill_runs (Auditoría inmutable de ejecuciones agénticas)
      const runId = `run_${crypto.randomUUID().slice(0, 12)}`;
      await c.env.DB.prepare(`
        INSERT INTO agent_skill_runs (
          id, task_id, lead_id, skill_name, operator, status, input_payload, output_result, error_message, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        runId,
        taskId,
        lead_id,
        effectiveSkill,
        operator,
        normalizedStatus,
        payload ? JSON.stringify(payload) : null,
        result ? JSON.stringify(result) : null,
        execError || null
      ).run();

      // 4. Si la skill fue completada exitosamente, persistir en D1
      if (normalizedStatus === "completed" && result) {
        if (effectiveSkill === "research_prospect_web") {
          if (result.descartar === true) {
            const reason = result.motivo_descarte || "descarte_staypuft";
            await c.env.DB.prepare(`
              UPDATE sales_leads
              SET estado = 'descartado',
                  conversation_summary = COALESCE(conversation_summary, '') || ' [staypuft_descartado: ' || ? || ']',
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(reason, lead_id).run();
          } else {
            const effectiveSize = result.tamano || result.tamano_estimado || "1-5";
            const techList = Array.isArray(result.software_detectado) ? result.software_detectado.join(", ") : (result.software_detectado || "");
            const partnersList = Array.isArray(result.socios) ? result.socios.join(", ") : "";
            const painList = Array.isArray(result.senales_dolor) ? result.senales_dolor.join(", ") : "";
            const confVal = result.confidence !== undefined ? result.confidence : (result.confianza || 0);
            const fuentesList = Array.isArray(result.fuentes) ? result.fuentes.join(", ") : (result.website_url || "web");

            // Normalización y guardado de teléfono / WhatsApp para StayPuft
            const telInput = result.telefono || result.whatsapp || null;
            const telNorm = normalizeMexicanPhone(telInput);
            const finalPhone = telNorm.telefono || (typeof result.telefono === "string" ? result.telefono : null);
            const finalWa = telNorm.whatsapp || (typeof result.whatsapp === "string" ? result.whatsapp : null);

            let phoneSummary = "";
            if (finalPhone || finalWa) {
              phoneSummary = ` Tel: ${finalPhone || "N/D"}. WhatsApp: ${finalWa || "N/D"} (fuente: ${result.fuente_telefono || "web"}).`;
            }

            const summaryAdd = ` [staypuft_autonomous_research] Tamaño: ${effectiveSize}.${phoneSummary} Tech: ${techList || "N/D"}. Socios: ${partnersList || "N/D"}. Dolor: ${painList || "N/D"}. Confianza: ${confVal}%. Fuentes: ${fuentesList}.`;

            if (finalPhone) {
              await c.env.DB.prepare(`
                UPDATE sales_leads
                SET tamano = ?,
                    conversation_summary = COALESCE(conversation_summary, '') || ?,
                    phone = COALESCE(?, phone),
                    score = MIN(100, score + 15),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(effectiveSize, summaryAdd, finalPhone, lead_id).run();
            } else {
              await c.env.DB.prepare(`
                UPDATE sales_leads
                SET tamano = ?,
                    conversation_summary = COALESCE(conversation_summary, '') || ?,
                    score = MIN(100, score + 15),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(effectiveSize, summaryAdd, lead_id).run();
            }

            // Persistir teléfono y WhatsApp en sales_contacts para uso directo en WhatsApp Studio
            if (finalPhone || finalWa) {
              try {
                const leadRow = await c.env.DB.prepare(
                  "SELECT account_id, contact_id, email, despacho_nombre FROM sales_leads WHERE id = ?"
                ).bind(lead_id).first<any>();

                if (leadRow?.contact_id) {
                  await c.env.DB.prepare(`
                    UPDATE sales_contacts
                    SET phone = COALESCE(?, phone),
                        whatsapp = COALESCE(?, whatsapp),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                  `).bind(finalPhone, finalWa, leadRow.contact_id).run();
                } else if (leadRow?.account_id) {
                  const existingCt = await c.env.DB.prepare(
                    "SELECT id FROM sales_contacts WHERE account_id = ? LIMIT 1"
                  ).bind(leadRow.account_id).first<any>();

                  if (existingCt?.id) {
                    await c.env.DB.prepare(`
                      UPDATE sales_contacts
                      SET phone = COALESCE(?, phone),
                          whatsapp = COALESCE(?, whatsapp),
                          updated_at = CURRENT_TIMESTAMP
                      WHERE id = ?
                    `).bind(finalPhone, finalWa, existingCt.id).run();
                  } else {
                    const newCtId = `cnt_${crypto.randomUUID().slice(0, 12)}`;
                    await c.env.DB.prepare(`
                      INSERT INTO sales_contacts (
                        id, account_id, name, email, phone, whatsapp, title, created_at, updated_at
                      ) VALUES (?, ?, ?, ?, ?, ?, 'Contacto Principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `).bind(newCtId, leadRow.account_id, leadRow.despacho_nombre || "Contacto Principal", leadRow.email || null, finalPhone, finalWa).run();

                    await c.env.DB.prepare("UPDATE sales_leads SET contact_id = ? WHERE id = ?").bind(newCtId, lead_id).run();
                  }
                }

                // Registrar señal WHATSAPP_CORPORATIVO en sales_observations si whatsapp es válido
                if (telNorm.whatsapp_valid || result.whatsapp_valid === true) {
                  const targetAccountId = leadRow?.account_id || lead_id;
                  const obsId = `obs_${crypto.randomUUID().slice(0, 12)}`;
                  await c.env.DB.prepare(`
                    INSERT OR IGNORE INTO sales_observations (
                      id, account_id, signal_code, observation_value, confidence, created_at
                    ) VALUES (?, ?, 'WHATSAPP_CORPORATIVO', ?, 1.0, CURRENT_TIMESTAMP)
                  `).bind(obsId, targetAccountId, finalWa || finalPhone).run();
                }
              } catch (e) {
                console.error("[skills/execute] Error persistiendo contacto WhatsApp:", e);
              }
            }
          }
        } else if (effectiveSkill === "generate_custom_pdf") {
          const actId = `act_${crypto.randomUUID().slice(0, 12)}`;
          await c.env.DB.prepare(`
            INSERT INTO sales_activities (id, lead_id, type, content, metadata, created_at)
            VALUES (?, ?, 'system', 'Reporte fiscal PDF generado por StayPuft con cálculo Ark Ledger', ?, CURRENT_TIMESTAMP)
          `).bind(actId, lead_id, JSON.stringify(result)).run();
        } else if (effectiveSkill === "tag_prospect_on_x") {
          const actId = `act_${crypto.randomUUID().slice(0, 12)}`;
          await c.env.DB.prepare(`
            INSERT INTO sales_activities (id, lead_id, type, content, metadata, created_at)
            VALUES (?, ?, 'note', 'Borrador de interacción en X preparado por StayPuft (humano en el circuito, no publicado)', ?, CURRENT_TIMESTAMP)
          `).bind(actId, lead_id, JSON.stringify(result)).run();
        }
      }

      return c.json({
        success: normalizedStatus === "completed",
        lead_id,
        skill: effectiveSkill,
        task_id: taskId,
        run_id: runId,
        status: finalTaskStatus,
        retry_count: currentRetries,
        saved: true,
      }, 200);
    }

    // CASO B: Solicitud de Instrucción para Grok Bot (Compatibilidad Retenida)
    if (!effectiveSkill || typeof effectiveSkill !== "string") {
      return c.json({ error: "El campo 'skill_name' es obligatorio y debe ser texto." }, 400);
    }

    if (!c.env.DB) {
      return c.json({ error: "D1 no disponible" }, 503);
    }

    // 1. Consultar si la skill está registrada y activa en agent_skills (LIMIT 1)
    const skill = await c.env.DB.prepare(`
      SELECT * FROM agent_skills
      WHERE skill_name = ? AND is_active = 1
      ORDER BY CASE WHEN operator = 'grok_bot' THEN 0 ELSE 1 END
      LIMIT 1
    `).bind(effectiveSkill).first<AgentSkill>();

    if (!skill) {
      return c.json({
        error: `Skill '${effectiveSkill}' no encontrada o inactiva en el registro de habilidades de Grok Bot.`,
        available_skills_endpoint: "/api/internal/skills",
      }, 404);
    }

    // 2. Validar campos requeridos según input_schema si existe
    if (skill.input_schema) {
      try {
        const schema = JSON.parse(skill.input_schema);
        if (schema.required && Array.isArray(schema.required)) {
          const payloadObj = payload || {};
          const missingFields = schema.required.filter((field: string) => payloadObj[field] === undefined || payloadObj[field] === null);
          if (missingFields.length > 0) {
            return c.json({
              error: `Payload incompleto para skill '${effectiveSkill}'. Faltan campos requeridos: ${missingFields.join(", ")}`,
              required_fields: schema.required,
              schema,
            }, 400);
          }
        }
      } catch (schemaErr) {
        console.warn("[skills/execute] Error parseando input_schema:", schemaErr);
      }
    }

    // 3. Generar la instrucción operativa para Grok Bot
    const jobId = `job_grok_${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    return c.json({
      status: "ready_for_grok_execution",
      job_id: jobId,
      skill_id: skill.id,
      agent_id: skill.agent_id,
      skill_name: skill.skill_name,
      description: skill.description,
      execution_path: skill.execution_path,
      target_url: skill.execution_path.startsWith("http")
        ? skill.execution_path
        : `https://sales.arksystems.site${skill.execution_path}`,
      payload: payload || {},
      created_at: timestamp,
      grok_instruction: {
        role: "grok_computer_operator",
        action: `Ejecutar la tarea autónoma '${skill.skill_name}' en la computadora compartida.`,
        guidance: skill.description,
      },
    }, 200);
  } catch (err: any) {
    console.error("[skills/execute] Error:", err);
    return c.json({ error: err.message || "Error procesando ejecución de skill" }, 500);
  }
});

/**
 * Endpoint de descubrimiento de Habilidades (/api/internal/skills)
 * Paginado estrictamente a un máximo de 100 registros para proteger cuota D1.
 */
internalRouter.get("/skills", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  const limitRaw = c.req.query("limit");
  const limit = Math.min(Math.max(1, parseInt(limitRaw || "50", 10) || 50), 100);
  const operator = c.req.query("operator") || c.get("operator");

  let query = "SELECT * FROM agent_skills WHERE is_active = 1";
  const params: any[] = [];
  if (operator) {
    query += " AND (operator = ? OR operator IS NULL)";
    params.push(operator);
  }
  query += " ORDER BY operator, skill_name LIMIT ?";
  params.push(limit);

  const stmt = c.env.DB.prepare(query);
  const { results: skills } = await (params.length === 2 ? stmt.bind(params[0], params[1]) : stmt.bind(params[0])).all<AgentSkill>();

  return c.json({
    count: skills ? skills.length : 0,
    limit,
    skills: skills || [],
  });
});

/**
 * Endpoint de Tareas Pendientes (/api/internal/skills/pending)
 * - StayPuft & Grok Bot: Consulta la siguiente tarea pendiente con lead_id, skill, payload y created_at.
 * - Si no hay nada, responde vacío ({}), no error (200 OK).
 * - Protegido con LIMIT 1 y máximo 100 para evitar consumo excesivo de D1.
 */
internalRouter.get("/skills/pending", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  try {
    const operator = c.req.query("operator") || c.get("operator") || "staypuft";

    // 1. Buscar en agent_tasks tareas con status 'pending' que no hayan excedido 3 fallos
    const task = await c.env.DB.prepare(`
      SELECT id, lead_id, skill_name, payload, created_at, retry_count
      FROM agent_tasks
      WHERE (operator = ? OR operator IS NULL)
        AND status = 'pending'
        AND retry_count < 3
      ORDER BY created_at ASC
      LIMIT 1
    `).bind(operator).first<any>();

    if (task) {
      await c.env.DB.prepare(`
        UPDATE agent_tasks
        SET status = 'running', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(task.id).run();

      let parsedPayload: any = {};
      try {
        parsedPayload = task.payload ? JSON.parse(task.payload) : {};
      } catch {
        parsedPayload = {};
      }

      return c.json({
        task_id: task.id,
        lead_id: task.lead_id,
        skill: task.skill_name,
        skill_name: task.skill_name,
        payload: parsedPayload,
        created_at: task.created_at,
        job: {
          lead_id: task.lead_id,
          despacho_nombre: parsedPayload.despacho_nombre || "",
          skill_name: task.skill_name,
        },
      }, 200);
    }

    // 2. Si no hay en cola agent_tasks, buscar un lead con nombre de despacho pendiente de enriquecer
    const lead = await c.env.DB.prepare(`
      SELECT id, despacho_nombre, email
      FROM sales_leads
      WHERE despacho_nombre IS NOT NULL 
        AND despacho_nombre != ''
        AND (
          conversation_summary IS NULL
          OR (
            conversation_summary NOT LIKE '%grok_bot_autonomous_research%'
            AND conversation_summary NOT LIKE '%staypuft_autonomous_research%'
          )
        )
      ORDER BY created_at DESC
      LIMIT 1
    `).first<{ id: string; despacho_nombre: string; email: string }>();

    if (!lead) {
      // Req 2: "Si no hay nada, responde vacío, no error."
      return c.json({}, 200);
    }

    const payloadObj = {
      lead_id: lead.id,
      despacho_nombre: lead.despacho_nombre,
      email: lead.email,
    };

    return c.json({
      lead_id: lead.id,
      skill: "research_prospect_web",
      skill_name: "research_prospect_web",
      payload: payloadObj,
      created_at: new Date().toISOString(),
      job: {
        lead_id: lead.id,
        despacho_nombre: lead.despacho_nombre,
        skill_name: "research_prospect_web",
      },
    }, 200);
  } catch (err: any) {
    console.error("[skills/pending] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Endpoint de Encolado de Cohorte para Operador (/api/internal/agent-tasks/enqueue-cohort)
 * Encola un lote acotado (máx 20 por defecto) de leads filtrados con validaciones fail-closed:
 * 1. SCIAN 541211 o 541212
 * 2. Ciudad Mérida, Yucatán
 * 3. despacho_nombre real, no nulo, no genérico
 * 4. Email válido y no duplicado
 * 5. Idempotente: omite si ya existe en agent_tasks en cualquier estado
 * 6. Excluye leads SIPRES / SOFOM
 */
internalRouter.post("/agent-tasks/enqueue-cohort", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const cohortId = body.cohort_slug || body.cohort_id || "ark_ledger_despachos";
    const skillName = body.skill_name || "research_prospect_web";
    const operator = body.operator || c.get("operator") || "staypuft";
    const limit = Math.min(Math.max(parseInt(body.limit ?? "20", 10) || 20, 1), 100);

    if (cohortId !== "ark_ledger_despachos") {
      return c.json({ error: "Cohorte no permitida. Solo 'ark_ledger_despachos' está autorizada para este flujo." }, 400);
    }
    if (skillName !== "research_prospect_web") {
      return c.json({ error: "Skill no permitida. Solo 'research_prospect_web' está autorizada para este flujo." }, 400);
    }

    // Consulta de candidatos con tope estricto de 100 registros en D1
    const candidateQuery = `
      SELECT a.id as account_id, a.name as account_name, a.scian_code, a.city, a.tenant_id, a.origin, a.created_at,
             l.id as lead_id, l.email as lead_email, l.despacho_nombre, l.estado as lead_estado,
             c.email as contact_email, c.name as contact_name
      FROM sales_accounts a
      LEFT JOIN sales_leads l ON (l.account_id = a.id OR l.id = a.id)
      LEFT JOIN sales_contacts c ON (c.account_id = a.id)
      WHERE (a.scian_code IN ('541211', '541212') OR l.dolor_detectado = 'fiscal')
        AND (a.city LIKE '%merida%' OR a.city LIKE '%mérida%' OR a.city LIKE '%yucat%')
        AND (a.id NOT LIKE '%sipres%' AND a.name NOT LIKE '%sofom%' AND a.name NOT LIKE '%s.a.p.i.%')
      ORDER BY a.created_at ASC
      LIMIT 100
    `;

    const { results } = await c.env.DB.prepare(candidateQuery).all();
    const candidateRows = results || [];

    const enqueued: Array<{ task_id: string; lead_id: string; despacho_nombre: string; email: string }> = [];
    const skipped: Array<{ lead_id: string; reason: string }> = [];
    const seenEmails = new Set<string>();

    for (const row of candidateRows) {
      if (enqueued.length >= limit) break;

      const leadId = String(row.lead_id || row.account_id);
      const firmName = String(row.despacho_nombre || row.account_name || "").trim();
      const email = String(row.lead_email || row.contact_email || "").trim().toLowerCase();
      const scian = String(row.scian_code || "").trim();
      const city = String(row.city || "").toLowerCase();

      // Filtro 1: SCIAN
      if (scian !== "541211" && scian !== "541212") {
        skipped.push({ lead_id: leadId, reason: "scian_no_es_541211_o_541212" });
        continue;
      }

      // Filtro 2: Ciudad Mérida
      if (!city.includes("merida") && !city.includes("mérida") && !city.includes("yucat")) {
        skipped.push({ lead_id: leadId, reason: "ciudad_no_merida" });
        continue;
      }

      // Filtro 3: No SOFOM / SIPRES
      if (leadId.toLowerCase().includes("sipres") || firmName.toLowerCase().includes("sofom") || firmName.toLowerCase().includes("s.a.p.i.")) {
        skipped.push({ lead_id: leadId, reason: "origen_sipres_sofom" });
        continue;
      }

      // Filtro 4: Nombre real (no nulo, no genérico)
      if (isGenericFirmName(firmName)) {
        skipped.push({ lead_id: leadId, reason: "nombre_generico" });
        continue;
      }

      // Filtro 5: Email válido y real
      if (!isValidEmailFormat(email)) {
        skipped.push({ lead_id: leadId, reason: "email_invalido_o_placeholder" });
        continue;
      }

      // Filtro 6: Deduplicación en el lote
      if (seenEmails.has(email)) {
        skipped.push({ lead_id: leadId, reason: "email_duplicado_en_lote" });
        continue;
      }

      // Filtro 7: Idempotencia - No estar ya en agent_tasks con staypuft o grok_bot en ningún estado
      const existingTask = await c.env.DB.prepare(`
        SELECT id, operator, status FROM agent_tasks
        WHERE lead_id = ? AND skill_name = ?
        LIMIT 1
      `).bind(leadId, skillName).first<any>();

      if (existingTask) {
        skipped.push({ lead_id: leadId, reason: "tarea_ya_existente" });
        continue;
      }

      // Crear la tarea en agent_tasks
      const taskId = `task_${crypto.randomUUID()}`;
      const payloadObj = {
        lead_id: leadId,
        account_id: row.account_id,
        despacho_nombre: firmName,
        email: email,
        city: row.city || "Mérida, Yucatán",
        scian_code: scian,
        tenant_id: "acc_ark_ledger"
      };

      await c.env.DB.prepare(`
        INSERT INTO agent_tasks (
          id, lead_id, skill_name, operator, payload, status, retry_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(taskId, leadId, skillName, operator, JSON.stringify(payloadObj)).run();

      seenEmails.add(email);
      enqueued.push({
        task_id: taskId,
        lead_id: leadId,
        despacho_nombre: firmName,
        email: email,
      });
    }

    return c.json({
      success: true,
      cohort_id: cohortId,
      skill_name: skillName,
      operator,
      limit,
      count: enqueued.length,
      enqueued,
      skipped,
    }, 200);
  } catch (err: any) {
    console.error("[agent-tasks/enqueue-cohort] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Endpoint de Enriquecimiento (/api/internal/leads/:lead_id/enrich)
 * Recibe los datos extraÃ­dos por grok_bot_computer_runner.py y los persiste en D1 y Durable Objects.
 */
internalRouter.post("/leads/:lead_id/enrich", async (c) => {
  const leadId = c.req.param("lead_id");
  if (!leadId) {
    return c.json({ error: "lead_id es obligatorio en la ruta." }, 400);
  }

  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  try {
    const body = await c.req.json();
    const enrichment = body.enrichment || {};

    // 1. Obtener lead actual (LIMIT 1)
    const currentLead = await c.env.DB.prepare(`
      SELECT * FROM sales_leads WHERE id = ? LIMIT 1
    `).bind(leadId).first<any>();

    if (!currentLead) {
      return c.json({ error: `Lead con ID '${leadId}' no encontrado.` }, 404);
    }

    // 2. Soportar formato plano de StayPuft y anidado de Grok Bot
    const estimatedSize = body.tamano_estimado || body.tamano || enrichment.estimated_size || currentLead.tamano || "1-5";
    const detectedTech: string[] = body.software_detectado || enrichment.detected_tech || [];
    const partners: string[] = body.socios || [];
    const painSignals: string[] = body.senales_dolor || [];
    const sources: string[] = body.fuentes || [];
    const confidence = typeof body.confianza === "number"
      ? body.confianza
      : (typeof enrichment.confidence_score === "number" ? enrichment.confidence_score * 100 : 80);
    const summaryText = body.resumen || enrichment.research_summary || "Investigación completada.";

    const operator = c.get("operator") || "staypuft";
    const tagPrefix = operator === "grok_bot" ? "grok_bot_autonomous_research" : "staypuft_autonomous_research";

    const techStr = detectedTech.length > 0 ? ` Tecnologías: ${detectedTech.join(", ")}.` : "";
    const partnersStr = partners.length > 0 ? ` Socios: ${partners.join(", ")}.` : "";
    const painStr = painSignals.length > 0 ? ` Señales de dolor: ${painSignals.join(", ")}.` : "";
    const sourcesStr = sources.length > 0 ? ` Fuentes: ${sources.join(", ")}.` : "";

    const newSummary = [
      currentLead.conversation_summary || "",
      `[${tagPrefix}] ${summaryText}${techStr}${partnersStr}${painStr}${sourcesStr} Confianza: ${confidence}%.`
    ].filter(Boolean).join(" ");

    const newScore = Math.min(100, (currentLead.score || 0) + 15);

    // 3. Actualizar en D1
    await c.env.DB.prepare(`
      UPDATE sales_leads
      SET tamano = ?,
          conversation_summary = ?,
          score = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(estimatedSize, newSummary, newScore, leadId).run();

    // Persistir teléfono y WhatsApp si están presentes
    const rawTel = body.telefono || enrichment.telefono || body.whatsapp || enrichment.whatsapp;
    const telNorm = normalizeMexicanPhone(rawTel);
    const finalPhone = telNorm.telefono || (typeof body.telefono === "string" ? body.telefono : null);
    const finalWa = telNorm.whatsapp || (typeof body.whatsapp === "string" ? body.whatsapp : null);

    if (finalPhone || finalWa) {
      try {
        if (finalPhone) {
          await c.env.DB.prepare(`
            UPDATE sales_leads
            SET phone = COALESCE(?, phone)
            WHERE id = ?
          `).bind(finalPhone, leadId).run();
        }

        if (currentLead.contact_id) {
          await c.env.DB.prepare(`
            UPDATE sales_contacts
            SET phone = COALESCE(?, phone),
                whatsapp = COALESCE(?, whatsapp),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(finalPhone, finalWa, currentLead.contact_id).run();
        } else if (currentLead.account_id) {
          const existingCt = await c.env.DB.prepare(
            "SELECT id FROM sales_contacts WHERE account_id = ? LIMIT 1"
          ).bind(currentLead.account_id).first<any>();

          if (existingCt?.id) {
            await c.env.DB.prepare(`
              UPDATE sales_contacts
              SET phone = COALESCE(?, phone),
                  whatsapp = COALESCE(?, whatsapp),
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(finalPhone, finalWa, existingCt.id).run();
          } else {
            const newCtId = `cnt_${crypto.randomUUID().slice(0, 12)}`;
            await c.env.DB.prepare(`
              INSERT INTO sales_contacts (
                id, account_id, name, email, phone, whatsapp, title, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 'Contacto Principal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(newCtId, currentLead.account_id, currentLead.despacho_nombre || "Contacto Principal", currentLead.email || null, finalPhone, finalWa).run();

            await c.env.DB.prepare("UPDATE sales_leads SET contact_id = ? WHERE id = ?").bind(newCtId, leadId).run();
          }
        }

        if (telNorm.whatsapp_valid || body.whatsapp_valid === true) {
          const obsId = `obs_${crypto.randomUUID().slice(0, 12)}`;
          await c.env.DB.prepare(`
            INSERT OR IGNORE INTO sales_observations (
              id, account_id, signal_code, observation_value, confidence, created_at
            ) VALUES (?, ?, 'WHATSAPP_CORPORATIVO', ?, 1.0, CURRENT_TIMESTAMP)
          `).bind(obsId, currentLead.account_id || leadId, finalWa || finalPhone).run();
        }
      } catch (e) {
        console.error("[leads/enrich] Error persistiendo contacto WhatsApp:", e);
      }
    }

    // 4. Actualizar cuenta en CRM si existe asociada
    try {
      await c.env.DB.prepare(`
        UPDATE sales_accounts
        SET size = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE lead_id = ? OR id = ?
      `).bind(estimatedSize, leadId, currentLead.account_id || `acc_${leadId}`).run();
    } catch {
      // Ignorar si cuenta no existe
    }

    // 5. Registrar auditoría en agent_skill_runs
    try {
      const runId = `run_${crypto.randomUUID().slice(0, 12)}`;
      await c.env.DB.prepare(`
        INSERT INTO agent_skill_runs (
          id, lead_id, skill_name, operator, status, output_result, finished_at
        ) VALUES (?, ?, 'research_prospect_web', ?, 'completed', ?, CURRENT_TIMESTAMP)
      `).bind(
        runId,
        leadId,
        operator,
        JSON.stringify({
          tamano_estimado: estimatedSize,
          software_detectado: detectedTech,
          socios: partners,
          senales_dolor: painSignals,
          fuentes: sources,
          confianza: confidence,
        })
      ).run();
    } catch (auditErr) {
      console.warn("[leads/enrich] Error registrando auditoría en agent_skill_runs:", auditErr);
    }

    // 6. Si el Durable Object está instanciado, registrar el hallazgo
    if (c.env.SALES_AGENT && typeof c.env.SALES_AGENT.idFromName === "function") {
      try {
        const doId = c.env.SALES_AGENT.idFromName(leadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            message: `[INTELIGENCIA AUTÓNOMA ${operator.toUpperCase()}]: ${summaryText}${techStr}${partnersStr}`,
            tamano: estimatedSize,
          }),
        });
      } catch (doErr) {
        console.warn("[leads/enrich] Error notificando a Durable Object:", doErr);
      }
    }

    return c.json({
      success: true,
      lead_id: leadId,
      tamano_asignado: estimatedSize,
      score_actualizado: newScore,
      telefono: finalPhone,
      whatsapp: finalWa,
      whatsapp_valid: Boolean(telNorm.whatsapp_valid || body.whatsapp_valid === true),
      operator,
      message: `Lead enriquecido exitosamente por ${operator}.`,
    }, 200);
  } catch (err: any) {
    console.error("[leads/enrich] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Endpoint de Métricas de Harvesting y Monitoreo Agéntico (/api/internal/harvest/metrics & /metrics)
 * Permite a StayPuft y al sistema consultar cuentas, SCIAN, señales, cohortes, cobertura telefónica y ejecuciones.
 */
const metricsHandler = async (c: InternalContext) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const totalAccounts = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM sales_accounts").first<any>();
    const byScian = await c.env.DB.prepare("SELECT scian_code, COUNT(*) as cnt FROM sales_accounts WHERE scian_code IS NOT NULL GROUP BY scian_code LIMIT 100").all();
    const bySource = await c.env.DB.prepare("SELECT harvest_source, COUNT(*) as cnt FROM sales_accounts WHERE harvest_source IS NOT NULL GROUP BY harvest_source LIMIT 100").all();
    const obsCount = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM sales_observations").first<any>();
    const topSignals = await c.env.DB.prepare("SELECT signal_code, COUNT(*) as cnt FROM sales_observations GROUP BY signal_code ORDER BY cnt DESC LIMIT 10").all();
    const cohorts = await c.env.DB.prepare("SELECT cohort_id, name, vertical FROM sales_cohorts LIMIT 100").all();
    const cohortSizes: any[] = [];
    for (const ch of (cohorts?.results || [])) {
      try {
        const cohortDef = await c.env.DB.prepare("SELECT query_sql FROM sales_cohorts WHERE cohort_id = ?").bind(ch.cohort_id).first<any>();
        if (cohortDef?.query_sql) {
          const r = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM (${cohortDef.query_sql})`).first<any>();
          cohortSizes.push({ cohort_id: ch.cohort_id, name: ch.name, vertical: ch.vertical, size: r?.cnt || 0 });
        }
      } catch {
        cohortSizes.push({ cohort_id: ch.cohort_id, name: ch.name, vertical: ch.vertical, size: 0 });
      }
    }
    const lastRun = await c.env.DB.prepare("SELECT * FROM harvest_runs ORDER BY started_at DESC LIMIT 1").first<any>();

    let pendingTasksCount = 0;
    let recentRuns: any[] = [];
    try {
      const pendingRes = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM agent_tasks WHERE status = 'pending'").first<any>();
      pendingTasksCount = pendingRes?.cnt || 0;
      const runsRes = await c.env.DB.prepare("SELECT id, lead_id, skill_name, operator, status, started_at, finished_at, error_message FROM agent_skill_runs ORDER BY started_at DESC LIMIT 5").all<any>();
      recentRuns = runsRes?.results || [];
    } catch {
      // Ignorar si las tablas aún no existen en tests
    }

    // Métricas de cobertura telefónica y WhatsApp (StayPuft Total Access)
    let phoneCoverage = {
      total_with_phone: 0,
      total_with_whatsapp_valid: 0,
      total_without_whatsapp: 0,
      total_malformed_phone: 0,
      cohorts: {
        ark_ledger_despachos: {
          total_leads: 0,
          total_with_phone: 0,
          total_with_whatsapp_valid: 0,
          total_without_whatsapp: 0,
          malformed_phone_count: 0,
        },
        futura_medicos_merida: {
          total_leads: 0,
          total_with_phone: 0,
          total_with_whatsapp_valid: 0,
          total_without_whatsapp: 0,
          malformed_phone_count: 0,
        },
      },
    };

    try {
      const phoneRes = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE WHEN (
            (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.whatsapp, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13))
          ) THEN l.id END) as with_phone,
          COUNT(DISTINCT CASE WHEN (
            (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.whatsapp, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            o.id IS NOT NULL OR
            (l.phone IS NOT NULL AND (l.phone LIKE '+52%' OR l.phone LIKE '52%' OR LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) = 10) AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13))
          ) THEN l.id END) as with_wa,
          COUNT(DISTINCT CASE WHEN (
            (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) NOT IN (10, 12, 13)) OR
            (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.phone, '+', ''), ' ', ''), '-', '')) NOT IN (10, 12, 13))
          ) THEN l.id END) as malformed_phone
        FROM sales_leads l
        LEFT JOIN sales_contacts c ON c.account_id = l.account_id
        LEFT JOIN sales_observations o ON o.account_id = l.account_id AND o.signal_code = 'WHATSAPP_CORPORATIVO'
      `).first<any>();

      if (phoneRes) {
        phoneCoverage.total_with_phone = phoneRes.with_phone || 0;
        phoneCoverage.total_with_whatsapp_valid = phoneRes.with_wa || 0;
        phoneCoverage.total_without_whatsapp = Math.max(0, (phoneRes.total_leads || 0) - (phoneRes.with_wa || 0));
        phoneCoverage.total_malformed_phone = phoneRes.malformed_phone || 0;
      }

      const arkRes = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE WHEN (
            (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.whatsapp, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13))
          ) THEN l.id END) as with_phone,
          COUNT(DISTINCT CASE WHEN (
            (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.whatsapp, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            o.id IS NOT NULL OR
            (l.phone IS NOT NULL AND (l.phone LIKE '+52%' OR l.phone LIKE '52%' OR LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) = 10) AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13))
          ) THEN l.id END) as with_wa,
          COUNT(DISTINCT CASE WHEN (
            (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) NOT IN (10, 12, 13)) OR
            (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.phone, '+', ''), ' ', ''), '-', '')) NOT IN (10, 12, 13))
          ) THEN l.id END) as malformed_phone
        FROM sales_leads l
        JOIN sales_accounts a ON a.id = l.account_id
        LEFT JOIN sales_contacts c ON c.account_id = l.account_id
        LEFT JOIN sales_observations o ON o.account_id = l.account_id AND o.signal_code = 'WHATSAPP_CORPORATIVO'
        WHERE a.scian_code IN ('541211', '541212')
          AND (LOWER(COALESCE(a.city, '')) LIKE '%merida%' OR LOWER(COALESCE(a.city, '')) LIKE '%mérida%' OR LOWER(COALESCE(a.city, '')) LIKE '%yucat%')
          AND a.id NOT LIKE '%sipres%'
          AND LOWER(COALESCE(a.name, '')) NOT LIKE '%sofom%'
          AND LOWER(COALESCE(a.name, '')) NOT LIKE '%s.a.p.i.%'
          AND l.id NOT LIKE '%sipres%'
      `).first<any>();

      if (arkRes) {
        phoneCoverage.cohorts.ark_ledger_despachos = {
          total_leads: arkRes.total_leads || 0,
          total_with_phone: arkRes.with_phone || 0,
          total_with_whatsapp_valid: arkRes.with_wa || 0,
          total_without_whatsapp: Math.max(0, (arkRes.total_leads || 0) - (arkRes.with_wa || 0)),
          malformed_phone_count: arkRes.malformed_phone || 0,
        };
      }

      const futRes = await c.env.DB.prepare(`
        SELECT 
          COUNT(DISTINCT l.id) as total_leads,
          COUNT(DISTINCT CASE WHEN (
            (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.whatsapp, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13))
          ) THEN l.id END) as with_phone,
          COUNT(DISTINCT CASE WHEN (
            (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.whatsapp, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13)) OR
            o.id IS NOT NULL OR
            (l.phone IS NOT NULL AND (l.phone LIKE '+52%' OR l.phone LIKE '52%' OR LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) = 10) AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) IN (10, 12, 13))
          ) THEN l.id END) as with_wa,
          COUNT(DISTINCT CASE WHEN (
            (l.phone IS NOT NULL AND TRIM(l.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(l.phone, '+', ''), ' ', ''), '-', '')) NOT IN (10, 12, 13)) OR
            (c.phone IS NOT NULL AND TRIM(c.phone) != '' AND LENGTH(REPLACE(REPLACE(REPLACE(c.phone, '+', ''), ' ', ''), '-', '')) NOT IN (10, 12, 13))
          ) THEN l.id END) as malformed_phone
        FROM sales_leads l
        JOIN sales_accounts a ON a.id = l.account_id
        LEFT JOIN sales_contacts c ON c.account_id = l.account_id
        LEFT JOIN sales_observations o ON o.account_id = l.account_id AND o.signal_code = 'WHATSAPP_CORPORATIVO'
        WHERE (a.scian_code IN ('621111', '621112', '621211', '621511', '622111') OR a.scian_code LIKE '62%')
          AND (LOWER(COALESCE(a.city, '')) LIKE '%merida%' OR LOWER(COALESCE(a.city, '')) LIKE '%mérida%' OR LOWER(COALESCE(a.city, '')) LIKE '%yucat%')
      `).first<any>();

      if (futRes) {
        phoneCoverage.cohorts.futura_medicos_merida = {
          total_leads: futRes.total_leads || 0,
          total_with_phone: futRes.with_phone || 0,
          total_with_whatsapp_valid: futRes.with_wa || 0,
          total_without_whatsapp: Math.max(0, (futRes.total_leads || 0) - (futRes.with_wa || 0)),
          malformed_phone_count: futRes.malformed_phone || 0,
        };
      }
    } catch {
      // Ignorar si en tests no están todas las tablas
    }

    return c.json({
      success: true,
      total_accounts: totalAccounts?.cnt || 0,
      accounts_by_scian: byScian?.results || [],
      accounts_by_source: bySource?.results || [],
      observations_count: obsCount?.cnt || 0,
      top_signals: topSignals?.results || [],
      cohorts_summary: cohortSizes,
      last_harvest_run: lastRun || null,
      agent_tasks: {
        pending_count: pendingTasksCount,
        recent_runs: recentRuns,
      },
      phone_coverage: phoneCoverage,
    }, 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error obteniendo métricas" }, 500);
  }
};

internalRouter.get("/harvest/metrics", metricsHandler);
internalRouter.get("/metrics", metricsHandler);

/**
 * Endpoint de clasificacion de dolor/vertical via Workers AI.
 */
internalRouter.post("/leads/:lead_id/classify", async (c) => {
  const leadId = c.req.param("lead_id");
  if (!leadId) return c.json({ error: "lead_id es obligatorio en la ruta." }, 400);

  let body: any = {};
  try { body = await c.req.json(); } catch { body = {}; }
  const { observaciones, raw_lead } = body;

  const prompt = construir_prompt_clasificacion(raw_lead || {}, observaciones || []);

  try {
    const response: any = await (c.env as any).AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT_CLASIFICADOR },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    let text = "";
    if (typeof response === "string") text = response;
    else if (response?.response) text = response.response;
    else text = JSON.stringify(response);

    let parsed: any = {};
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    } catch { parsed = {}; }

    return c.json({
      lead_id: leadId,
      dolor_principal: parsed.dolor_principal || "sin datos",
      vertical: parsed.vertical || "cobranza",
      confianza: parsed.confianza ?? 0.5,
      razonamiento: parsed.razonamiento || "",
    });
  } catch (err: any) {
    console.error("[leads/classify] Error:", err);
    return c.json({ error: err.message || "Error clasificando" }, 500);
  }
});
export const SYSTEM_PROMPT_CLASIFICADOR = `Eres un clasificador de leads para Ark Sales.`;

export function construir_prompt_clasificacion(raw_lead: any, observaciones: any[]): string {
  const obs_text = (observaciones || []).map((o: any) => `- ${o.signal_code}: ${o.value_text} (confianza: ${o.confidence})`).join("\n");
  return `Empresa: ${raw_lead?.razon_social || ""}
Sector: ${raw_lead?.scian_code || ""}
Dominio: ${raw_lead?.dominio_web || ""}

Observaciones detectadas:
${obs_text}

Clasifica el dolor principal y la vertical de esta empresa.`;
}

// -------------------------------------------------------------
// Harvest runs & backfill (Lead Harvester observability)
// -------------------------------------------------------------
internalRouter.post("/observations/batch", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
    const body = await c.req.json().catch(() => ({}));
    const rawAccountId = String(body?.account_id || "").trim();
    const observaciones = Array.isArray(body?.observaciones) ? body.observaciones : [];
    if (!rawAccountId) {
      return c.json({ error: "account_id es obligatorio." }, 400);
    }
    const accountId = rawAccountId.startsWith("acc_") ? rawAccountId : `acc_${rawAccountId}`;
    let inserted = 0;
    for (const obs of observaciones) {
      if (!obs?.signal_code) continue;
      const obsId = obs.observation_id || `obs_${crypto.randomUUID().slice(0, 12)}`;
      await c.env.DB.prepare(`
        INSERT OR REPLACE INTO sales_observations (
          observation_id, account_id, signal_code, value_text, value_num, confidence, evidence_url, observed_at, source_harvester
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).bind(
        obsId,
        accountId,
        obs.signal_code,
        obs.value_text ?? null,
        obs.value_num ?? null,
        obs.confidence ?? 1.0,
        obs.evidence_url ?? null,
        obs.source_harvester || "denue_profiler"
      ).run();
      inserted++;
    }
    return c.json({ success: true, account_id: accountId, inserted });
  } catch (err: any) {
    return c.json({ error: err?.message || "Error guardando observaciones" }, 500);
  }
});

internalRouter.post("/harvest/runs", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
    const body = await c.req.json().catch(() => ({}));
    const runId = body?.run_id || `run_${crypto.randomUUID().slice(0, 8)}`;
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO harvest_runs (run_id, source, status, started_at, github_run_url)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
    `).bind(runId, body?.source || "denue", body?.status || "running", body?.github_run_url || null).run();
    return c.json({ success: true, run_id: runId });
  } catch (err: any) {
    return c.json({ error: err?.message || "Error creando run" }, 500);
  }
});

internalRouter.patch("/harvest/runs/:run_id", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
    const runId = c.req.param("run_id");
    const body = await c.req.json().catch(() => ({}));
    const finishedAtVal = body?.finished_at === "now" ? new Date().toISOString() : (body?.finished_at ?? null);
    await c.env.DB.prepare(`
      UPDATE harvest_runs
      SET status = COALESCE(?, status),
          finished_at = CASE WHEN ? IS NOT NULL THEN ? ELSE finished_at END,
          leads_discovered = COALESCE(?, leads_discovered),
          leads_ingested = COALESCE(?, leads_ingested),
          leads_deduped = COALESCE(?, leads_deduped),
          leads_enriched = COALESCE(?, leads_enriched),
          error_message = COALESCE(?, error_message),
          github_run_url = COALESCE(?, github_run_url)
      WHERE run_id = ?
    `).bind(
      body?.status ?? null,
      finishedAtVal,
      finishedAtVal,
      body?.leads_discovered ?? null,
      body?.leads_ingested ?? null,
      body?.leads_deduped ?? null,
      body?.leads_enriched ?? null,
      body?.error_message ?? null,
      body?.github_run_url ?? null,
      runId
    ).run();
    if (body?.status === "failed" && c.env.RESEND_API_KEY) {
      try {
        const fromEmail = c.env.RESEND_FROM_EMAIL || "ARK Systems <ventas@mail.arksystems.site>";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: fromEmail,
            to: ["admin@arksystems.site"],
            subject: `Lead Harvest falló: ${runId}`,
            html: `<p>Run ${runId} terminó con status failed.</p><p>${body?.error_message || ""}</p>`,
          }),
        });
      } catch {}
    }
    return c.json({ success: true, run_id: runId });
  } catch (err: any) {
    return c.json({ error: err?.message || "Error actualizando run" }, 500);
  }
});

internalRouter.post("/harvest/backfill-scian", async (c) => {
  try {
    if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
    await c.env.DB.prepare(`
      UPDATE sales_accounts
      SET scian_code = (
        SELECT o.value_text FROM sales_observations o
        WHERE o.account_id = sales_accounts.id AND o.signal_code = 'SCIAN_CODE'
        LIMIT 1
      ),
      last_enriched_at = CURRENT_TIMESTAMP
      WHERE EXISTS (
        SELECT 1 FROM sales_observations o
        WHERE o.account_id = sales_accounts.id AND o.signal_code = 'SCIAN_CODE'
      )
    `).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err?.message || "Error en backfill" }, 500);
  }
});

// =============================================================================
// ACCESO TOTAL STAYPUFT: LECTURA Y OPERACIONES INTERNAS DE ARK SALES
// =============================================================================

/**
 * GET /api/internal/leads
 * Filtros: cohort, scian, ciudad, has_email, has_phone, sin_whatsapp, estado, q, limit (default 20, cap 100), offset.
 * Devuelve por lead: lead_id, account_id, nombre, email, telefono, whatsapp, whatsapp_valid, sin_whatsapp, scian_code, ciudad, vertical, estado, score.
 */
internalRouter.get("/leads", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const cohort = c.req.query("cohort");
    const scian = c.req.query("scian");
    const ciudad = c.req.query("ciudad");
    const hasEmail = c.req.query("has_email");
    const hasPhone = c.req.query("has_phone");
    const sinWhatsapp = c.req.query("sin_whatsapp");
    const estado = c.req.query("estado");
    const q = (c.req.query("q") || "").trim();

    let limit = parseInt(c.req.query("limit") || "20", 10);
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;

    let offset = parseInt(c.req.query("offset") || "0", 10);
    if (isNaN(offset) || offset < 0) offset = 0;

    let baseQuery = `
      SELECT 
        l.id as lead_id,
        l.account_id,
        COALESCE(c.name, l.despacho_nombre, a.name, '') as nombre,
        COALESCE(l.email, c.email, '') as email,
        COALESCE(l.phone, c.phone) as raw_phone,
        c.whatsapp as raw_whatsapp,
        a.scian_code,
        a.city as ciudad,
        COALESCE(a.tenant_id, l.dolor_detectado, 'general') as vertical,
        l.estado,
        l.score,
        l.created_at
      FROM sales_leads l
      LEFT JOIN sales_accounts a ON a.id = l.account_id
      LEFT JOIN sales_contacts c ON c.account_id = l.account_id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (estado) {
      whereClauses.push("l.estado = ?");
      params.push(estado);
    }

    if (ciudad) {
      whereClauses.push("LOWER(COALESCE(a.city, '')) LIKE ?");
      params.push(`%${ciudad.toLowerCase()}%`);
    }

    if (scian) {
      const scianList = scian.split(",").map(s => s.trim()).filter(Boolean);
      if (scianList.length > 0) {
        whereClauses.push(`a.scian_code IN (${scianList.map(() => "?").join(",")})`);
        params.push(...scianList);
      }
    }

    if (cohort) {
      if (cohort === "ark_ledger_despachos") {
        whereClauses.push(`(
          a.scian_code IN ('541211', '541212') 
          AND (LOWER(COALESCE(a.city, '')) LIKE '%merida%' OR LOWER(COALESCE(a.city, '')) LIKE '%mérida%' OR LOWER(COALESCE(a.city, '')) LIKE '%yucat%')
          AND a.id NOT LIKE '%sipres%' 
          AND LOWER(COALESCE(a.name, '')) NOT LIKE '%sofom%' 
          AND LOWER(COALESCE(a.name, '')) NOT LIKE '%s.a.p.i.%'
          AND l.id NOT LIKE '%sipres%'
        )`);
      } else if (cohort === "futura_medicos_merida") {
        whereClauses.push(`(
          a.scian_code IN ('621111', '621112', '621211', '621511', '622111')
          AND (LOWER(COALESCE(a.city, '')) LIKE '%merida%' OR LOWER(COALESCE(a.city, '')) LIKE '%mérida%' OR LOWER(COALESCE(a.city, '')) LIKE '%yucat%')
        )`);
      } else {
        try {
          const chRow = await c.env.DB.prepare("SELECT query_sql FROM sales_cohorts WHERE cohort_id = ?").bind(cohort).first<any>();
          if (chRow?.query_sql) {
            whereClauses.push(`a.id IN (SELECT id FROM (${chRow.query_sql}))`);
          }
        } catch {}
      }
    }

    if (hasEmail === "true") {
      whereClauses.push("(COALESCE(l.email, c.email) IS NOT NULL AND TRIM(COALESCE(l.email, c.email)) != '' AND COALESCE(l.email, c.email) NOT LIKE '%@harvest.arksystems.local' AND COALESCE(l.email, c.email) NOT LIKE '%placeholder%')");
    } else if (hasEmail === "false") {
      whereClauses.push("(COALESCE(l.email, c.email) IS NULL OR TRIM(COALESCE(l.email, c.email)) = '' OR COALESCE(l.email, c.email) LIKE '%@harvest.arksystems.local' OR COALESCE(l.email, c.email) LIKE '%placeholder%')");
    }

    if (hasPhone === "true") {
      whereClauses.push("((l.phone IS NOT NULL AND TRIM(l.phone) != '') OR (c.phone IS NOT NULL AND TRIM(c.phone) != '') OR (c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != ''))");
    } else if (hasPhone === "false") {
      whereClauses.push("((l.phone IS NULL OR TRIM(l.phone) = '') AND (c.phone IS NULL OR TRIM(c.phone) = '') AND (c.whatsapp IS NULL OR TRIM(c.whatsapp) = ''))");
    }

    if (sinWhatsapp === "true") {
      whereClauses.push("((c.whatsapp IS NULL OR TRIM(c.whatsapp) = '') AND NOT (l.phone IS NOT NULL AND (l.phone LIKE '+52%' OR l.phone LIKE '52%') AND LENGTH(REPLACE(REPLACE(l.phone, '+', ''), ' ', '')) = 12))");
    } else if (sinWhatsapp === "false") {
      whereClauses.push("((c.whatsapp IS NOT NULL AND TRIM(c.whatsapp) != '') OR (l.phone IS NOT NULL AND (l.phone LIKE '+52%' OR l.phone LIKE '52%') AND LENGTH(REPLACE(REPLACE(l.phone, '+', ''), ' ', '')) = 12))");
    }

    if (q) {
      whereClauses.push("(LOWER(COALESCE(l.despacho_nombre, '')) LIKE ? OR LOWER(COALESCE(a.name, '')) LIKE ? OR LOWER(COALESCE(l.email, '')) LIKE ? OR LOWER(COALESCE(c.email, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ?)");
      const qParam = `%${q.toLowerCase()}%`;
      params.push(qParam, qParam, qParam, qParam, qParam);
    }

    let countQuery = `
      SELECT COUNT(DISTINCT l.id) as total
      FROM sales_leads l
      LEFT JOIN sales_accounts a ON a.id = l.account_id
      LEFT JOIN sales_contacts c ON c.account_id = l.account_id
    `;
    if (whereClauses.length > 0) {
      countQuery += ` WHERE ` + whereClauses.join(" AND ");
    }
    const countRow = await c.env.DB.prepare(countQuery).bind(...params).first<{ total: number }>();
    const total = countRow?.total || 0;

    let query = baseQuery;
    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(" AND ");
    }

    query += ` GROUP BY l.id ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, limit, offset];

    const rows = await c.env.DB.prepare(query).bind(...queryParams).all<any>();
    const leads = (rows?.results || []).map((row: any) => {
      const rawVal = row.raw_whatsapp || row.raw_phone;
      const norm = normalizeMexicanPhone(rawVal);
      const telefono = norm.telefono;
      const whatsapp = norm.whatsapp;
      const whatsappValid = norm.whatsapp_valid;
      const isSinWhatsapp = !whatsappValid;

      return {
        lead_id: row.lead_id,
        account_id: row.account_id,
        nombre: row.nombre,
        email: row.email,
        telefono,
        whatsapp,
        whatsapp_valid: whatsappValid,
        sin_whatsapp: isSinWhatsapp,
        scian_code: row.scian_code,
        ciudad: row.ciudad,
        vertical: row.vertical,
        estado: row.estado,
        score: row.score,
      };
    });

    return c.json({
      success: true,
      count: leads.length,
      total,
      limit,
      offset,
      leads,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/internal/leads/:lead_id
 * Detalle completo de un lead: cohorte real, cuenta, contactos, observaciones, actividades, tareas, emails.
 */
internalRouter.get("/leads/:lead_id", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const leadId = c.req.param("lead_id");
  try {
    const lead = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
    if (!lead) {
      return c.json({ error: `Lead ${leadId} no encontrado` }, 404);
    }

    let account = null;
    let contacts: any[] = [];
    let observations: any[] = [];
    let activities: any[] = [];
    let tasks: any[] = [];
    let emails: any[] = [];

    if (lead.account_id) {
      account = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(lead.account_id).first<any>();
      const contactsRes = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE account_id = ? LIMIT 100").bind(lead.account_id).all<any>();
      contacts = contactsRes?.results || [];

      const obsRes = await c.env.DB.prepare("SELECT * FROM sales_observations WHERE account_id = ? ORDER BY observed_at DESC LIMIT 100").bind(lead.account_id).all<any>();
      observations = obsRes?.results || [];
    }

    if (contacts.length === 0 && lead.contact_id) {
      const cRow = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(lead.contact_id).first<any>();
      if (cRow) contacts.push(cRow);
    }

    try {
      const actRes = await c.env.DB.prepare("SELECT * FROM sales_activities WHERE lead_id = ? OR (account_id IS NOT NULL AND account_id = ?) ORDER BY created_at DESC LIMIT 100").bind(leadId, lead.account_id || "").all<any>();
      activities = actRes?.results || [];
    } catch {}

    try {
      const tasksRes = await c.env.DB.prepare("SELECT * FROM agent_tasks WHERE lead_id = ? ORDER BY created_at DESC LIMIT 100").bind(leadId).all<any>();
      tasks = tasksRes?.results || [];
    } catch {}

    try {
      const emailsRes = await c.env.DB.prepare("SELECT * FROM email_dispatches WHERE lead_id = ? ORDER BY created_at DESC LIMIT 100").bind(leadId).all<any>();
      emails = emailsRes?.results || [];
    } catch {}

    // Calcular cohorte real del lead
    let cohort: string | null = null;
    const scianCode = String(account?.scian_code || "");
    const city = String(account?.city || "").toLowerCase();
    const isMerida = city.includes("merida") || city.includes("mérida") || city.includes("yucat");
    const accId = String(account?.id || "");
    const accName = String(account?.name || "").toLowerCase();
    const isSipres = accId.includes("sipres") || leadId.toLowerCase().includes("sipres") || accName.includes("sofom") || accName.includes("s.a.p.i.");

    if (isSipres) {
      cohort = "sipres_sofom";
    } else if (["541211", "541212"].includes(scianCode) && isMerida) {
      cohort = "ark_ledger_despachos";
    } else if (["621111", "621112", "621211", "621511", "622111"].includes(scianCode) && isMerida) {
      cohort = "futura_medicos_merida";
    } else if (["541211", "541212", "541219", "541110", "561490"].includes(scianCode)) {
      cohort = "despachos_general";
    }

    const normPhone = normalizeMexicanPhone(lead.phone);
    const cleanedLead = {
      ...lead,
      phone: normPhone.telefono,
      whatsapp: normPhone.whatsapp,
      whatsapp_valid: normPhone.whatsapp_valid,
      sin_whatsapp: !normPhone.whatsapp_valid,
    };

    return c.json({
      success: true,
      lead_id: lead.id,
      cohort,
      score: lead.score,
      lead: cleanedLead,
      account,
      contacts,
      observations,
      activities,
      tasks,
      emails,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/internal/accounts/:id
 * Detalle completo de una cuenta con sus contactos, leads, observaciones, oportunidades y actividades.
 */
internalRouter.get("/accounts/:id", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const accountId = c.req.param("id");
  try {
    const account = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(accountId).first<any>();
    if (!account) {
      return c.json({ error: `Cuenta ${accountId} no encontrada` }, 404);
    }

    const contactsRes = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE account_id = ? LIMIT 100").bind(accountId).all<any>();
    const leadsRes = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE account_id = ? LIMIT 100").bind(accountId).all<any>();
    const obsRes = await c.env.DB.prepare("SELECT * FROM sales_observations WHERE account_id = ? ORDER BY observed_at DESC LIMIT 100").bind(accountId).all<any>();
    
    let opportunities: any[] = [];
    try {
      const oppsRes = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE account_id = ? LIMIT 100").bind(accountId).all<any>();
      opportunities = oppsRes?.results || [];
    } catch {}

    let activities: any[] = [];
    try {
      const actRes = await c.env.DB.prepare("SELECT * FROM sales_activities WHERE account_id = ? ORDER BY created_at DESC LIMIT 100").bind(accountId).all<any>();
      activities = actRes?.results || [];
    } catch {}

    return c.json({
      success: true,
      account,
      contacts: contactsRes?.results || [],
      leads: leadsRes?.results || [],
      observations: obsRes?.results || [],
      opportunities,
      activities,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/internal/quarantine & /api/internal/leads/quarantine
 * Consulta leads y prospectos en cuarentena (fail-closed de ingesta o descartados en investigación).
 */
const getQuarantineHandler = async (c: InternalContext) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const quarantineList: any[] = [];

    // 1. De sales_lead_quarantine
    try {
      const qRes = await c.env.DB.prepare("SELECT id, lead_id, email, despacho_nombre, reason, payload_json, created_at FROM sales_lead_quarantine ORDER BY created_at DESC LIMIT 100").all<any>();
      for (const row of (qRes?.results || [])) {
        let confidence = 0;
        try {
          const payload = JSON.parse(row.payload_json);
          confidence = payload.confidence || payload.confianza || 0;
        } catch {}
        quarantineList.push({
          id: row.id,
          lead_id: row.lead_id || row.id,
          email: row.email,
          despacho_nombre: row.despacho_nombre,
          motivo: row.reason,
          confidence,
          timestamp: row.created_at,
          descartado_por: "ingest_quarantine_filter",
        });
      }
    } catch {}

    // 2. De agent_skill_runs (descartados por StayPuft u otro operador)
    try {
      const runsRes = await c.env.DB.prepare(`
        SELECT r.id, r.lead_id, r.operator, r.result_json, r.finished_at, l.email, l.despacho_nombre
        FROM agent_skill_runs r
        LEFT JOIN sales_leads l ON l.id = r.lead_id
        WHERE r.status = 'completed' AND r.result_json LIKE '%"descartar":true%'
        ORDER BY r.finished_at DESC LIMIT 100
      `).all<any>();

      for (const run of (runsRes?.results || [])) {
        let parsed: any = {};
        try { parsed = JSON.parse(run.result_json); } catch {}
        quarantineList.push({
          id: run.id,
          lead_id: run.lead_id,
          email: run.email,
          despacho_nombre: run.despacho_nombre,
          motivo: parsed.motivo_descarte || "descarte_staypuft",
          confidence: parsed.confidence || parsed.confianza || 0,
          timestamp: run.finished_at,
          descartado_por: run.operator || "staypuft",
        });
      }
    } catch {}

    // 3. De sales_leads con estado = 'descartado' que no estén ya en la lista
    try {
      const leadsRes = await c.env.DB.prepare(`
        SELECT id, email, despacho_nombre, conversation_summary, updated_at
        FROM sales_leads
        WHERE estado = 'descartado'
        ORDER BY updated_at DESC LIMIT 100
      `).all<any>();

      const seenLeadIds = new Set(quarantineList.map(q => q.lead_id));
      for (const l of (leadsRes?.results || [])) {
        if (!seenLeadIds.has(l.id)) {
          quarantineList.push({
            id: `quar_lead_${l.id}`,
            lead_id: l.id,
            email: l.email,
            despacho_nombre: l.despacho_nombre,
            motivo: l.conversation_summary || "descartado",
            confidence: 0,
            timestamp: l.updated_at,
            descartado_por: "operator",
          });
        }
      }
    } catch {}

    return c.json({
      success: true,
      count: quarantineList.length,
      quarantine: quarantineList.slice(0, 100),
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
};

internalRouter.get("/quarantine", getQuarantineHandler);
internalRouter.get("/leads/quarantine", getQuarantineHandler);

/**
 * POST /api/internal/agent-tasks/enqueue
 * Encola una tarea agéntica individual para StayPuft o Grok Bot.
 */
internalRouter.post("/agent-tasks/enqueue", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const body = await c.req.json().catch(() => ({}));
    const leadId = body.lead_id;
    const skillName = body.skill_name || "research_prospect_web";
    const operator = body.operator || c.get("operator") || "staypuft";
    const payload = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload || {});
    const priority = typeof body.priority === "number" ? body.priority : 0;

    if (!leadId) {
      return c.json({ error: "lead_id es obligatorio" }, 400);
    }

    const taskId = `task_${crypto.randomUUID()}`;
    await c.env.DB.prepare(`
      INSERT INTO agent_tasks (id, lead_id, skill_name, operator, payload, priority, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).bind(taskId, leadId, skillName, operator, payload, priority).run();

    return c.json({ success: true, task_id: taskId, status: "pending" }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * GET /api/internal/agent-tasks/pending
 * Retorna tareas pendientes para un operador con orden de prioridad y timestamp.
 */
internalRouter.get("/agent-tasks/pending", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const operator = c.req.query("operator") || c.get("operator") || "staypuft";
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10) || 20, 100);
    const { results } = await c.env.DB.prepare(`
      SELECT id, lead_id, skill_name, operator, payload, priority, status, retry_count, created_at
      FROM agent_tasks
      WHERE status = 'pending' AND (operator = ? OR operator IS NULL)
      ORDER BY priority DESC, created_at ASC
      LIMIT ?
    `).bind(operator, limit).all<any>();

    return c.json({
      success: true,
      count: results?.length || 0,
      tasks: results || [],
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/agent-tasks/:id/claim
 * Reclama una tarea poniéndola en 'in_progress'.
 */
internalRouter.post("/agent-tasks/:id/claim", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const taskId = c.req.param("id");
  try {
    const task = await c.env.DB.prepare("SELECT * FROM agent_tasks WHERE id = ?").bind(taskId).first<any>();
    if (!task) return c.json({ error: "Tarea no encontrada" }, 404);
    if (task.status !== "pending") {
      return c.json({ error: `Tarea en estado '${task.status}', no puede ser reclamada.` }, 400);
    }
    await c.env.DB.prepare(`
      UPDATE agent_tasks
      SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(taskId).run();
    return c.json({ success: true, task_id: taskId, status: "in_progress" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/agent-tasks/:id/complete
 * Completa una tarea guardando el resultado.
 */
internalRouter.post("/agent-tasks/:id/complete", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const taskId = c.req.param("id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const resultJson = typeof body.result === "string" ? body.result : JSON.stringify(body.result || body || {});
    await c.env.DB.prepare(`
      UPDATE agent_tasks
      SET status = 'completed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(taskId).run();

    const task = await c.env.DB.prepare("SELECT * FROM agent_tasks WHERE id = ?").bind(taskId).first<any>();
    if (task) {
      const runId = `run_${crypto.randomUUID()}`;
      await c.env.DB.prepare(`
        INSERT INTO agent_skill_runs (id, lead_id, skill_name, operator, status, result_json, started_at, finished_at)
        VALUES (?, ?, ?, ?, 'completed', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(runId, task.lead_id, task.skill_name, task.operator || "staypuft", resultJson).run();
    }
    return c.json({ success: true, task_id: taskId, status: "completed" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/agent-tasks/:id/fail
 * Marca una tarea como fallida e incrementa el contador de reintentos.
 */
internalRouter.post("/agent-tasks/:id/fail", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const taskId = c.req.param("id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const errorMessage = String(body.error_message || body.error || "Fallo en ejecución").slice(0, 500);
    await c.env.DB.prepare(`
      UPDATE agent_tasks
      SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(taskId).run();
    return c.json({ success: true, task_id: taskId, status: "failed", error_message: errorMessage });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/agent-tasks/:id/retry
 * Restablece una tarea a 'pending'.
 */
internalRouter.post("/agent-tasks/:id/retry", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const taskId = c.req.param("id");
  try {
    await c.env.DB.prepare(`
      UPDATE agent_tasks
      SET status = 'pending', retry_count = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(taskId).run();
    return c.json({ success: true, task_id: taskId, status: "pending" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/crm/activities
 * Registra una actividad de CRM (nota, llamada, whatsapp, email, etc.)
 */
internalRouter.post("/crm/activities", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const body = await c.req.json().catch(() => ({}));
    const leadId = body.lead_id || null;
    const accountId = body.account_id || null;
    const contactId = body.contact_id || null;
    const type = body.type || "note";
    const notes = body.notes || body.content || "";
    const actId = `act_${crypto.randomUUID()}`;

    await c.env.DB.prepare(`
      INSERT INTO sales_activities (id, account_id, contact_id, lead_id, type, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(actId, accountId, contactId, leadId, type, notes).run();

    return c.json({ success: true, activity_id: actId }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/leads/:lead_id/observations
 * Registra una señal u observación para un lead.
 */
internalRouter.post("/leads/:lead_id/observations", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const leadId = c.req.param("lead_id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const lead = await c.env.DB.prepare("SELECT account_id FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
    const accountId = lead?.account_id || leadId;
    const signalCode = body.signal_code;
    if (!signalCode) return c.json({ error: "signal_code es obligatorio" }, 400);

    const obsId = `obs_${crypto.randomUUID()}`;
    await c.env.DB.prepare(`
      INSERT INTO sales_observations (id, account_id, signal_code, value_text, value_num, confidence, notes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      obsId,
      accountId,
      signalCode,
      body.value_text !== undefined ? String(body.value_text) : null,
      body.value_num !== undefined ? Number(body.value_num) : null,
      body.confidence !== undefined ? Number(body.confidence) : 100,
      body.notes || null,
      body.source || "staypuft"
    ).run();

    return c.json({ success: true, observation_id: obsId }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/observations
 * Registra una señal u observación general para una cuenta.
 */
internalRouter.post("/observations", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const body = await c.req.json().catch(() => ({}));
    const accountId = body.account_id || body.lead_id;
    const signalCode = body.signal_code;
    if (!accountId || !signalCode) {
      return c.json({ error: "account_id y signal_code son obligatorios" }, 400);
    }
    const obsId = `obs_${crypto.randomUUID()}`;
    await c.env.DB.prepare(`
      INSERT INTO sales_observations (id, account_id, signal_code, value_text, value_num, confidence, notes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      obsId,
      accountId,
      signalCode,
      body.value_text !== undefined ? String(body.value_text) : null,
      body.value_num !== undefined ? Number(body.value_num) : null,
      body.confidence !== undefined ? Number(body.confidence) : 100,
      body.notes || null,
      body.source || "staypuft"
    ).run();

    return c.json({ success: true, observation_id: obsId }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/leads/:lead_id/status
 * Actualiza el estado de un lead.
 */
internalRouter.post("/leads/:lead_id/status", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const leadId = c.req.param("lead_id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const estado = body.estado;
    const validStates = ["nuevo", "en_conversacion", "calificado", "propuesta_enviada", "cerrado", "descartado"];
    if (!estado || !validStates.includes(estado)) {
      return c.json({ error: `Estado inválido. Debe ser uno de: ${validStates.join(", ")}` }, 400);
    }
    await c.env.DB.prepare(`
      UPDATE sales_leads
      SET estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(estado, leadId).run();
    return c.json({ success: true, lead_id: leadId, estado });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/leads/:lead_id/score
 * Modifica o ajusta el score de un lead (clamp 0 - 100).
 */
internalRouter.post("/leads/:lead_id/score", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const leadId = c.req.param("lead_id");
  try {
    const body = await c.req.json().catch(() => ({}));
    let newScore = typeof body.score === "number" ? body.score : null;
    if (newScore === null && typeof body.delta === "number") {
      const cur = await c.env.DB.prepare("SELECT score FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
      newScore = Math.max(0, Math.min(100, (cur?.score || 0) + body.delta));
    }
    if (newScore === null) return c.json({ error: "score o delta es obligatorio" }, 400);
    newScore = Math.max(0, Math.min(100, newScore));
    await c.env.DB.prepare(`
      UPDATE sales_leads
      SET score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newScore, leadId).run();
    return c.json({ success: true, lead_id: leadId, score: newScore });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/leads/:lead_id/quarantine
 * Mueve un lead a cuarentena manualmente con motivo y registro de auditoría.
 */
internalRouter.post("/leads/:lead_id/quarantine", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const leadId = c.req.param("lead_id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const reason = body.reason || "descartado_manual_staypuft";
    const confidence = typeof body.confidence === "number" ? body.confidence : 100;
    const lead = await c.env.DB.prepare("SELECT email, despacho_nombre FROM sales_leads WHERE id = ?").bind(leadId).first<any>();

    await c.env.DB.prepare(`
      UPDATE sales_leads
      SET estado = 'descartado',
          conversation_summary = COALESCE(conversation_summary, '') || ' [quarantine: ' || ? || ']',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(reason, leadId).run();

    const qId = `quar_${crypto.randomUUID()}`;
    await c.env.DB.prepare(`
      INSERT INTO sales_lead_quarantine (id, lead_id, email, despacho_nombre, reason, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      qId,
      leadId,
      lead?.email || null,
      lead?.despacho_nombre || null,
      reason,
      JSON.stringify({ lead_id: leadId, reason, confidence, descartado_por: "staypuft", timestamp: new Date().toISOString() })
    ).run();

    return c.json({ success: true, lead_id: leadId, quarantine_id: qId, reason });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/accounts/:id/merge
 * Fusiona cuentas duplicadas reasignando contactos, leads, observaciones y oportunidades.
 */
internalRouter.post("/accounts/:id/merge", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const sourceAccountId = c.req.param("id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const targetAccountId = body.target_account_id;
    if (!targetAccountId || targetAccountId === sourceAccountId) {
      return c.json({ error: "target_account_id válido y distinto es obligatorio" }, 400);
    }
    await c.env.DB.prepare("UPDATE sales_contacts SET account_id = ? WHERE account_id = ?").bind(targetAccountId, sourceAccountId).run();
    await c.env.DB.prepare("UPDATE sales_leads SET account_id = ? WHERE account_id = ?").bind(targetAccountId, sourceAccountId).run();
    await c.env.DB.prepare("UPDATE sales_opportunities SET account_id = ? WHERE account_id = ?").bind(targetAccountId, sourceAccountId).run();
    await c.env.DB.prepare("UPDATE sales_observations SET account_id = ? WHERE account_id = ?").bind(targetAccountId, sourceAccountId).run();
    await c.env.DB.prepare(`
      UPDATE sales_accounts
      SET duplicate_review_status = 'merged',
          merged_into_account_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(targetAccountId, sourceAccountId).run();

    return c.json({ success: true, source_account_id: sourceAccountId, target_account_id: targetAccountId, status: "merged" });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/leads/:lead_id/draft-email
 * Prepara un borrador de email usando una plantilla aprobada, sin enviarlo (requiere aprobación humana).
 */
internalRouter.post("/leads/:lead_id/draft-email", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const leadId = c.req.param("lead_id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const templateId = body.template_id || "ark_ledger_invitacion_oficial";
    const lead = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
    if (!lead) return c.json({ error: "Lead no encontrado" }, 404);

    const template = await c.env.DB.prepare("SELECT * FROM email_templates WHERE id = ? OR slug = ? LIMIT 1").bind(templateId, templateId).first<any>();
    if (!template) return c.json({ error: `Plantilla ${templateId} no encontrada` }, 404);

    const vars = {
      despacho_nombre: lead.despacho_nombre || "Despacho Contable",
      email: lead.email,
      ...body.variables,
    };

    const interpolate = (tpl: string, dict: Record<string, any>) => {
      let str = tpl || "";
      for (const [k, v] of Object.entries(dict)) {
        str = str.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
      }
      return str;
    };

    const draftSubject = interpolate(template.subject, vars);
    const draftHtml = interpolate(template.html_content, vars);

    return c.json({
      success: true,
      lead_id: leadId,
      template_id: template.id,
      draft: {
        to: lead.email,
        subject: draftSubject,
        html: draftHtml,
        requires_approval: true,
        approval_note: "El envío real de correos requiere aprobación explícita de Pablo en chat antes de ejecutarse.",
      },
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/campaigns/:id/prepare-batch
 * Prepara un lote de envío masivo para revisión humana antes del envío real.
 */
internalRouter.post("/campaigns/:id/prepare-batch", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  const campaignId = c.req.param("id");
  try {
    const body = await c.req.json().catch(() => ({}));
    const limit = Math.min(parseInt(body.limit || "20", 10) || 20, 100);
    const cohort = body.cohort || "ark_ledger_despachos";

    const { results } = await c.env.DB.prepare(`
      SELECT l.id, l.email, l.despacho_nombre, l.estado, l.score
      FROM sales_leads l
      JOIN sales_accounts a ON a.id = l.account_id
      WHERE (a.scian_code IN ('541211', '541212') OR a.tenant_id = 'acc_ark_ledger')
        AND l.email IS NOT NULL AND l.email != 'placeholder@lead.local'
        AND l.estado = 'nuevo'
      LIMIT ?
    `).bind(limit).all<any>();

    return c.json({
      success: true,
      campaign_id: campaignId,
      cohort,
      batch_size: results?.length || 0,
      candidates: results || [],
      requires_approval: true,
      approval_note: "La ejecución del envío masivo requiere confirmación y aprobación de Pablo en chat.",
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

/**
 * POST /api/internal/voice/prepare-call
 * Prepara el contexto y resumen para una llamada telefónica sin iniciarla (aprobación requerida).
 */
internalRouter.post("/voice/prepare-call", async (c) => {
  if (!c.env.DB) return c.json({ error: "DB no disponible" }, 503);
  try {
    const body = await c.req.json().catch(() => ({}));
    const leadId = body.lead_id;
    if (!leadId) return c.json({ error: "lead_id es obligatorio" }, 400);

    const lead = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(leadId).first<any>();
    if (!lead) return c.json({ error: "Lead no encontrado" }, 404);

    let phone = lead.phone;
    if (!phone && lead.account_id) {
      const contact = await c.env.DB.prepare("SELECT phone, whatsapp FROM sales_contacts WHERE account_id = ? LIMIT 1").bind(lead.account_id).first<any>();
      phone = contact?.whatsapp || contact?.phone || null;
    }

    return c.json({
      success: true,
      lead_id: leadId,
      prospect: {
        despacho_nombre: lead.despacho_nombre,
        phone,
        dolor_detectado: lead.dolor_detectado || "fiscal",
        tamano: lead.tamano,
      },
      script_brief: `Llamada de presentación sobre Ark Ledger para ${lead.despacho_nombre || "el despacho"}.`,
      requires_approval: true,
      approval_note: "La llamada no se iniciará sin la aprobación explícita de Pablo en el chat.",
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});
