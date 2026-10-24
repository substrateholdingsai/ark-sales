import { Env, ChatMessage, AgentId } from "../types";
import { AgentOrchestrator } from "../agents/orchestrator";

export interface SalesAgentSessionState {
  lead_id: string;
  agente_id: AgentId;
  history: ChatMessage[];
  email?: string;
  despacho_nombre?: string;
  tamano?: string;
  dolor_detectado?: string;
}

export class SalesAgent {
  private state: DurableObjectState;
  private env: Env;
  private orchestrator: AgentOrchestrator;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.orchestrator = new AgentOrchestrator(env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const body: any = await request.json();
        const { message, lead_id, email, despacho_nombre, tamano } = body;

        if (!message) {
          return new Response(JSON.stringify({ error: "message is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const result = await this.handleChat({
          message,
          lead_id: lead_id || this.state.id.toString(),
          email,
          despacho_nombre,
          tamano,
        });

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.error("[SalesAgent DO] Error procesando /chat:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/state" && request.method === "GET") {
      const session = await this.getSession();
      return new Response(JSON.stringify(session), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private async getSession(): Promise<SalesAgentSessionState> {
    const session = await this.state.storage.get<SalesAgentSessionState>("session");
    if (session) {
      return session;
    }

    const defaultSession: SalesAgentSessionState = {
      lead_id: this.state.id.toString(),
      agente_id: "intake",
      history: [],
    };
    await this.state.storage.put("session", defaultSession);
    return defaultSession;
  }

  async handleChat(params: {
    message: string;
    lead_id: string;
    email?: string;
    despacho_nombre?: string;
    tamano?: string;
  }) {
    const session = await this.getSession();

    // Actualizar metadata del lead si viene en el request
    if (params.email) session.email = params.email;
    if (params.despacho_nombre) session.despacho_nombre = params.despacho_nombre;
    if (params.tamano) session.tamano = params.tamano;
    session.lead_id = params.lead_id;

    // 1. Guardar mensaje de usuario en memoria DO y en D1
    const userMsg: ChatMessage = { role: "user", content: params.message };
    session.history.push(userMsg);

    await this.persistMessageToD1({
      lead_id: session.lead_id,
      agente_id: session.agente_id,
      role: "user",
      content: params.message,
    });

    // 2. Procesar respuesta mediante orquestador
    const orchestration = await this.orchestrator.processMessage({
      lead_id: session.lead_id,
      currentAgent: session.agente_id,
      history: session.history.slice(0, -1),
      userMessage: params.message,
      leadContext: {
        email: session.email,
        despacho_nombre: session.despacho_nombre,
        tamano: session.tamano,
      },
    });

    // 3. Si hubo cambio o transferencia de agente, actualizar sesión y D1
    if (orchestration.transferred_to) {
      session.agente_id = orchestration.transferred_to;
      await this.updateLeadSpecialistInD1(session.lead_id, orchestration.transferred_to);
    }

    // 4. Guardar respuesta del asistente en memoria DO y en D1
    const assistantMsg: ChatMessage = { role: "assistant", content: orchestration.response };
    session.history.push(assistantMsg);

    await this.persistMessageToD1({
      lead_id: session.lead_id,
      agente_id: session.agente_id,
      role: "assistant",
      content: orchestration.response,
      metadata_json: JSON.stringify({ tools_called: orchestration.tools_called }),
    });

    // Guardar estado en DO Storage
    await this.state.storage.put("session", session);

    return {
      lead_id: session.lead_id,
      agente_id: session.agente_id,
      transferred_to: orchestration.transferred_to,
      response: orchestration.response,
      tools_called: orchestration.tools_called,
    };
  }

  private async persistMessageToD1(msg: {
    lead_id: string;
    agente_id: AgentId;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    metadata_json?: string;
  }) {
    if (!this.env.DB) return;
    try {
      const msgId = `conv_${crypto.randomUUID()}`;
      await this.env.DB.prepare(`
        INSERT INTO sales_conversations (id, lead_id, agente_id, role, content, metadata_json, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(msgId, msg.lead_id, msg.agente_id, msg.role, msg.content, msg.metadata_json || null).run();
    } catch (err) {
      console.error("[SalesAgent DO] Error guardando conversación en D1:", err);
    }
  }

  private async updateLeadSpecialistInD1(leadId: string, specialist: AgentId) {
    if (!this.env.DB) return;
    try {
      await this.env.DB.prepare(`
        UPDATE sales_leads 
        SET especialista_asignado = ?, estado = 'en_conversacion', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(specialist, leadId).run();
    } catch (err) {
      console.error("[SalesAgent DO] Error actualizando especialista en D1:", err);
    }
  }
}
