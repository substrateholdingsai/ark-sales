import { describe, it, expect, vi } from "vitest";
import {
  normalizarTelefonoE164,
  generarGuionCortesia,
  dispararLlamadaCortesia,
  procesarEventoTelnyx,
} from "../src/voice/telnyx";
import { Env } from "../src/types";
import worker from "../src/index";

describe("Módulo de Voz Telnyx (Llamadas de Cortesía)", () => {
  describe("normalizarTelefonoE164()", () => {
    it("debe normalizar números mexicanos de 10 dígitos anteponiendo +52", () => {
      const res = normalizarTelefonoE164("5512345678");
      expect(res.valid).toBe(true);
      expect(res.e164).toBe("+525512345678");
    });

    it("debe limpiar espacios, paréntesis y guiones", () => {
      const res = normalizarTelefonoE164("(55) 1234-5678");
      expect(res.valid).toBe(true);
      expect(res.e164).toBe("+525512345678");
    });

    it("debe respetar números que ya tienen prefijo internacional +", () => {
      const res = normalizarTelefonoE164("+525512345678");
      expect(res.valid).toBe(true);
      expect(res.e164).toBe("+525512345678");
    });

    it("debe anteponer + si tiene 12 dígitos iniciando con 52", () => {
      const res = normalizarTelefonoE164("525512345678");
      expect(res.valid).toBe(true);
      expect(res.e164).toBe("+525512345678");
    });

    it("debe rechazar números con menos de 10 dígitos o inválidos", () => {
      expect(normalizarTelefonoE164("12345").valid).toBe(false);
      expect(normalizarTelefonoE164("").valid).toBe(false);
      expect(normalizarTelefonoE164("telefono").valid).toBe(false);
    });
  });

  describe("generarGuionCortesia()", () => {
    it("debe generar guion adaptado para sector inmobiliario", () => {
      const guion = generarGuionCortesia("Inmobiliaria Norte", "inmobiliaria");
      expect(guion).toContain("Inmobiliaria Norte");
      expect(guion).toContain("rentas y cuotas inmobiliarias");
      expect(guion).toContain("Ark Angel");
    });

    it("debe generar guion adaptado para sector automotriz", () => {
      const guion = generarGuionCortesia("Financiera AutoPlus", "automotriz");
      expect(guion).toContain("Financiera AutoPlus");
      expect(guion).toContain("recargos fiscales");
      expect(guion).toContain("Ark Ledger");
    });

    it("debe generar guion adaptado para sector cobranza / BPO", () => {
      const guion = generarGuionCortesia("Recuperadora Alfa", "bpo");
      expect(guion).toContain("Recuperadora Alfa");
      expect(guion).toContain("CONDUSEF");
      expect(guion).toContain("Paquete Enterprise");
    });

    it("debe generar guion institucional por defecto para despachos generales", () => {
      const guion = generarGuionCortesia("Despacho Ramos");
      expect(guion).toContain("Despacho Ramos");
      expect(guion).toContain("cotización oficial de Ark Angel y Ark Ledger");
    });
  });

  describe("dispararLlamadaCortesia()", () => {
    it("debe operar en modo simulado seguro si TELNYX_API_KEY no está configurada", async () => {
      const mockEnv: Env = {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any,
        AI: null,
        SALES_INGEST_QUEUE: {} as any,
        SALES_AGENT: {} as any,
      };

      const res = await dispararLlamadaCortesia(mockEnv, {
        to: "5512345678",
        despachoNombre: "Despacho Simulado",
        leadId: "lead_test_123",
      });

      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(res.phone_e164).toBe("+525512345678");
      expect(res.message).toContain("Llamada de cortesía simulada");
    });

    it("debe llamar a la API de Telnyx v2 cuando TELNYX_API_KEY está presente", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              call_control_id: "v3:mock_call_control_id_123",
              call_leg_id: "leg_123",
            },
          }),
          { status: 200 }
        )
      );
      vi.stubGlobal("fetch", mockFetch);

      const mockEnv: Env = {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any,
        AI: null,
        SALES_INGEST_QUEUE: {} as any,
        SALES_AGENT: {} as any,
        TELNYX_API_KEY: "KEY01_mock_telnyx_token",
        TELNYX_PHONE_NUMBER: "+525588889999",
      };

      const res = await dispararLlamadaCortesia(mockEnv, {
        to: "5599887766",
        despachoNombre: "Corporativo Real",
        leadId: "lead_live_456",
        industry: "cobranza",
      });

      expect(res.success).toBe(true);
      expect(res.simulated).toBe(false);
      expect(res.call_control_id).toBe("v3:mock_call_control_id_123");
      expect(res.phone_e164).toBe("+525599887766");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telnyx.com/v2/calls",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer KEY01_mock_telnyx_token",
          }),
        })
      );

      vi.unstubAllGlobals();
    });
  });

  describe("procesarEventoTelnyx() y Webhooks", () => {
    it("debe enviar comando speak cuando el evento es call.answered", async () => {
      const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const mockEnv: Env = {
        DB: {
          prepare: vi.fn().mockReturnValue({
            bind: vi.fn().mockReturnThis(),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        } as any,
        AI: null,
        SALES_INGEST_QUEUE: {} as any,
        SALES_AGENT: {} as any,
        TELNYX_API_KEY: "KEY01_mock_telnyx_token",
      };

      const clientState = btoa(JSON.stringify({ despachoNombre: "Despacho Webhook", leadId: "lead_789" }));

      const event = {
        data: {
          event_type: "call.answered",
          payload: {
            call_control_id: "v3:call_answered_123",
            client_state: clientState,
          },
        },
      };

      const res = await procesarEventoTelnyx(mockEnv, event);

      expect(res.handled).toBe(true);
      expect(res.action).toBe("speak_initiated");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telnyx.com/v2/calls/v3:call_answered_123/actions/speak",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer KEY01_mock_telnyx_token",
          }),
          body: expect.stringContaining("es-MX"),
        })
      );

      vi.unstubAllGlobals();
    });

    it("debe responder exitosamente en el endpoint HTTP POST /webhooks/telnyx", async () => {
      const mockEnv: Env = {
        DB: {} as any,
        AI: null,
        SALES_INGEST_QUEUE: {} as any,
        SALES_AGENT: {} as any,
      };

      const req = new Request("http://localhost/webhooks/telnyx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            event_type: "call.hangup",
            payload: {
              call_control_id: "v3:call_hangup_123",
            },
          },
        }),
      });

      const res = await worker.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("call_completed");
    });
  });
});
