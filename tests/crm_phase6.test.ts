import { describe, it, expect } from "vitest";
import { app } from "../src/index";

function mockEnv() {
  const db = {
    prepare: () => ({
      bind: () => ({ first: async () => null, all: async () => ({ results: [] }), run: async () => ({ success: true }) }),
      first: async () => null,
      all: async () => ({ results: [] }),
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
  } as any;
}

describe("CRM metrics & inbox", () => {
  it("blocks unauthenticated access to /api/crm/metrics", async () => {
    const env = mockEnv();
    const res = await app.fetch(new Request("http://localhost/api/crm/metrics"), env);
    expect(res.status).toBe(401);
  });

  it("blocks unauthenticated access to /api/crm/inbox", async () => {
    const env = mockEnv();
    const res = await app.fetch(new Request("http://localhost/api/crm/inbox"), env);
    expect(res.status).toBe(401);
  });
});