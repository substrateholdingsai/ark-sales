import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { webhookRouter } from "../src/routes/webhooks";

describe("fintech DENUE ingestion", () => {
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
});
