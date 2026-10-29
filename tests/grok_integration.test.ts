import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { internalRouter } from "../src/routes/internal";
import { ToolExecutor } from "../src/tools";
import { Env, AgentSkill } from "../src/types";

describe("Sprint 2: Capa de Integración con Grok Bot", () => {
  const mockSkills: AgentSkill[] = [
    {
      id: "skill_1",
      agent_id: "ark-sales",
      skill_name: "research_prospect_web",
      description: "Busca en LinkedIn y web del despacho",
      input_schema: JSON.stringify({
        type: "object",
        properties: { despacho_nombre: { type: "string" } },
        required: ["despacho_nombre"],
      }),
      execution_path: "/api/internal/actions/grok/research-web",
      is_active: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: "skill_2",
      agent_id: "ark-sales",
      skill_name: "generate_custom_pdf",
      description: "Genera PDF en Ark Ledger",
      input_schema: JSON.stringify({
        type: "object",
        properties: { lead_id: { type: "string" }, despacho_nombre: { type: "string" } },
        required: ["lead_id", "despacho_nombre"],
      }),
      execution_path: "/api/internal/actions/grok/generate-ledger-pdf",
      is_active: 1,
      created_at: new Date().toISOString(),
    },
    {
      id: "skill_3",
      agent_id: "ark-sales",
      skill_name: "tag_prospect_on_x",
      description: "Responde queja del SAT en X",
      input_schema: JSON.stringify({
        type: "object",
        properties: { username: { type: "string" }, queja_sat: { type: "string" } },
        required: ["username", "queja_sat"],
      }),
      execution_path: "/api/internal/actions/grok/publish-x-thread",
      is_active: 1,
      created_at: new Date().toISOString(),
    },
  ];

  const createMockEnv = (): Env => ({
    DB: {
      prepare: vi.fn().mockImplementation((query: string) => {
        if (query.includes("FROM sales_leads WHERE id = ?")) {
          return {
            bind: vi.fn().mockImplementation((boundId: string) => {
              return {
                first: vi.fn().mockImplementation(() => {
                  if (boundId === "lead_existente_123") {
                    return Promise.resolve({
                      id: "lead_existente_123",
                      email: "titular@despachomaya.com",
                      despacho_nombre: "Despacho Maya & Asociados",
                      tamano: "6-20",
                      dolor_detectado: "sat_fiscal_calculo",
                      especialista_asignado: "riesgo",
                      estado: "calificado",
                      score: 85,
                      conversation_summary: "Despacho de 12 contadores con multas recurrentes del SAT.",
                    });
                  }
                  return Promise.resolve(null);
                }),
              };
            }),
          };
        }

        if (query.includes("FROM sales_conversations")) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: "conv_1",
                    agente_id: "intake",
                    role: "user",
                    content: "Nos cayó una auditoría del SAT por error en pólizas.",
                    timestamp: "2026-10-20 18:00:00",
                  },
                  {
                    id: "conv_2",
                    agente_id: "riesgo",
                    role: "assistant",
                    content: "Ark Ledger cuenta con sellado SHA-256 inmutable.",
                    timestamp: "2026-10-20 18:01:00",
                  },
                ],
              }),
            }),
          };
        }

        if (/FROM agent_skills/i.test(query) && /skill_name\s*=\s*\?/i.test(query)) {
          return {
            bind: vi.fn().mockImplementation((skillName: string) => {
              const found = mockSkills.find((s) => s.skill_name === skillName);
              return {
                first: vi.fn().mockResolvedValue(found || null),
              };
            }),
          };
        }

        if (/FROM agent_skills/i.test(query) && /is_active\s*=\s*1/i.test(query)) {
          return {
            all: vi.fn().mockResolvedValue({ results: mockSkills }),
          };
        }

        if (/FROM sales_leads/i.test(query) && /\[pending_twitter_tag\]/i.test(query)) {
          return {
            first: vi.fn().mockImplementation(() => {
              if ((global as any).__mockTwitterLead) {
                return Promise.resolve({
                  id: "lead_twitter_01",
                  email: "contador_x@x.com",
                  conversation_summary: "[pending_twitter_tag] El SAT se cayó de nuevo en plena nómina",
                });
              }
              return Promise.resolve(null);
            }),
          };
        }

        if (/FROM sales_leads/i.test(query) && /despacho_nombre IS NOT NULL/i.test(query)) {
          return {
            first: vi.fn().mockResolvedValue({
              id: "lead_existente_123",
              despacho_nombre: "Despacho Maya & Asociados",
            }),
          };
        }

        return {
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        };
      }),
    } as any,
    AI: null,
    SALES_INGEST_QUEUE: {} as any,
    SALES_AGENT: {} as any,
  });

  const app = new Hono<{ Bindings: Env }>();
  app.route("/api/internal", internalRouter);

  describe("Endpoint /api/internal/context (Ingesta de Contexto para Grok Bot)", () => {
    it("debe retornar 400 si falta el parámetro lead_id", async () => {
      const res = await app.request("/api/internal/context", {}, createMockEnv());
      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain("lead_id");
    });

    it("debe retornar 404 si el lead no existe en sales_leads", async () => {
      const res = await app.request("/api/internal/context?lead_id=inexistente", {}, createMockEnv());
      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toContain("no encontrado");
    });

    it("debe retornar el Resumen Ejecutivo completo e historial para Grok Bot", async () => {
      const res = await app.request("/api/internal/context?lead_id=lead_existente_123", {}, createMockEnv());
      expect(res.status).toBe(200);
      const data: any = await res.json();

      expect(data.lead_id).toBe("lead_existente_123");
      expect(data.email).toBe("titular@despachomaya.com");
      expect(data.despacho_nombre).toBe("Despacho Maya & Asociados");
      expect(data.especialista_asignado).toBe("riesgo");
      expect(data.score).toBe(85);
      expect(data.conversations.length).toBe(2);
      expect(data.executive_brief).toContain("RESUMEN EJECUTIVO PARA GROK BOT");
      expect(data.executive_brief).toContain("Bundle ARK Total ($997 MXN/mes)");
    });
  });

  describe("Endpoint /api/internal/skills/execute (Disparador de Habilidades Autónomas)", () => {
    it("debe retornar instrucción lista para ejecución cuando los parámetros son válidos", async () => {
      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill_name: "research_prospect_web",
            payload: {
              despacho_nombre: "Despacho Maya & Asociados",
              ciudad: "Mérida, Yucatán",
            },
          }),
        },
        createMockEnv()
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe("ready_for_grok_execution");
      expect(data.skill_name).toBe("research_prospect_web");
      expect(data.execution_path).toBe("/api/internal/actions/grok/research-web");
      expect(data.grok_instruction.role).toBe("grok_computer_operator");
    });

    it("debe validar input_schema y rechazar si faltan campos obligatorios", async () => {
      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill_name: "generate_custom_pdf",
            payload: {
              lead_id: "lead_123",
              // falta 'despacho_nombre' requerido
            },
          }),
        },
        createMockEnv()
      );

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain("Faltan campos requeridos: despacho_nombre");
    });

    it("debe retornar 404 si la skill no está registrada en agent_skills", async () => {
      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill_name: "skill_fantasma",
            payload: {},
          }),
        },
        createMockEnv()
      );

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toContain("no encontrada");
    });
  });

  describe("Tool disparar_habilidad_grok() para orquestador LLM", () => {
    it("debe estructurar el payload y validar la existencia de la skill en D1", async () => {
      const executor = new ToolExecutor(createMockEnv());
      const result = await executor.dispararHabilidadGrok(
        "tag_prospect_on_x",
        { username: "contador_sat_mx", queja_sat: "El portal del SAT volvió a caerse" },
        { lead_id: "lead_x_01", leadEmail: "contador@sat.com", despachoNombre: "Despacho X" }
      );

      expect(result.status).toBe("ready_for_grok_execution");
      expect(result.skill_name).toBe("tag_prospect_on_x");
      expect(result.payload.username).toBe("contador_sat_mx");
      expect(result.payload.lead_id).toBe("lead_x_01");
    });
  });

  describe("Endpoints del Runner Autónomo (grok_bot_computer_runner.py)", () => {
    beforeEach(() => {
      (global as any).__mockTwitterLead = false;
    });

    it("GET /api/internal/skills/pending debe retornar el próximo job disponible para research_prospect_web", async () => {
      const res = await app.request("/api/internal/skills/pending", {}, createMockEnv());
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.job).toBeDefined();
      expect(data.job.lead_id).toBe("lead_existente_123");
      expect(data.job.despacho_nombre).toBe("Despacho Maya & Asociados");
      expect(data.job.skill_name).toBe("research_prospect_web");
    });

    it("GET /api/internal/skills/pending debe retornar job para tag_prospect_on_x si hay lead con [pending_twitter_tag]", async () => {
      (global as any).__mockTwitterLead = true;
      const res = await app.request("/api/internal/skills/pending", {}, createMockEnv());
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.job).toBeDefined();
      expect(data.job.lead_id).toBe("lead_twitter_01");
      expect(data.job.skill_name).toBe("tag_prospect_on_x");
      expect(data.job.username).toBe("contador_x");
      expect(data.job.queja_sat).toBe("El SAT se cayó de nuevo en plena nómina");
    });

    it("POST /api/internal/leads/:lead_id/enrich debe guardar la inteligencia extraída por Grok Bot", async () => {
      const res = await app.request(
        "/api/internal/leads/lead_existente_123/enrich",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "success",
            enrichment: {
              estimated_size: "6-20",
              detected_tech: ["contpaqi", "sat"],
              research_summary: "Despacho con 14 colaboradores y Contpaqi en servidor local.",
              source: "grok_bot_autonomous_research",
              confidence_score: 0.85,
            },
          }),
        },
        createMockEnv()
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.lead_id).toBe("lead_existente_123");
      expect(data.tamano_asignado).toBe("6-20");
      expect(data.score_actualizado).toBeGreaterThan(85);
    });
  });
});
