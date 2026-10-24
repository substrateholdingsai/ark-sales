export type LeadIngestPayload = {
  version: 3;
  lead_id: string; // UUID generado por Ark Sales
  email: string;
  source_worker: "ark-sales";
  destination: "ledger" | "angel" | "commerce" | "bundle";
  vertical: "fiscal" | "cobranza" | "ecommerce" | "bundle";
  score: number; // 0-100
  conversation_summary: string;
  account_context: {
    despacho_nombre: string;
    tamano: "1-5" | "6-20" | "21-50" | "50+";
    productos_interes: string[];
    dolor_principal: string;
  };
};

export type AgentId = "intake" | "riesgo" | "flujo" | "closer";

export type ProductConfig = {
  id: string;
  product_key: "ledger" | "angel" | "commerce" | "bundle";
  name: string;
  price_mxn: number;
  billing_period: string;
  description: string;
  features_json: string;
  features?: string[];
  status: "active" | "waitlist" | "beta" | "maintenance";
  updated_at?: string;
};

export type LeadRecord = {
  id: string;
  email: string;
  despacho_nombre: string | null;
  tamano: "1-5" | "6-20" | "21-50" | "50+" | null;
  dolor_detectado: "sat_fiscal_calculo" | "cobranza_morosos" | "venta_online" | "integral_general" | "otro" | null;
  especialista_asignado: AgentId;
  estado: "nuevo" | "en_conversacion" | "calificado" | "propuesta_enviada" | "cerrado";
  score: number;
  conversation_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type PendingIngestRecord = {
  id: string;
  lead_id: string;
  destination: "ledger" | "angel" | "commerce" | "bundle";
  payload_json: string;
  status: "pending" | "delivered" | "failed";
  retries: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentSkill = {
  id: string;
  agent_id: string;
  skill_name: string;
  description: string;
  input_schema: string | null;
  execution_path: string;
  is_active: number;
  created_at: string;
};

export type LeadExecutiveContext = {
  lead_id: string;
  email: string;
  despacho_nombre: string | null;
  tamano: string | null;
  dolor_detectado: string | null;
  especialista_asignado: AgentId;
  estado: string;
  score: number;
  conversation_summary: string | null;
  conversations: {
    id: string;
    agente_id: string;
    role: string;
    content: string;
    timestamp: string;
  }[];
  executive_brief: string;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
};

export interface Env {
  DB: D1Database;
  AI: any; // Cloudflare Workers AI Binding
  SALES_INGEST_QUEUE: Queue<LeadIngestPayload>;
  SALES_AGENT: DurableObjectNamespace;
  ENVIRONMENT?: string;
  LEDGER_API_URL?: string;
  ANGEL_API_URL?: string;
  COMMERCE_API_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  AI_MODEL?: string;
}
