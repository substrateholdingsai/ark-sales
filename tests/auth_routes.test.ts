import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { Env } from "../src/types";

function createMockDb() {
  const users: any[] = [];
  const audit: any[] = [];

  function makeResult(rows: any[]) {
    return { results: rows };
  }

  return {
    _users: users,
    _audit: audit,
    prepare(sql: string) {
      const s = sql.toLowerCase();
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (s.includes("from crm_users where email")) {
                const email = String(args[0]).toLowerCase();
                return users.find((u) => u.email === email) || null;
              }
              if (s.includes("from crm_users where id")) {
                return users.find((u) => u.id === args[0]) || null;
              }
              if (s.includes("count(*)") && s.includes("crm_users")) {
                return { n: users.length };
              }
              if (s.includes("from crm_users") && s.includes("order by")) {
                // list handled in all()
                return null;
              }
              return null;
            },
            async all() {
              if (s.includes("from crm_users")) {
                return makeResult(users.map((u) => ({ ...u })));
              }
              if (s.includes("from crm_audit_log")) {
                const limit = args[0] ?? 50;
                return makeResult(audit.slice(0, limit).map((a) => ({ ...a })));
              }
              return makeResult([]);
            },
            async run() {
              if (s.startsWith("insert into crm_users")) {
                // args: id, email, password_hash, name, role
                users.push({
                  id: args[0],
                  email: args[1],
                  password_hash: args[2],
                  name: args[3],
                  role: args[4],
                  is_active: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                return { success: true };
              }
              if (s.startsWith("insert into crm_audit_log")) {
                audit.push({
                  id: args[0],
                  actor_user_id: args[1],
                  actor_email: args[2],
                  action: args[3],
                  entity_type: args[4],
                  entity_id: args[5],
                  metadata_json: args[6],
                  ip: args[7],
                  created_at: new Date().toISOString(),
                });
                return { success: true };
              }
              return { success: true };
            },
          };
        },
        // support prepare().all() without bind for some queries? crm list uses bind? We used bind(limit). For users list no bind. Handle unbound.
        async first() {
          if (s.includes("count(*)") && s.includes("crm_users")) {
            return { n: users.length };
          }
          return null;
        },
        async all() {
          if (s.includes("from crm_users")) {
            return makeResult(users.map((u) => ({ ...u })));
          }
          if (s.includes("from crm_audit_log")) {
            return makeResult(audit.map((a) => ({ ...a })));
          }
          return makeResult([]);
        },
        async run() {
          return { success: true };
        },
      };
    },
  } as any;
}

function createEnv(db: any): Env {
  return {
    DB: db,
    AI: null as any,
    SALES_INGEST_QUEUE: { send: async () => {} } as any,
    SALES_AGENT: {} as any,
    ENVIRONMENT: "development",
    CRM_JWT_SECRET: "test-jwt-secret",
  } as any;
}

async function req(path: string, init?: RequestInit, env?: Env) {
  const e = env ?? createEnv(createMockDb());
  const url = `http://localhost${path}`;
  const request = new Request(url, init);
  return app.fetch(request, e as any);
}

describe("CRM Auth routes", () => {
  it("blocks unauthenticated access to /api/crm/ping", async () => {
    const db = createMockDb();
    const env = createEnv(db);
    const res = await app.fetch(new Request("http://localhost/api/crm/ping"), env as any);
    expect(res.status).toBe(401);
  });

  it("allows bootstrap registration then login", async () => {
    const db = createMockDb();
    const env = createEnv(db);

    // register first admin
    const regRes = await app.fetch(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@test.com", password: "secret123" }),
      }),
      env as any
    );
    expect(regRes.status).toBe(201);

    // login
    const loginRes = await app.fetch(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@test.com", password: "secret123" }),
      }),
      env as any
    );
    expect(loginRes.status).toBe(200);
    const loginData: any = await loginRes.json();
    expect(loginData.token).toBeTruthy();

    // access ping with token
    const pingRes = await app.fetch(
      new Request("http://localhost/api/crm/ping", {
        headers: { Authorization: `Bearer ${loginData.token}` },
      }),
      env as any
    );
    expect(pingRes.status).toBe(200);

    // vendedor cannot access admin endpoint
    // create a vendedor via admin endpoint
    const createUserRes = await app.fetch(
      new Request("http://localhost/api/crm/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${loginData.token}` },
        body: JSON.stringify({ email: "vend@test.com", password: "secret123", role: "vendedor" }),
      }),
      env as any
    );
    expect(createUserRes.status).toBe(201);

    // login as vendedor
    const loginV = await app.fetch(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "vend@test.com", password: "secret123" }),
      }),
      env as any
    );
    const vendToken = (await loginV.json() as any).token;

    // vendedor accessing admin endpoint -> 403
    const forbiddenRes = await app.fetch(
      new Request("http://localhost/api/crm/admin/users", {
        headers: { Authorization: `Bearer ${vendToken}` },
      }),
      env as any
    );
    expect(forbiddenRes.status).toBe(403);

    // widget/public endpoints remain accessible without auth
    const healthRes = await app.fetch(new Request("http://localhost/health"), env as any);
    expect(healthRes.status).toBe(200);
  }, 15000);
});