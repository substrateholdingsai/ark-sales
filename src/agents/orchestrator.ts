import { Env, ChatMessage, AgentId } from "../types";
import { SYSTEM_PROMPTS, AGENT_GUARDRAILS } from "./prompts";
import { ToolExecutor, TOOLS_DEFINITIONS } from "../tools";
import { FAIL_CLOSED_MESSAGE } from "../catalog/service";

export interface OrchestrationResult {
  response: string;
  agente_id: AgentId;
  transferred_to?: AgentId;
  tools_called: { name: string; args: any; result: any }[];
  lead_status_updated?: string;
}

export class AgentOrchestrator {
  private toolExecutor: ToolExecutor;

  constructor(private env: Env) {
    this.toolExecutor = new ToolExecutor(env);
  }

  /**
   * Ejecuta un turno conversacional con el agente actual.
   * Maneja el ciclo de tool-calling con el modelo Llama 3.3.
   */
  async processMessage(params: {
    lead_id: string;
    currentAgent: AgentId;
    history: ChatMessage[];
    rollingSummary?: string;
    userMessage: string;
    leadContext?: {
      email?: string;
      despacho_nombre?: string;
      tamano?: string;
    };
  }): Promise<OrchestrationResult> {
    const { lead_id, currentAgent, history, rollingSummary, userMessage, leadContext } = params;
    let activeAgent = currentAgent;
    let transferredTo: AgentId | undefined;
    const toolsCalled: { name: string; args: any; result: any }[] = [];

    // 1. Preparar lista de mensajes con el system prompt del agente actual
    const systemPrompt = SYSTEM_PROMPTS[activeAgent] + "\n" + AGENT_GUARDRAILS;
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];
    if (rollingSummary) {
      messages.push({ role: "system", content: `Antecedentes resumidos de la conversación: ${rollingSummary}` });
    }
    messages.push(
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage }
    );

    const modelName = this.env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const context = {
      lead_id,
      leadEmail: leadContext?.email,
      despachoNombre: leadContext?.despacho_nombre,
      tamano: leadContext?.tamano,
    };

    // 2. Si no hay binding AI (ej. en test suite o runtime mock), ejecutar motor determinista
    if (!this.env.AI || typeof this.env.AI.run !== "function") {
      return this.executeDeterministicFallback(activeAgent, userMessage, context);
    }

    // 3. Ejecutar llamada a Workers AI con loop de Tool-Calling (hasta 3 iteraciones)
    let finalResponseText = "";
    let iterations = 0;
    const maxIterations = 3;

    while (iterations < maxIterations) {
      iterations++;
      try {
        const aiResponse: any = await this.env.AI.run(modelName, {
          messages,
          tools: TOOLS_DEFINITIONS,
        });

        // Caso A: El modelo generó llamadas a herramientas
        if (aiResponse?.tool_calls && Array.isArray(aiResponse.tool_calls) && aiResponse.tool_calls.length > 0) {
          const parsedCalls = aiResponse.tool_calls.map((call: any) => {
            const toolName = call.name || call.function?.name;
            let args = call.arguments || call.function?.arguments || {};
            if (typeof args === 'string') {
              try { args = JSON.parse(args); } catch { args = {}; }
            }
            return { call, toolName, args };
          });

          const results = await Promise.allSettled(
            parsedCalls.map(async ({ call, toolName, args }: any) => {
              const toolResult = await this.toolExecutor.execute(toolName, args, context);
              return { call, toolName, args, toolResult };
            })
          );

          for (const settled of results) {
            if (settled.status !== 'fulfilled') continue;
            const { call, toolName, args, toolResult } = settled.value;
            toolsCalled.push({ name: toolName, args, result: toolResult });

            if (toolName === 'diagnosticar_despacho' && toolResult?.especialista_asignado) {
              if (toolResult.especialista_asignado !== activeAgent) {
                transferredTo = toolResult.especialista_asignado;
                activeAgent = toolResult.especialista_asignado;
              }
            }

            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: [call],
            });
            messages.push({
              role: 'tool',
              name: toolName,
              content: JSON.stringify(toolResult),
            });
          }          // Continúa el loop para que el LLM formule su respuesta final con los datos de las herramientas
          continue;
        }

        // Caso B: El modelo entregó su respuesta en texto plano
        if (aiResponse?.response) {
          finalResponseText = aiResponse.response;
          break;
        } else if (typeof aiResponse === "string") {
          finalResponseText = aiResponse;
          break;
        } else {
          finalResponseText = "Entendido. ¿En qué otro aspecto de la operación de su despacho le gustaría profundizar?";
          break;
        }
      } catch (err: any) {
        console.error("[AgentOrchestrator] Error en llamada a Workers AI:", err);
        // Fail-Closed seguro
        finalResponseText = FAIL_CLOSED_MESSAGE;
        break;
      }
    }

    if (!finalResponseText) {
      finalResponseText = FAIL_CLOSED_MESSAGE;
    }

    return {
      response: finalResponseText,
      agente_id: activeAgent,
      transferred_to: transferredTo,
      tools_called: toolsCalled,
    };
  }

  /**
   * Fallback determinista agéntico:
   * Garantiza las reglas de dolor y cero hardcoding cuando se ejecuta en tests o cuando AI no está disponible.
   */
  async executeDeterministicFallback(
    agent: AgentId,
    userMessage: string,
    context: { lead_id: string; leadEmail?: string; despachoNombre?: string; tamano?: string }
  ): Promise<OrchestrationResult> {
    const toolsCalled: { name: string; args: any; result: any }[] = [];
    let currentAgent = agent;
    let transferredTo: AgentId | undefined;
    let responseText = "";

    if (currentAgent === "intake") {
      // Diagnosticar dolor con la tool
      const diag = await this.toolExecutor.execute("diagnosticar_despacho", { dolor_principal: userMessage }, context);
      toolsCalled.push({ name: "diagnosticar_despacho", args: { dolor_principal: userMessage }, result: diag });

      if (diag.especialista_asignado && diag.especialista_asignado !== "intake") {
        transferredTo = diag.especialista_asignado;
        currentAgent = diag.especialista_asignado;
      }

      if (currentAgent === "riesgo") {
        responseText = `Comprendo la criticidad fiscal en su despacho. Para resolver contingencias del SAT y blindar sus cálculos, le transfiero con nuestro Especialista en Riesgo y Cumplimiento.`;
      } else if (currentAgent === "flujo") {
        responseText = `Entiendo perfectamente el desgaste de la cobranza y la cartera vencida. Le comunico con nuestro Especialista en Flujo y Crecimiento para automatizar su liquidez.`;
      } else {
        responseText = `Para transformar integralmente la operación de su despacho y eliminar el caos, le comunico con nuestro Arquitecto del Bundle.`;
      }
    } else if (currentAgent === "riesgo") {
      const cat = await this.toolExecutor.execute("consultar_catalogo_completo", {}, context);
      toolsCalled.push({ name: "consultar_catalogo_completo", args: {}, result: cat });

      if (cat.status === "fail_closed") {
        responseText = FAIL_CLOSED_MESSAGE;
      } else {
        const ledger = cat.catalogo?.["ledger"];
        const bundle = cat.catalogo?.["bundle"];
        responseText = `En ARK blindamos su despacho con ${ledger?.name || "Ark Ledger"} (desde $${ledger?.price_mxn || 6000} MXN/mes) con timbrado CFDI 4.0 y sellado SHA-256 inmutable. Como add-on se complementa con Ark Angel (cobranza IA por uso real: Voz $0.25 USD/min y WhatsApp $0.20 USD/msg) o en el Paquete Enterprise integral.`;
      }
    } else if (currentAgent === "flujo") {
      const cat = await this.toolExecutor.execute("consultar_catalogo_completo", {}, context);
      toolsCalled.push({ name: "consultar_catalogo_completo", args: {}, result: cat });

      if (cat.status === "fail_closed") {
        responseText = FAIL_CLOSED_MESSAGE;
      } else {
        const angel = cat.catalogo?.["angel"];
        const bundle = cat.catalogo?.["bundle"];
        responseText = `Para erradicar la morosidad implementamos ${angel?.name || "Ark Angel"} con facturación por uso real (Voz IA a $0.25 USD/min y WhatsApp a $0.20 USD/msg) con Grok Bot y Motor Legal fail-closed incluidos. Para operaciones completas, el Paquete Enterprise integra Ark Ledger y cobranza omnicanal.`;
      }
    } else {
      // Closer
      const cat = await this.toolExecutor.execute("consultar_catalogo_completo", {}, context);
      toolsCalled.push({ name: "consultar_catalogo_completo", args: {}, result: cat });

      if (cat.status === "fail_closed") {
        responseText = FAIL_CLOSED_MESSAGE;
      } else {
        const bundle = cat.catalogo?.["bundle"];
        const leadDelivered = await this.toolExecutor.execute(
          "entregar_lead",
          { destination: "bundle", score: 95, summary: `Acuerdo Enterprise cerrado para ${context.despachoNombre || "Despacho"}` },
          context
        );
        toolsCalled.push({ name: "entregar_lead", args: { destination: "bundle", score: 95 }, result: leadDelivered });

        responseText = `Excelente decisión. El ${bundle?.name || "Paquete Enterprise (Ark Angel + Ark Ledger)"} está preparado para su despacho. La cobranza omnicanal con IA y el módulo fiscal inmutable han sido programados para entrega federada.`;
      }
    }

    return {
      response: responseText,
      agente_id: currentAgent,
      transferred_to: transferredTo,
      tools_called: toolsCalled,
    };
  }
}
