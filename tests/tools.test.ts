import { describe, it, expect, vi } from "vitest";
import { ToolExecutor } from "../src/tools";
import { Env, LeadIngestPayload } from "../src/types";

describe("Herramientas de IA y Enrutamiento por Dolor", () => {
  const createMockEnv = (overrides?: Partial<Env>): Env => ({
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
              features_json: "[]",
              status: "active",
            },
            {
              id: "cfg_bundle",
              product_key: "bundle",
              name: "Bundle Total",
              price_mxn: 997,
              billing_period: "mensual",
              description: "Bundle",
              features_json: "[]",
              status: "active",
            },
          ],
        }),
        first: vi.fn().mockResolvedValue({
          id: "lead-123",
          email: "socio@despacho.com",
          despacho_nombre: "García & Asociados",
          tamano: "6-20",
          dolor_detectado: "sat_fiscal_calculo",
        }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    } as any,
    AI: null,
    SALES_INGEST_QUEUE: {
      send: vi.fn().mockResolvedValue(undefined),
    } as any,
    SALES_AGENT: {} as any,
    RESEND_API_KEY: "re_mock_test_key",
    ...overrides,
  });

  describe("diagnosticar_despacho()", () => {
    it("debe derivar a Especialista en Riesgo si el dolor es del SAT o cálculos fiscales", () => {
      const executor = new ToolExecutor(createMockEnv());
      const res = executor.diagnosticarDespacho("Tenemos auditorías frecuentes del SAT y errores en cálculos de impuestos");

      expect(res.status).toBe("success");
      expect(res.especialista_asignado).toBe("riesgo");
      expect(res.vertical_recomendada).toBe("fiscal");
      expect(res.productos_recomendados).toContain("ledger");
      expect(res.productos_recomendados).toContain("angel");
    });

    it("debe derivar a Especialista en Flujo si el dolor es cobranza o clientes morosos", () => {
      const executor = new ToolExecutor(createMockEnv());
      const res = executor.diagnosticarDespacho("Nuestros clientes no pagan a tiempo los honorarios, la cobranza morosa nos asfixia");

      expect(res.status).toBe("success");
      expect(res.especialista_asignado).toBe("flujo");
      expect(res.vertical_recomendada).toBe("cobranza");
      expect(res.productos_recomendados).toContain("angel");
      expect(res.productos_recomendados).toContain("commerce");
    });

    it("debe derivar a Especialista en Flujo si el dolor es vender online", () => {
      const executor = new ToolExecutor(createMockEnv());
      const res = executor.diagnosticarDespacho("Queremos vender nuestros servicios contables online con tienda digital y pasarela");

      expect(res.status).toBe("success");
      expect(res.especialista_asignado).toBe("flujo");
      expect(res.vertical_recomendada).toBe("ecommerce");
      expect(res.productos_recomendados).toContain("commerce");
    });

    it("debe derivar al Arquitecto del Bundle (Closer) si todo está mal o es integral", () => {
      const executor = new ToolExecutor(createMockEnv());
      const res = executor.diagnosticarDespacho("Todo está en caos total, tenemos problemas con SAT y además nadie nos paga, necesitamos un sistema integral");

      expect(res.status).toBe("success");
      expect(res.especialista_asignado).toBe("closer");
      expect(res.vertical_recomendada).toBe("bundle");
      expect(res.productos_recomendados).toContain("bundle");
    });
  });

  describe("entregar_lead() y Contrato Federado LEAD_INGEST_V3", () => {
    it("debe generar un payload estricto LEAD_INGEST_V3, guardar en outbox y encolar a la Queue", async () => {
      const mockEnv = createMockEnv();
      const executor = new ToolExecutor(mockEnv);

      const result = await executor.entregarLead(
        "bundle",
        92,
        "Despacho con 15 contadores que busca automatizar fiscal y cobranza integral.",
        {
          lead_id: "lead_test_001",
          leadEmail: "contacto@garcia.mx",
          despachoNombre: "García y Asoc",
          tamano: "6-20",
        }
      );

      expect(result.status).toBe("lead_queued");
      const contract: LeadIngestPayload = result.contract;

      // Verificación estricta del contrato LEAD_INGEST_V3
      expect(contract.version).toBe(3);
      expect(contract.lead_id).toBe("lead_test_001");
      expect(contract.source_worker).toBe("ark-sales");
      expect(contract.destination).toBe("bundle");
      expect(contract.vertical).toBe("bundle");
      expect(contract.score).toBe(92);
      expect(contract.conversation_summary).toContain("Despacho con 15 contadores");
      expect(contract.account_context.despacho_nombre).toBe("García y Asoc");
      expect(contract.account_context.tamano).toBe("6-20");

      // Verificación de encolamiento
      expect(mockEnv.SALES_INGEST_QUEUE.send).toHaveBeenCalledWith(contract);
    });
  });
});
