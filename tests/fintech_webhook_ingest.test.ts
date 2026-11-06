import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { webhookRouter } from "../src/routes/webhooks";

describe("harvester webhook ingestion", () => {
  it("persists Ark Ledger tenancy and a candidate segment while routing to Angel", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...params: unknown[]) => {
          statements.push({ sql, params });
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
          };
        }),
      })),
      batch: vi.fn().mockResolvedValue([{ success: true }]),
    };
    const app = new Hono();
    app.route("/webhooks/ingest", webhookRouter);

    const response = await app.fetch(
      new Request("http://localhost/webhooks/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: "lead_fintech_test",
          email: "contacto@credito.example.test",
          destination: "angel",
          vertical: "cobranza",
          tenant_id: "acc_ark_ledger",
          harvest_profile: "fintech_credit_app",
          harvest_source: "denue",
          sitio_web: "https://credito.example.test",
          account_context: {
            despacho_nombre: "Crédito Digital Ejemplo",
            tamano: "6-20",
            productos_interes: ["angel", "ledger"],
            dolor_principal: "cobranza_credito_digital",
            actividad: "Institución de crédito",
          },
        }),
      }),
      { DB: db, ENVIRONMENT: "test" } as any,
    );

    expect(response.status).toBe(201);
    const accountUpdate = statements.find(({ sql }) => sql.includes("UPDATE sales_accounts"));
    expect(accountUpdate?.sql).toContain("tenant_id = COALESCE(?, tenant_id)");
    expect(accountUpdate?.params).toContain("acc_ark_ledger");

    const segmentObservation = statements.find(({ sql }) =>
      sql.includes("CANDIDATO_FINTECH_CREDITO_APP"),
    );
    expect(segmentObservation?.params).toContain("https://credito.example.test");
    expect(segmentObservation?.params).toContain("denue");
  });

  it("persists the official SIPRES evidence for an active SOFOM candidate", async () => {
    const statements: Array<{ sql: string; params: unknown[] }> = [];
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...params: unknown[]) => {
          statements.push({ sql, params });
          return {
            run: vi.fn().mockResolvedValue({ success: true }),
            first: vi.fn().mockResolvedValue(null),
          };
        }),
      })),
      batch: vi.fn().mockResolvedValue([{ success: true }]),
    };
    const app = new Hono();
    app.route("/webhooks/ingest", webhookRouter);

    const response = await app.fetch(
      new Request("http://localhost/webhooks/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: "lead_sipres_14981",
          email: "contacto@bancrea.example",
          destination: "angel",
          vertical: "cobranza",
          tenant_id: "acc_ark_ledger",
          harvest_profile: "sipres_sofom",
          harvest_source: "sipres",
          account_context: {
            despacho_nombre: "SOFOM de prueba",
            tamano: "50+",
            productos_interes: ["angel", "ledger"],
            dolor_principal: "cobranza_sofom",
            sipres_id: "14981",
            sipres_status: "En operación",
            sipres_sector: "SOFOM E.R.",
            sipres_registry_url: "https://webapps.condusef.gob.mx/SIPRES/jsp/home_publico.jsp?idins=14981",
            rfc: "ABC123456XYZ",
          },
        }),
      }),
      { DB: db, ENVIRONMENT: "test" } as any,
    );

    expect(response.status).toBe(201);
    const observation = statements.find(({ sql }) => sql.includes("CANDIDATO_SIPRES_SOFOM"));
    expect(observation?.params).toContain(
      "https://webapps.condusef.gob.mx/SIPRES/jsp/home_publico.jsp?idins=14981",
    );
    expect(observation?.params).toContain("sipres");
    expect(observation?.params).toContain(
      JSON.stringify({
        sipres_id: "14981",
        status: "En operación",
        sector: "SOFOM E.R.",
        rfc: "ABC123456XYZ",
      }),
    );
  });
});
