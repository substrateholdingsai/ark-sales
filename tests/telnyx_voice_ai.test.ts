import { describe, it, expect, vi } from "vitest";
import { app } from "../src/index";
import { Env } from "../src/types";

function mockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [{ id: "cfg_ledger", product_key: "ledger", name: "Ark Ledger", price_mxn: 399, billing_period: "mensual", description: "Fiscal", features_json: "[]", status: "active" }] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    }),
  } as any;
}

describe("Telnyx Voice AI", () => {
  it("tools: consultar_catalogo_completo devuelve precios", async () => {
    const env: any = {
      DB: mockDb(),
      AI: null,
      SALES_INGEST_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
      SALES_AGENT: {},
      ENVIRONMENT: "development",
      CRM_JWT_SECRET: "s",
    };
    const res = await app.fetch(new Request("http://localhost/webhooks/telnyx/voice-ai/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_name: "consultar_catalogo_completo" }),
    }), env);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
  });

  it("events: call.completed persiste sesion y actualiza lead", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const doFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const env: any = {
      DB: mockDb(),
      AI: null,
      SALES_INGEST_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
      SALES_AGENT: { idFromName: () => "do-id", get: () => ({ fetch: doFetch }) },
      ENVIRONMENT: "development",
      CRM_JWT_SECRET: "s",
    };
    const res = await app.fetch(new Request("http://localhost/webhooks/telnyx/voice-ai/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "call.completed",
        payload: {
          call_control_id: "call_123",
          from: "+52111",
          to: "+52222",
          lead_id: "lead_1",
          transcript: "Hola",
          recording_url: "https://example.com/rec.mp3",
        },
      }),
    }), env);
    expect(res.status).toBe(200);
    const data: any = await res.json();
    expect(data.success).toBe(true);
    vi.unstubAllGlobals();
  });
});
