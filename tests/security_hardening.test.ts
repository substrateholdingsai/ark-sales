import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";
import { getJwtSecret } from "../src/auth/middleware";
import { resetAuthRateLimitsForTests } from "../src/routes/auth";
import { isSafeSelectQuery } from "../src/routes/superadmin";
import { ToolExecutor, resetToolQuotasForTests } from "../src/tools";

const TEST_SECRET = "prod-grade-jwt-secret-key-999";

describe("Security Hardening & Anti-Abuse Suite", () => {
  beforeEach(() => {
    resetAuthRateLimitsForTests();
    resetToolQuotasForTests();
  });

  it("getJwtSecret debe fallar cerrado (retornar null) en producción si CRM_JWT_SECRET no está definido", () => {
    const prodEnvNoSecret: any = { ENVIRONMENT: "production" };
    expect(getJwtSecret(prodEnvNoSecret)).toBeNull();

    const prodEnvWithSecret: any = { ENVIRONMENT: "production", CRM_JWT_SECRET: TEST_SECRET };
    expect(getJwtSecret(prodEnvWithSecret)).toBe(TEST_SECRET);
  });

  it("GET /superadmin debe bloquear con 403 a usuarios autenticados con rol 'vendedor'", async () => {
    const sellerToken = await signJwt(
      { sub: "usr_vend", email: "vendedor@arksystems.site", role: "vendedor" },
      TEST_SECRET
    );
    const env: any = {
      ENVIRONMENT: "production",
      CRM_JWT_SECRET: TEST_SECRET,
    };

    const res = await app.fetch(
      new Request("http://localhost/superadmin", {
        headers: { Authorization: `Bearer ${sellerToken}` },
      }),
      env
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/auth/login debe bloquear por fuerza bruta (429) tras 5 intentos fallidos desde la misma IP/correo", async () => {
    const mockDb: any = {
      prepare() {
        return {
          bind() {
            return {
              async first() { return null; },
              async run() { return { success: true }; },
            };
          },
        };
      },
    };
    const env: any = {
      DB: mockDb,
      ENVIRONMENT: "production",
      CRM_JWT_SECRET: TEST_SECRET,
    };

    for (let i = 0; i < 5; i++) {
      const r = await app.fetch(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
          body: JSON.stringify({ email: "admin@arksystems.site", password: "wrong-password" }),
        }),
        env
      );
      expect(r.status).toBe(401);
    }

    // El 6to intento debe devolver 429 Too Many Requests
    const blocked = await app.fetch(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.10" },
        body: JSON.stringify({ email: "admin@arksystems.site", password: "wrong-password" }),
      }),
      env
    );
    expect(blocked.status).toBe(429);
  });

  it("POST /webhooks/telnyx/call debe rechazar solicitudes sin autenticación (401 Anti-Toll-Fraud)", async () => {
    const env: any = {
      ENVIRONMENT: "production",
      CRM_JWT_SECRET: TEST_SECRET,
      INTERNAL_API_TOKEN: "sec_internal_123",
    };

    const unauth = await app.fetch(
      new Request("http://localhost/webhooks/telnyx/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: "+525512345678" }),
      }),
      env
    );
    expect(unauth.status).toBe(401);

    const authInternal = await app.fetch(
      new Request("http://localhost/webhooks/telnyx/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ark-Internal-Key": "sec_internal_123",
        },
        body: JSON.stringify({ to: "+525512345678" }),
      }),
      env
    );
    expect(authInternal.status).toBe(200);
  });

  it("POST /webhooks/ingest debe exigir secreto en producción (fail-closed)", async () => {
    const env: any = {
      ENVIRONMENT: "production",
      INTERNAL_API_TOKEN: "token_prod_xyz",
    };

    const res = await app.fetch(
      new Request("http://localhost/webhooks/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@empresa.com" }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("POST /webhooks/conekta debe rechazar webhooks sin firma válida cuando CONEKTA_WEBHOOK_SECRET está activo", async () => {
    const env: any = {
      ENVIRONMENT: "production",
      CONEKTA_WEBHOOK_SECRET: "whsec_conekta_real_999",
    };

    const res = await app.fetch(
      new Request("http://localhost/webhooks/conekta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order.paid",
          data: { object: { id: "ord_123", payment_status: "paid" } },
        }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it("isSafeSelectQuery debe permitir SELECT limpio y bloquear sentencias destructivas o múltiples", () => {
    expect(isSafeSelectQuery("SELECT DISTINCT a.* FROM sales_accounts a WHERE a.scian_code = '541210'")).toBe(true);
    expect(isSafeSelectQuery("DROP TABLE sales_accounts")).toBe(false);
    expect(isSafeSelectQuery("SELECT * FROM sales_accounts; DELETE FROM crm_users")).toBe(false);
    expect(isSafeSelectQuery("SELECT * FROM sales_accounts UNION SELECT * FROM pragma_table_info('crm_users'); UPDATE crm_users SET role='admin'")).toBe(false);
  });

  it("ToolExecutor debe limitar llamadas de cortesía por lead para evitar abuso desde el chat público", async () => {
    const env: any = {
      DB: null,
      TELNYX_API_KEY: "",
    };
    const executor = new ToolExecutor(env);
    const r1 = await executor.dispararLlamadaCortesia("5512345678", "Despacho 1", "fiscal", { lead_id: "lead_quota_1" });
    expect(r1.success).toBe(true);

    const r2 = await executor.dispararLlamadaCortesia("5512345678", "Despacho 1", "fiscal", { lead_id: "lead_quota_1" });
    expect(r2.success).toBe(true);

    const r3 = await executor.dispararLlamadaCortesia("5512345678", "Despacho 1", "fiscal", { lead_id: "lead_quota_1" });
    expect(r3.success).toBe(false);
    expect((r3 as any).error).toBe("CALL_QUOTA_EXCEEDED");
  });
});
