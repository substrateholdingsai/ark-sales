import { Hono } from "hono";
import { z } from "zod";
import { Env, AgentSkill, LeadExecutiveContext } from "../types";
import { ensureAccountContactForLead, ensureTask } from "../crm/automation";

export const internalRouter = new Hono<{ Bindings: Env }>();

internalRouter.use("*", async (c, next) => {
  const expectedService = c.env.INTERNAL_SERVICE_KEY;
  const expectedToken = c.env.INTERNAL_API_TOKEN;
  const authHeader = c.req.header("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const provided = c.req.header("X-Ark-Internal-Key") || c.req.header("X-Internal-Token") || bearer;
  if (!provided) {
    return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
  }
  if (expectedService || expectedToken) {
    if (provided !== expectedService && provided !== expectedToken) {
      return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
    }
  } else if ((c.env.ENVIRONMENT || "development") === "production") {
    return c.json({ error: "Unauthorized: internal key not configured." }, 401);
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
 * 4. Endpoint para Disparar Skills (/api/internal/skills/execute)
 * Recibe skill_name y payload, y devuelve la instrucciÃ³n de ejecuciÃ³n para Grok Bot.
 */
internalRouter.post("/skills/execute", async (c) => {
  try {
    const body = await c.req.json();
    const { skill_name, payload } = body;

    if (!skill_name || typeof skill_name !== "string") {
      return c.json({ error: "El campo 'skill_name' es obligatorio y debe ser texto." }, 400);
    }

    if (!c.env.DB) {
      return c.json({ error: "D1 no disponible" }, 503);
    }

    // 1. Consultar si la skill estÃ¡ registrada y activa en agent_skills
    const skill = await c.env.DB.prepare(`
      SELECT * FROM agent_skills
      WHERE skill_name = ? AND is_active = 1
      LIMIT 1
    `).bind(skill_name).first<AgentSkill>();

    if (!skill) {
      return c.json({
        error: `Skill '${skill_name}' no encontrada o inactiva en el registro de habilidades de Grok Bot.`,
        available_skills_endpoint: "/api/internal/skills",
      }, 404);
    }

    // 2. Validar campos requeridos segÃºn input_schema si existe
    if (skill.input_schema) {
      try {
        const schema = JSON.parse(skill.input_schema);
        if (schema.required && Array.isArray(schema.required)) {
          const payloadObj = payload || {};
          const missingFields = schema.required.filter((field: string) => payloadObj[field] === undefined || payloadObj[field] === null);
          if (missingFields.length > 0) {
            return c.json({
              error: `Payload incompleto para skill '${skill_name}'. Faltan campos requeridos: ${missingFields.join(", ")}`,
              required_fields: schema.required,
              schema,
            }, 400);
          }
        }
      } catch (schemaErr) {
        console.warn("[skills/execute] Error parseando input_schema:", schemaErr);
      }
    }

    // 3. Generar la instrucciÃ³n operativa para Grok Bot
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
        action: `Ejecutar la tarea autÃ³noma '${skill.skill_name}' en la computadora compartida.`,
        guidance: skill.description,
      },
    }, 200);
  } catch (err: any) {
    console.error("[skills/execute] Error:", err);
    return c.json({ error: err.message || "Error procesando ejecuciÃ³n de skill" }, 500);
  }
});

/**
 * Endpoint de descubrimiento de Habilidades (/api/internal/skills)
 * Permite a Grok Bot aprender quÃ© tareas puede ejecutar en la computadora.
 */
internalRouter.get("/skills", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  const { results: skills } = await c.env.DB.prepare(`
    SELECT * FROM agent_skills WHERE is_active = 1 ORDER BY agent_id, skill_name
  `).all<AgentSkill>();

  return c.json({
    count: skills ? skills.length : 0,
    skills: skills || [],
  });
});

/**
 * Endpoint de Polling para el Runner de Grok Bot (/api/internal/skills/pending)
 * Permite a grok_bot_computer_runner.py obtener el siguiente job de investigaciÃ³n pendiente.
 */
internalRouter.get("/skills/pending", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  try {
    // Buscar un lead con nombre de despacho que aÃºn no tenga investigaciÃ³n de Grok Bot
    const lead = await c.env.DB.prepare(`
      SELECT id, despacho_nombre
      FROM sales_leads
      WHERE despacho_nombre IS NOT NULL 
        AND despacho_nombre != ''
        AND (conversation_summary IS NULL OR conversation_summary NOT LIKE '%grok_bot_autonomous_research%')
      ORDER BY created_at DESC
      LIMIT 1
    `).first<{ id: string; despacho_nombre: string }>();

    if (!lead) {
      return c.json({ job: null });
    }

    return c.json({
      job: {
        lead_id: lead.id,
        despacho_nombre: lead.despacho_nombre,
        skill_name: "research_prospect_web",
      },
    });
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
    const { estimated_size, detected_tech, research_summary, confidence_score } = enrichment;

    // 1. Obtener lead actual
    const currentLead = await c.env.DB.prepare(`
      SELECT * FROM sales_leads WHERE id = ?
    `).bind(leadId).first<any>();

    if (!currentLead) {
      return c.json({ error: `Lead con ID '${leadId}' no encontrado.` }, 404);
    }

    // 2. Componer nuevo summary
    const techStr = Array.isArray(detected_tech) && detected_tech.length > 0 
      ? ` TecnologÃ­as detectadas: ${detected_tech.join(", ")}.` 
      : "";
    const newSummary = [
      currentLead.conversation_summary || "",
      `[grok_bot_autonomous_research] ${research_summary || ""}${techStr} Confianza: ${confidence_score || 0.8}.`
    ].filter(Boolean).join(" ");

    // 3. Actualizar en D1
    const newScore = Math.min(100, (currentLead.score || 0) + 15);
    const effectiveSize = currentLead.tamano || estimated_size || "1-5";

    await c.env.DB.prepare(`
      UPDATE sales_leads
      SET tamano = ?,
          conversation_summary = ?,
          score = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(effectiveSize, newSummary, newScore, leadId).run();

    // 4. Si el Durable Object estÃ¡ instanciado, registrar el hallazgo
    if (c.env.SALES_AGENT && typeof c.env.SALES_AGENT.idFromName === "function") {
      try {
        const doId = c.env.SALES_AGENT.idFromName(leadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            message: `[INTELIGENCIA AUTÃNOMA GROK BOT]: ${research_summary || "InvestigaciÃ³n completada."}${techStr}`,
            tamano: effectiveSize,
          }),
        });
      } catch (doErr) {
        console.warn("[leads/enrich] Error notificando a Durable Object:", doErr);
      }
    }

    return c.json({
      success: true,
      lead_id: leadId,
      tamano_asignado: effectiveSize,
      score_actualizado: newScore,
      message: "Lead enriquecido exitosamente por Grok Bot.",
    });
  } catch (err: any) {
    console.error("[leads/enrich] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});
/**
 * Endpoint de clasificación de dolor/vertical vía Workers AI.
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
