import { Hono } from "hono";
import { z } from "zod";
import { Env, AgentSkill, LeadExecutiveContext } from "../types";
import { ensureAccountContactForLead, ensureTask } from "../crm/automation";

export type InternalVariables = {
  operator?: "staypuft" | "grok_bot" | "internal_service";
};

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
  const expectedService = c.env.INTERNAL_SERVICE_KEY;
  const expectedToken = c.env.INTERNAL_API_TOKEN;
  const expectedStayPuft = c.env.STAYPUFT_API_KEY;

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
  } else if ((c.env.ENVIRONMENT || "development") === "production") {
    return c.json({ error: "Unauthorized: internal key not configured." }, 401);
  }

  // Rate Limiting anti-abuso
  const rateLimitKey = `${operator}:${provided.slice(0, 10)}`;
  if (!checkInternalRateLimit(rateLimitKey, 120, 60000)) {
    return c.json({ error: "Too Many Requests: Rate limit exceeded (120 req/min)." }, 429);
  }

  c.set("operator", operator);

  // Control de Acceso Estricto para StayPuft (Least Privilege - Req 1)
  // StayPuft solo puede: leer pendientes, leer contexto, ejecutar skills y enriquecer leads.
  // Nada de borrar, cambiar catálogo ni manipular usuarios.
  if (operator === "staypuft") {
    const path = c.req.path;
    const method = c.req.method.toUpperCase();

    const isPending = method === "GET" && path.endsWith("/skills/pending");
    const isExecute = method === "POST" && path.endsWith("/skills/execute");
    const isSkills = method === "GET" && path.endsWith("/skills");
    const isContext = (method === "GET" || method === "POST") && path.endsWith("/context");
    const isEnrich = method === "POST" && /\/leads\/[^/]+\/enrich$/.test(path);
    const isMetrics = method === "GET" && (path.endsWith("/harvest/metrics") || path.endsWith("/metrics"));

    if (!isPending && !isExecute && !isSkills && !isContext && !isEnrich && !isMetrics) {
      return c.json({
        error: "Forbidden: StayPuft operator does not have permission to access this endpoint or perform destructive operations.",
        allowed_endpoints: [
          "GET /api/internal/skills/pending",
          "POST /api/internal/skills/execute",
          "GET /api/internal/context",
          "POST /api/internal/context",
          "POST /api/internal/leads/:lead_id/enrich",
          "GET /api/internal/harvest/metrics",
        ],
      }, 403);
    }
  }

  await next();
});

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
 * Validador de esquemas de salida (JSON Schema Contract) para las Habilidades de StayPuft
 */
export function validateSkillResult(skillName: string, result: any): { success: boolean; error?: string } {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { success: false, error: "El resultado debe ser un objeto JSON válido." };
  }

  if (skillName === "research_prospect_web") {
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
        const val = validateSkillResult(effectiveSkill, result);
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
          const effectiveSize = result.tamano_estimado || "1-5";
          const techList = Array.isArray(result.software_detectado) ? result.software_detectado.join(", ") : "";
          const partnersList = Array.isArray(result.socios) ? result.socios.join(", ") : "";
          const painList = Array.isArray(result.senales_dolor) ? result.senales_dolor.join(", ") : "";

          const summaryAdd = ` [staypuft_autonomous_research] Tamaño: ${effectiveSize}. Tech: ${techList || "N/D"}. Socios: ${partnersList || "N/D"}. Dolor: ${painList || "N/D"}. Confianza: ${result.confianza || 0}%. Fuentes: ${(result.fuentes || []).join(", ")}.`;

          await c.env.DB.prepare(`
            UPDATE sales_leads
            SET tamano = ?,
                conversation_summary = COALESCE(conversation_summary, '') || ?,
                score = MIN(100, score + 15),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(effectiveSize, summaryAdd, lead_id).run();
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
      operator,
      message: `Lead enriquecido exitosamente por ${operator}.`,
    }, 200);
  } catch (err: any) {
    console.error("[leads/enrich] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

/**
 * Endpoint de Métricas de Harvesting y Monitoreo Agéntico (/api/internal/harvest/metrics)
 * Permite a StayPuft y al sistema consultar cuentas, SCIAN, señales, cohortes y ejecuciones.
 */
internalRouter.get("/harvest/metrics", async (c) => {
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
    }, 200);
  } catch (err: any) {
    return c.json({ error: err?.message || "Error obteniendo métricas" }, 500);
  }
});

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
