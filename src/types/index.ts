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
  account_id: string | null;
  contact_id: string | null;
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

export type AccountRecord = {
  id: string;
  name: string;
  normalized_name: string | null;
  size: "1-5" | "6-20" | "21-50" | "50+" | null;
  city: string | null;
  origin: string | null;
  duplicate_review_status: "pending" | "reviewed" | "merged";
  merged_into_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRecord = {
  id: string;
  account_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  consent_status: string | null;
  contact_preferences: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityStage =
  | "nuevo" | "contactado" | "calificado" | "demo_agendada"
  | "propuesta_enviada" | "negociacion" | "ganado" | "perdido";

export type OpportunityRecord = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  stage: OpportunityStage;
  owner_user_id: string | null;
  products_interest: string[];
  estimated_value: number | null;
  currency: string;
  expected_close_date: string | null;
  loss_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityType = "note" | "call" | "email" | "demo" | "stage_change" | "task" | "system";

export type ActivityRecord = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  lead_id: string | null;
  type: ActivityType;
  author_user_id: string | null;
  content: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
};

export type TaskStatus = "pending" | "in_progress" | "done" | "cancelled";

export type TaskRecord = {
  id: string;
  account_id: string | null;
  contact_id: string | null;
  opportunity_id: string | null;
  lead_id: string | null;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  due_date: string | null;
  status: TaskStatus;
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
  CRM_JWT_SECRET?: string;
}
