import { Hono } from "hono";
import { z } from "zod";
import { Env, AgentSkill, LeadExecutiveContext } from "../types";

export const internalRouter = new Hono<{ Bindings: Env }>();

internalRouter.use("*", async (c, next) => {
  const expected = c.env.INTERNAL_SERVICE_KEY;
  const authHeader = c.req.header("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  const provided = c.req.header("X-Ark-Internal-Key") || bearer;
  if (!provided) {
    return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
  }
  if (expected) {
    if (provided !== expected) {
      return c.json({ error: "Unauthorized: invalid or missing internal key." }, 401);
    }
  } else if ((c.env.ENVIRONMENT || "development") === "production") {
    return c.json({ error: "Unauthorized: internal key not configured." }, 401);
  }
  // In non-production without configured key, accept any non-empty key (dev/test convenience)
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
    return c.json({ error: "El parámetro query 'lead_id' es obligatorio." }, 400);
  }
  const leadId = leadIdParsed.data;
  if (!leadId) {
    return c.json({ error: "El parámetro query 'lead_id' es obligatorio." }, 400);
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
  const lastInteraction = convList[convList.length - 1]?.content || "Sin interacción previa";

  const executiveBrief = `RESUMEN EJECUTIVO PARA GROK BOT:
- Despacho: ${lead.despacho_nombre || "Despacho Contable"}
- Titular/Contacto: ${lead.email}
- Tamaño: ${lead.tamano || "No especificado"} colaboradores.
- Dolor Principal Detectado: ${lead.dolor_detectado || "General"}.
- Especialista Asignado: ${lead.especialista_asignado}.
- Estado Comercial: ${lead.estado} (Score: ${lead.score}/100).
- Total de Interacciones: ${totalInteractions}.
- Último Mensaje Clave: "${lastInteraction}".
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
 * Recibe skill_name y payload, y devuelve la instrucción de ejecución para Grok Bot.
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

    // 1. Consultar si la skill está registrada y activa en agent_skills
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

    // 2. Validar campos requeridos según input_schema si existe
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
 * Permite a Grok Bot aprender qué tareas puede ejecutar en la computadora.
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
 * Permite a grok_bot_computer_runner.py obtener el siguiente job de investigación pendiente.
 */
internalRouter.get("/skills/pending", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: "D1 no disponible" }, 503);
  }

  try {
    // Buscar un lead con nombre de despacho que aún no tenga investigación de Grok Bot
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
 * Recibe los datos extraídos por grok_bot_computer_runner.py y los persiste en D1 y Durable Objects.
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
      ? ` Tecnologías detectadas: ${detected_tech.join(", ")}.` 
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

    // 4. Si el Durable Object está instanciado, registrar el hallazgo
    if (c.env.SALES_AGENT && typeof c.env.SALES_AGENT.idFromName === "function") {
      try {
        const doId = c.env.SALES_AGENT.idFromName(leadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId,
            message: `[INTELIGENCIA AUTÓNOMA GROK BOT]: ${research_summary || "Investigación completada."}${techStr}`,
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
