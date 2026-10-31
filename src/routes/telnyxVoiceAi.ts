import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables, requireAuth } from "../auth/middleware";
import { ToolExecutor } from "../tools";
import { CatalogService, FAIL_CLOSED_MESSAGE } from "../catalog/service";
import { normalizarTelefonoE164 } from "../voice/telnyx";

export const telnyxVoiceAiRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function safeJson(text: string): any {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function extractToolName(body: any): string {
  return (
    body?.tool_name ||
    body?.tool ||
    body?.name ||
    body?.function?.name ||
    body?.action ||
    body?.tool_call?.name ||
    ""
  );
}

function extractArgs(body: any): any {
  const args =
    body?.arguments ||
    body?.args ||
    body?.parameters ||
    body?.params ||
    body?.input ||
    body?.body_parameters ||
    body?.payload;
  if (args && typeof args === "object" && !Array.isArray(args)) {
    // If args is the whole body with meta keys, clone and strip meta
    const clone: any = { ...args };
    return clone;
  }
  // Fallback: treat body itself as args, stripping meta keys
  const clone: any = { ...(body || {}) };
  delete clone.tool_name;
  delete clone.tool;
  delete clone.name;
  delete clone.function;
  delete clone.action;
  delete clone.arguments;
  delete clone.args;
  delete clone.parameters;
  delete clone.params;
  delete clone.input;
  delete clone.body_parameters;
  delete clone.payload;
  delete clone.call_control_id;
  delete clone.session_id;
  delete clone.conversation_id;
  delete clone.lead_id;
  return clone;
}

function extractCallControlId(body: any, c: any): string {
  return (
    c.req.header("x-telnyx-call-control-id") ||
    body?.call_control_id ||
    body?.session_id ||
    body?.conversation_id ||
    body?.call_session_id ||
    ""
  );
}

// A. Endpoint de ejecución de herramientas
telnyxVoiceAiRouter.post("/tools", async (c) => {
  try {
    const bodyText = await c.req.text();
    const body = safeJson(bodyText);
    const toolName = extractToolName(body);
    const args = extractArgs(body);
    const callControlId = extractCallControlId(body, c);
    const leadId =
      body?.lead_id || args?.lead_id || body?.leadId || args?.leadId || "";

    const executor = new ToolExecutor(c.env);
    let result: any = { status: "unknown_tool", error: `Herramienta desconocida: ${toolName}` };

    switch (toolName) {
      case "consultar_catalogo_completo":
      case "consultar_catalogo":
      case "consultar_catalog":
      case "":
        // Si no se especifica herramienta, por defecto consultar catálogo
        result = await executor.consultarCatalogo();
        break;

      case "diagnosticar_despacho":
      case "diagnosticar":
        result = executor.diagnosticarDespacho(
          args?.dolor_principal || args?.dolor || args?.pain || "",
          args?.tamano || args?.size,
          args?.productos_interes || args?.products
        );
        break;

      case "agendar_demo_o_entregar_lead":
      case "agendar_demo":
      case "entregar_lead":
      case "registrar_intencion":
        {
          const destination =
            args?.destination ||
            args?.destino ||
            "bundle";
          const score = args?.score ?? 85;
          const summary =
            args?.summary ||
            args?.resumen ||
            args?.conversation_summary ||
            "Intención de compra registrada vía voz Telnyx.";
          const context = {
            lead_id: leadId || "voice_lead",
            leadEmail: args?.email || args?.leadEmail,
            despachoNombre: args?.despacho_nombre || args?.despachoNombre || body?.despacho_nombre,
            tamano: args?.tamano || args?.size,
          };

          // Registrar tarea en CRM (autoTaskOnQualifiedLead se ejecuta dentro de entregarLead)
          result = await executor.entregarLead(destination, score, summary, context);

          // Actualizar intención en lead si existe
          if (c.env.DB && leadId) {
            try {
              const outcome = args?.outcome || "demo_agendada";
              await c.env.DB.prepare(
                "UPDATE sales_leads SET estado = 'calificado', last_call_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
              )
                .bind(leadId)
                .run();
            } catch (e) {
              console.warn("[telnyxVoiceAi:tools] lead update failed:", e);
            }
          }

          // Encolar en SALES_INGEST_QUEUE ya lo hace entregarLead
          break;
        }

      default:
        // Intentar inferir por campos presentes
        if (args && (args.dolor_principal || args.dolor)) {
          result = executor.diagnosticarDespacho(
            args.dolor_principal || args.dolor || "",
            args.tamano || args.size,
            args.productos_interes || args.products
          );
        } else if (args && (args.destination || args.destino)) {
          const destination = args.destination || args.destino || "bundle";
          result = await executor.entregarLead(
            destination,
            args.score ?? 85,
            args.summary || args.resumen || "Intención de compra registrada vía voz Telnyx.",
            {
              lead_id: leadId || "voice_lead",
              leadEmail: args.email,
              despachoNombre: args.despacho_nombre,
              tamano: args.tamano,
            }
          );
        } else {
          result = await executor.consultarCatalogo();
        }
        break;
    }

    // Persistir tools ejecutadas si hay sesión de voz activa
    if (c.env.DB && callControlId && toolName) {
      try {
        await c.env.DB.prepare(
          "UPDATE sales_voice_sessions SET tools_executed_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
          .bind(JSON.stringify([toolName]), callControlId)
          .run();
      } catch {
        // ignore if session not exists
      }
    }

    const payload = {
      success: true,
      tool: toolName || "consultar_catalogo_completo",
      call_control_id: callControlId || undefined,
      lead_id: leadId || undefined,
      ...result,
      result,
      output: result,
      data: result,
    };

    return c.json(payload, 200);
  } catch (err: any) {
    console.error("[telnyxVoiceAi:tools] Error:", err);
    return c.json(
      {
        success: false,
        status: "fail_closed",
        message: FAIL_CLOSED_MESSAGE,
        error: err?.message || "TOOL_EXECUTION_FAILED",
      },
      200
    );
  }
});

// B. Endpoint de eventos y cierre de llamada
telnyxVoiceAiRouter.post("/events", async (c) => {
  try {
    const bodyText = await c.req.text();
    const body = safeJson(bodyText);

    // Verificación de firma opcional (fail-open en dev)
    if (c.env.TELNYX_PUBLIC_KEY) {
      const signature = c.req.header("telnyx-signature-ed25519") || "";
      const timestamp = c.req.header("telnyx-timestamp") || "";
      const { verificarFirmaTelnyx } = await import("../voice/telnyx");
      const ok = await verificarFirmaTelnyx(c.env.TELNYX_PUBLIC_KEY, signature, timestamp, bodyText);
      if (!ok) {
        return c.json({ error: "Firma de Telnyx inválida." }, 403);
      }
    }

    const eventType =
      body?.event_type ||
      body?.type ||
      body?.data?.event_type ||
      body?.data?.type ||
      body?.name ||
      body?.event ||
      "";
    const payload =
      body?.payload ||
      body?.data?.payload ||
      body?.data ||
      body;

    const callControlId =
      payload?.call_control_id ||
      payload?.session_id ||
      payload?.conversation_id ||
      body?.call_control_id ||
      body?.session_id ||
      body?.conversation_id ||
      "";
    const sessionId = callControlId || `voice_${crypto.randomUUID()}`;

    const fromNumber =
      payload?.from ||
      payload?.from_number ||
      body?.from ||
      body?.from_number ||
      "";
    const toNumber =
      payload?.to ||
      payload?.to_number ||
      body?.to ||
      body?.to_number ||
      "";
    const direction =
      payload?.direction ||
      body?.direction ||
      (payload?.telnyx_end_user_target ? "inbound" : "outbound");
    const recordingUrl =
      payload?.recording_url ||
      payload?.recording?.download_urls?.mp3 ||
      payload?.recording?.url ||
      payload?.recording_url_mp3 ||
      body?.recording_url ||
      "";
    const transcript =
      payload?.transcript ||
      payload?.transcription_text ||
      payload?.transcription?.transcript ||
      payload?.full_transcript ||
      payload?.text ||
      body?.transcript ||
      body?.full_transcript ||
      "";
    const assistantTranscript =
      payload?.assistant_transcript ||
      payload?.agent_transcript ||
      payload?.bot_transcript ||
      body?.assistant_transcript ||
      "";
    const summary =
      payload?.summary ||
      payload?.conversation_summary ||
      body?.summary ||
      "";
    const detectedIntent =
      payload?.detected_intent ||
      body?.detected_intent ||
      "";
    const outcome =
      payload?.outcome ||
      body?.outcome ||
      (eventType.includes("completed") ? "calificado" : "");
    const durationSeconds =
      payload?.duration_sec ||
      payload?.duration_seconds ||
      body?.duration_sec ||
      body?.duration_seconds ||
      0;
    const costUsd =
      payload?.cost?.total ||
      payload?.cost_usd ||
      body?.cost_usd ||
      0;
    const leadId =
      payload?.lead_id ||
      body?.lead_id ||
      payload?.client_state_lead_id ||
      "";
    const accountId = payload?.account_id || body?.account_id || "";
    const contactId = payload?.contact_id || body?.contact_id || "";

    // Decodificar client_state si viene
    let clientState: any = {};
    if (payload?.client_state) {
      try {
        clientState = JSON.parse(atob(payload.client_state));
      } catch {
        clientState = {};
      }
    }
    const resolvedLeadId = leadId || clientState?.leadId || clientState?.lead_id || "";

    // 1. Upsert sesión de voz
    if (c.env.DB) {
      try {
        const existing = await c.env.DB.prepare(
          "SELECT id FROM sales_voice_sessions WHERE id = ?"
        )
          .bind(sessionId)
          .first<any>();

        if (existing) {
          const sets: string[] = [];
          const vals: any[] = [];
          if (recordingUrl) {
            sets.push("recording_url = ?");
            vals.push(recordingUrl);
          }
          if (transcript) {
            sets.push("full_transcript = ?");
            vals.push(transcript);
          }
          if (summary) {
            sets.push("summary = ?");
            vals.push(summary);
          }
          if (detectedIntent) {
            sets.push("detected_intent = ?");
            vals.push(detectedIntent);
          }
          if (outcome) {
            sets.push("outcome = ?");
            vals.push(outcome);
          }
          if (durationSeconds) {
            sets.push("duration_seconds = ?");
            vals.push(durationSeconds);
          }
          if (costUsd) {
            sets.push("cost_usd = ?");
            vals.push(costUsd);
          }
          if (resolvedLeadId) {
            sets.push("lead_id = ?");
            vals.push(resolvedLeadId);
          }
          if (accountId) {
            sets.push("account_id = ?");
            vals.push(accountId);
          }
          if (contactId) {
            sets.push("contact_id = ?");
            vals.push(contactId);
          }
          sets.push("updated_at = CURRENT_TIMESTAMP");
          if (sets.length > 0) {
            await c.env.DB.prepare(
              `UPDATE sales_voice_sessions SET ${sets.join(", ")} WHERE id = ?`
            )
              .bind(...vals, sessionId)
              .run();
          }
        } else {
          await c.env.DB.prepare(
            `INSERT INTO sales_voice_sessions (id, lead_id, account_id, contact_id, direction, from_number, to_number, duration_seconds, cost_usd, recording_url, full_transcript, summary, detected_intent, outcome, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          )
            .bind(
              sessionId,
              resolvedLeadId || null,
              accountId || null,
              contactId || null,
              direction === "inbound" ? "inbound" : "outbound",
              fromNumber || "",
              toNumber || "",
              durationSeconds || 0,
              costUsd || 0,
              recordingUrl || null,
              transcript || null,
              summary || null,
              detectedIntent || null,
              outcome || null
            )
            .run();
        }
      } catch (dbErr) {
        console.warn("[telnyxVoiceAi:events] DB session upsert failed:", dbErr);
      }
    }

    // 2. Persistir transcripción en sales_conversations (role user y assistant)
    if (c.env.DB && resolvedLeadId && transcript) {
      try {
        await c.env.DB.prepare(
          "INSERT INTO sales_conversations (id, lead_id, agente_id, role, content, metadata_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
          .bind(
            `conv_${crypto.randomUUID()}`,
            resolvedLeadId,
            "intake",
            "user",
            transcript,
            JSON.stringify({ source: "telnyx_voice", session_id: sessionId })
          )
          .run();

        const assistantContent = assistantTranscript || summary || transcript;
        await c.env.DB.prepare(
          "INSERT INTO sales_conversations (id, lead_id, agente_id, role, content, metadata_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
          .bind(
            `conv_${crypto.randomUUID()}`,
            resolvedLeadId,
            "intake",
            "assistant",
            assistantContent,
            JSON.stringify({ source: "telnyx_voice", session_id: sessionId })
          )
          .run();
      } catch (dbErr) {
        console.warn("[telnyxVoiceAi:events] conversations persist failed:", dbErr);
      }
    }

    // 3. Actualizar estado del lead
    if (c.env.DB && resolvedLeadId) {
      try {
        const isCompleted =
          eventType.includes("completed") ||
          eventType.includes("ended") ||
          eventType.includes("hangup") ||
          eventType.includes("analyzed");
        if (isCompleted) {
          await c.env.DB.prepare(
            "UPDATE sales_leads SET last_call_status = 'completed', estado = 'calificado', last_call_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          )
            .bind(resolvedLeadId)
            .run();
        } else if (eventType.includes("recording") || eventType.includes("transcription")) {
          await c.env.DB.prepare(
            "UPDATE sales_leads SET last_call_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          )
            .bind(resolvedLeadId)
            .run();
        }
      } catch (dbErr) {
        console.warn("[telnyxVoiceAi:events] lead update failed:", dbErr);
      }
    }

    // 4. Inyectar transcripción en Durable Object SalesAgent si está activo
    if (resolvedLeadId && transcript && c.env.SALES_AGENT && typeof c.env.SALES_AGENT.idFromName === "function") {
      try {
        const doId = c.env.SALES_AGENT.idFromName(resolvedLeadId);
        const stub = c.env.SALES_AGENT.get(doId);
        await stub.fetch("https://sales-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: resolvedLeadId,
            message: `[TRANSCRIPCIÓN DE LLAMADA TELNYX]: ${transcript}`,
            despacho_nombre: clientState?.despachoNombre,
          }),
        });
      } catch (doErr) {
        console.warn("[telnyxVoiceAi:events] DO injection failed:", doErr);
      }
    }

    return c.json(
      {
        success: true,
        event_type: eventType,
        session_id: sessionId,
        lead_id: resolvedLeadId || undefined,
        handled: true,
      },
      200
    );
  } catch (err: any) {
    console.error("[telnyxVoiceAi:events] Error:", err);
    return c.json({ success: false, error: err?.message || "EVENT_PROCESSING_FAILED" }, 500);
  }
});

// C. Endpoint para disparar llamada saliente interactiva
telnyxVoiceAiRouter.post("/outbound-ai", requireAuth(), async (c) => {
  try {
    const body = await c.req.json();
    const { lead_id, to, despacho_nombre, dolor_principal } = body || {};

    if (!to) {
      return c.json({ error: "El campo 'to' (teléfono) es obligatorio." }, 400);
    }

    const norm = normalizarTelefonoE164(String(to));
    if (!norm.valid || !norm.e164) {
      return c.json({ error: norm.error || "Número telefónico inválido." }, 400);
    }
    const phoneE164 = norm.e164;

    const fromNumber = c.env.TELNYX_PHONE_NUMBER || "+525500000000";

    // Modo simulado si no hay API key
    if (!c.env.TELNYX_API_KEY) {
      const simulatedId = `ai_call_sim_${crypto.randomUUID().slice(0, 8)}`;
      if (c.env.DB && lead_id) {
        try {
          await c.env.DB.prepare(
            "UPDATE sales_leads SET phone = ?, last_call_status = 'initiated', last_call_at = CURRENT_TIMESTAMP WHERE id = ?"
          )
            .bind(phoneE164, lead_id)
            .run();
        } catch (dbErr) {
          console.warn("[telnyxVoiceAi:outbound] DB update failed:", dbErr);
        }
      }
      return c.json(
        {
          success: true,
          simulated: true,
          call_control_id: simulatedId,
          phone_e164: phoneE164,
          message: `Llamada de voz IA simulada a ${phoneE164}`,
        },
        200
      );
    }

    const payload: any = {
      to: phoneE164,
      from: fromNumber,
      dynamic_variables: {
        lead_id: lead_id || null,
        despacho_nombre: despacho_nombre || null,
        dolor_principal: dolor_principal || null,
      },
      metadata: {
        lead_id: lead_id || null,
        source: "ark-sales-voice-ai",
      },
    };

    if (c.env.TELNYX_AI_ASSISTANT_ID) {
      payload.assistant_id = c.env.TELNYX_AI_ASSISTANT_ID;
    }
    if (c.env.TELNYX_CONNECTION_ID) {
      payload.connection_id = c.env.TELNYX_CONNECTION_ID;
    }

    const response = await fetch("https://api.telnyx.com/v2/ai/conversations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[telnyxVoiceAi:outbound] Telnyx error ${response.status}:`, errBody);
      return c.json(
        {
          success: false,
          error: `TELNYX_HTTP_${response.status}`,
          message: errBody,
        },
        400
      );
    }

    const data: any = await response.json();
    const callControlId =
      data?.call_control_id ||
      data?.data?.call_control_id ||
      data?.id ||
      data?.conversation_id ||
      `ai_call_${crypto.randomUUID().slice(0, 8)}`;

    if (c.env.DB && lead_id) {
      try {
        await c.env.DB.prepare(
          "UPDATE sales_leads SET phone = ?, last_call_status = 'initiated', last_call_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
          .bind(phoneE164, lead_id)
          .run();
      } catch (dbErr) {
        console.warn("[telnyxVoiceAi:outbound] DB update failed:", dbErr);
      }
    }

    return c.json(
      {
        success: true,
        simulated: false,
        call_control_id: callControlId,
        phone_e164: phoneE164,
        message: `Llamada de voz IA iniciada a ${phoneE164}`,
      },
      200
    );
  } catch (err: any) {
    console.error("[telnyxVoiceAi:outbound] Error:", err);
    return c.json({ success: false, error: err?.message || "OUTBOUND_AI_FAILED" }, 500);
  }
});

export default telnyxVoiceAiRouter;
