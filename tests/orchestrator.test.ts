import { describe, it, expect, vi } from "vitest";
import { AgentOrchestrator } from "../src/agents/orchestrator";
import { Env } from "../src/types";

describe("AgentOrchestrator & Enrutamiento Agéntico por Dolor", () => {
  const createMockEnv = (): Env => ({
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({
          results: [
            {
              id: "cfg_ledger",
              product_key: "ledger",
              name: "Ark Ledger",
              price_mxn: 399,
              billing_period: "mensual",
              description: "Fiscal",
              features_json: '["Calculadoras SAT", "Sello SHA-256"]',
              status: "active",
            },
            {
              id: "cfg_bundle",
              product_key: "bundle",
              name: "Bundle Total",
              price_mxn: 997,
              billing_period: "mensual",
              description: "Bundle",
              features_json: '["Ledger", "Angel", "Commerce"]',
              status: "active",
            },
          ],
        }),
        first: vi.fn().mockResolvedValue({
          id: "lead_123",
          email: "contador@despacho.mx",
          despacho_nombre: "Despacho Alfa",
          tamano: "1-5",
          dolor_detectado: "sat_fiscal_calculo",
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    } as any,
    AI: null, // Motor determinista para test unitario
    SALES_INGEST_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
    } as any,
    SALES_AGENT: {} as any,
  });

  it("El Triador (Intake) debe transferir a Especialista en Riesgo ante dolor del SAT", async () => {
    const orchestrator = new AgentOrchestrator(createMockEnv());

    const result = await orchestrator.processMessage({
      lead_id: "lead_sat_test",
      currentAgent: "intake",
      history: [],
      userMessage: "El SAT nos está auditando constantemente y los cálculos de las pólizas fallan.",
      leadContext: {
        email: "contador@despacho.mx",
        despacho_nombre: "Despacho Alfa",
      },
    });

    expect(result.transferred_to).toBe("riesgo");
    expect(result.agente_id).toBe("riesgo");
    expect(result.response).toContain("Especialista en Riesgo");
  });

  it("El Triador (Intake) debe transferir a Especialista en Flujo ante problema de morosidad", async () => {
    const orchestrator = new AgentOrchestrator(createMockEnv());

    const result = await orchestrator.processMessage({
      lead_id: "lead_flujo_test",
      currentAgent: "intake",
      history: [],
      userMessage: "Nuestros clientes tienen meses sin pagar y la cobranza manual nos quita todo el tiempo.",
      leadContext: {
        email: "flujo@despacho.mx",
        despacho_nombre: "Despacho Beta",
      },
    });

    expect(result.transferred_to).toBe("flujo");
    expect(result.agente_id).toBe("flujo");
    expect(result.response).toContain("Especialista en Flujo");
  });

  it("El Triador (Intake) debe transferir al Closer si el despacho reporta caos total", async () => {
    const orchestrator = new AgentOrchestrator(createMockEnv());

    const result = await orchestrator.processMessage({
      lead_id: "lead_caos_test",
      currentAgent: "intake",
      history: [],
      userMessage: "Todo está en caos total en el despacho, no tenemos control ni fiscal ni de cobros.",
      leadContext: {
        email: "caos@despacho.mx",
        despacho_nombre: "Despacho Caos",
      },
    });

    expect(result.transferred_to).toBe("closer");
    expect(result.agente_id).toBe("closer");
    expect(result.response).toContain("Arquitecto del Bundle");
  });
});
