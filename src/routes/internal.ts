import { Hono } from "hono";
import { z } from "zod";
import { Env, AgentSkill, LeadExecutiveContext } from "../types";

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
        const fromEmail = c.env.RESEND_FROM_EMAIL || "ventas@arksystems.site";
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
