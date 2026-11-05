import { describe, it, expect, vi } from "vitest";
import { app } from "../src/index";

function mockEnv() {
  const sampleContacts = [
    {
      id: "ct_1",
      account_id: "acc_1",
      name: "Dr. Roberto Canché Pech",
      email: "roberto@clinicacampeche.mx",
      phone: "9818165500",
      whatsapp: "9818165500",
      title: "Cirugía General & Laparoscopía",
      notes: "Clínica privada Campeche Centro",
      created_at: "2026-11-04T19:15:00Z",
      account_name: "Centro Médico de Campeche",
      account_city: "San Francisco de Campeche",
      account_state: "Campeche",
      account_industry: "Salud",
      tenant_id: "acc_futura_capital",
      account_size: "1-5",
      score: 88,
      dolor_detectado: "inversion_consultorio_medico",
      conversation_summary: "Clínica especializada buscando consultorios en expansión.",
    },
    {
      id: "ct_2",
      account_id: "acc_2",
      name: "Dra. Carmen Salazar",
      email: "carmen@dentalcarmen.com",
      phone: "9383812345",
      whatsapp: "9383812345",
      title: "Implantología y Estética Dental",
      notes: "Ciudad del Carmen",
      created_at: "2026-11-04T19:16:00Z",
      account_name: "Dental Carmen Especialistas",
      account_city: "Ciudad del Carmen",
      account_state: "Campeche",
      account_industry: "Salud Dental",
      tenant_id: "acc_futura_capital",
      account_size: "6-20",
      score: 92,
      dolor_detectado: "turismo_medico_expansion",
      conversation_summary: "Alto ticket dental en Cd. del Carmen.",
    },
  ];

  const db = {
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({
        all: async () => ({ results: sampleContacts }),
        first: async () => ({
          total_contactos: 200,
          con_whatsapp: 180,
          con_email: 160,
        }),
        run: async () => ({ success: true }),
      }),
      all: async () => ({
        results: [
          { city: "San Francisco de Campeche", n: 120 },
          { city: "Ciudad del Carmen", n: 80 },
        ],
      }),
      first: async () => ({
        total_contactos: 200,
        con_whatsapp: 180,
        con_email: 160,
      }),
      run: async () => ({ success: true }),
    }),
  } as any;

  return {
    DB: db,
    AI: null,
    SALES_INGEST_QUEUE: { send: async () => {} },
    SALES_AGENT: {},
    ENVIRONMENT: "development",
    CRM_JWT_SECRET: "s",
    INTERNAL_API_TOKEN: "test_internal_token",
  } as any;
}

describe("Ark Sales Remote MCP Server Suite (Claude & HubSpot Connector)", () => {
  it("GET /mcp responde con catálogo de herramientas e instrucciones de configuración", async () => {
    const env = mockEnv();
    const res = await app.fetch(new Request("http://localhost/mcp"), env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.name).toContain("Ark Systems");
    expect(body.tools_disponibles).toContain("buscar_prospectos_cosechados");
    expect(body.tools_disponibles).toContain("exportar_prospectos_hubspot");
    expect(body.tools_disponibles).toContain("sincronizar_leads_a_hubspot");
    expect(body.endpoints.sse).toBe("https://sales.arksystems.site/mcp/sse");
  });

  it("POST /mcp procesa 'initialize' con protocolo MCP 2024-11-05", async () => {
    const env = mockEnv();
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "claude-hubspot-plugin", version: "1.0.0" } },
      }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(1);
    expect(body.result.serverInfo.name).toBe("ark-sales-mcp");
    expect(body.result.capabilities.tools).toBeDefined();
  });

  it("POST /mcp procesa 'tools/list' retornando esquemas de herramientas para Claude", async () => {
    const env = mockEnv();
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    const tools = body.result.tools;
    expect(tools.length).toBeGreaterThanOrEqual(4);
    const names = tools.map((t: any) => t.name);
    expect(names).toContain("buscar_prospectos_cosechados");
    expect(names).toContain("exportar_prospectos_hubspot");
  });

  it("POST /mcp tools/call: 'buscar_prospectos_cosechados' retorna prospectos médicos de Campeche con enlace directo de WhatsApp", async () => {
    const env = mockEnv();
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "buscar_prospectos_cosechados",
          arguments: { plaza: "campeche", con_whatsapp: true, limit: 10 },
        },
      }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.result.isError).toBe(false);
    const contentText = body.result.content[0].text;
    const parsedData = JSON.parse(contentText);
    expect(parsedData.prospectos.length).toBe(2);
    expect(parsedData.prospectos[0].nombre).toBe("Dr. Roberto Canché Pech");
    expect(parsedData.prospectos[0].whatsapp_link).toBe("https://wa.me/9818165500");
    expect(parsedData.prospectos[0].ciudad).toBe("San Francisco de Campeche");
  });

  it("POST /mcp tools/call: 'exportar_prospectos_hubspot' entrega el batch de contactos listo para la API de HubSpot", async () => {
    const env = mockEnv();
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "exportar_prospectos_hubspot",
          arguments: { plaza: "campeche" },
        },
      }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.formato).toContain("HubSpot CRM");
    expect(parsed.hubspot_batch_payload[0].properties.firstname).toBe("Dr.");
    expect(parsed.hubspot_batch_payload[0].properties.mobilephone).toBe("9818165500");
    expect(parsed.hubspot_batch_payload[0].properties.hs_lead_status).toBe("NEW");
  });

  it("POST /mcp tools/call: 'obtener_resumen_plazas' devuelve inventario de prospectos y métricas", async () => {
    const env = mockEnv();
    const req = new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "obtener_resumen_plazas",
        },
      }),
    });
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    const parsed = JSON.parse(body.result.content[0].text);
    expect(parsed.metricas_globales.total_contactos).toBe(200);
    expect(parsed.plazas_activas.some((p: any) => p.plaza === "campeche")).toBe(true);
  });

  it("GET /mcp/sse inicia canal SSE con evento 'endpoint'", async () => {
    const env = mockEnv();
    const res = await app.fetch(new Request("http://localhost/mcp/sse"), env);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = res.body?.getReader();
    const { value } = await reader!.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: endpoint");
    expect(text).toContain("/mcp/messages?sessionId=mcp_");
    await reader!.cancel();
  });
});
