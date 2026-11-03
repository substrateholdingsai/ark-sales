import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { internalRouter } from "../src/routes/internal";
import { Env } from "../src/types";

describe("Endpoint POST /api/internal/leads/ingest · Altas SIEM CANACO & SalesAgent Trigger", () => {
  const createMockEnv = (overrides?: Partial<Env>): Env => {
    const executedQueries: string[] = [];
    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => {
        executedQueries.push(query);
        return {
          bind: vi.fn().mockImplementation((...params: any[]) => ({
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] }),
          })),
        };
      }),
      batch: vi.fn().mockResolvedValue([{ success: true }]),
    };

    const mockSalesAgentStub = {
      fetch: vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const body = JSON.parse((init?.body as string) || "{}");
        return new Response(
          JSON.stringify({
            lead_id: body.lead_id,
            agente_id: "intake",
            response: `¡Bienvenido a CANACO! Confirmamos que tu Landing Page en Ark Commerce ya está activa sin costo. Como beneficio exclusivo, cuentas con 20 calculadoras fiscales gratuitas en Ark Ledger con Noah AI. Si necesitas sellado SHA-256 ante el SAT, activa el Plan PRO Despacho ($399 MXN/mes).`,
            tools_called: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }),
    };

    const mockSalesAgentNamespace = {
      idFromName: vi.fn().mockReturnValue("do_id_12345"),
      get: vi.fn().mockReturnValue(mockSalesAgentStub),
    };

    return {
      DB: mockDb as any,
      AI: null,
      SALES_INGEST_QUEUE: { send: vi.fn() } as any,
      SALES_AGENT: mockSalesAgentNamespace as any,
      INTERNAL_SERVICE_KEY: "secret_ark_internal_key",
      ENVIRONMENT: "test",
      ...overrides,
    };
  };

  it("debe rechazar solicitudes sin Authorization o X-Ark-Internal-Key (401)", async () => {
    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/api/internal", internalRouter);

    const req = new Request("http://localhost/api/internal/leads/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "comercio@canaco.mx" }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain("Unauthorized");
  });

  it("debe rechazar payloads sin email válido (400)", async () => {
    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/api/internal", internalRouter);

    const req = new Request("http://localhost/api/internal/leads/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ark-Internal-Key": "secret_ark_internal_key",
      },
      body: JSON.stringify({ empresa: "Zapatería Maya" }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("email");
  });

  it("debe procesar el alta de SIEM desde landing CANACO y disparar automáticamente al SalesAgent DO", async () => {
    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/api/internal", internalRouter);

    const payload = {
      lead_id: "lead_siem_yucatan_789",
      email: "contacto@reposteriaelpanecito.com",
      empresa: "Repostería El Panecito",
      tamano: "6-20",
      siem_id: "SIEM-2026-YUC-9941",
      landing_url: "https://elpanecito.canacomerida.com.mx",
      phone: "+529999887766",
      origin: "canaco_landing_white_label",
    };

    const req = new Request("http://localhost/api/internal/leads/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ark-Internal-Key": "secret_ark_internal_key",
      },
      body: JSON.stringify(payload),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.lead_id).toBe("lead_siem_yucatan_789");
    expect(json.origin).toBe("canaco_landing_white_label");
    expect(json.sales_agent_triggered).toBe(true);
    expect(json.agent_welcome_message).toContain("¡Bienvenido a CANACO!");
    expect(json.agent_welcome_message).toContain("Ark Commerce");
    expect(json.agent_welcome_message).toContain("Ark Ledger");

    // Verificar que llamó al Durable Object con el lead_id adecuado
    expect(env.SALES_AGENT.idFromName).toHaveBeenCalledWith("lead_siem_yucatan_789");
  });

  it("debe procesar el formato federado LEAD_INGEST_V3 con account_context sin fricción", async () => {
    const env = createMockEnv();
    const app = new Hono<{ Bindings: Env }>();
    app.route("/api/internal", internalRouter);

    const federatedPayload = {
      version: 3,
      lead_id: "lead_fed_999",
      email: "director@despachofiscal.com",
      source_worker: "ark-commerce",
      destination: "ledger",
      vertical: "fiscal",
      score: 90,
      account_context: {
        despacho_nombre: "Despacho Fiscal Peninsular",
        tamano: "21-50",
        productos_interes: ["ledger_pro"],
        dolor_principal: "sat_fiscal_calculo",
      },
    };

    const req = new Request("http://localhost/api/internal/leads/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer secret_ark_internal_key",
      },
      body: JSON.stringify(federatedPayload),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.lead_id).toBe("lead_fed_999");
    expect(json.destination).toBe("ledger");
    expect(json.vertical).toBe("fiscal");
    expect(json.sales_agent_triggered).toBe(true);
  });
});
