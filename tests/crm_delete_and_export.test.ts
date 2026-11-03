import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";

function createMockDb() {
  const accounts: any[] = [
    { id: "acc_1", name: "Despacho Contable Test", size: "1-5", city: "Mérida", origin: "denue" }
  ];
  const contacts: any[] = [
    { id: "ct_1", account_id: "acc_1", name: "Roberto Gómez", email: "roberto@test.com", phone: "+529991112233" }
  ];
  const audit: any[] = [];

  return {
    accounts,
    contacts,
    audit,
    prepare(sql: string) {
      const s = sql.toLowerCase().trim();
      const createExecution = (args: any[]) => ({
        async first() {
          if (s.includes("from sales_accounts where id = ?")) {
            return accounts.find(a => a.id === args[0]) || null;
          }
          if (s.includes("from sales_contacts where id = ?")) {
            return contacts.find(c => c.id === args[0]) || null;
          }
          if (s.includes("count(*)") && s.includes("sales_contacts")) {
            return { n: contacts.length };
          }
          return null;
        },
        async all() {
          if (s.includes("from sales_contacts")) {
            return {
              results: contacts.map(c => {
                const acc = accounts.find(a => a.id === c.account_id);
                return { ...c, account_name: acc?.name, account_city: acc?.city };
              })
            };
          }
          return { results: [] };
        },
        async run() {
          if (s.startsWith("delete from sales_accounts where id = ?")) {
            const idx = accounts.findIndex(a => a.id === args[0]);
            if (idx !== -1) accounts.splice(idx, 1);
            return { success: true };
          }
          if (s.startsWith("delete from sales_contacts where id = ?")) {
            const idx = contacts.findIndex(c => c.id === args[0]);
            if (idx !== -1) contacts.splice(idx, 1);
            return { success: true };
          }
          if (s.startsWith("delete from sales_contacts where account_id = ?")) {
            for (let i = contacts.length - 1; i >= 0; i--) {
              if (contacts[i].account_id === args[0]) contacts.splice(i, 1);
            }
            return { success: true };
          }
          if (s.startsWith("insert into crm_audit_log")) {
            audit.push(args);
            return { success: true };
          }
          return { success: true };
        }
      });

      const execNoArgs = createExecution([]);
      return {
        ...execNoArgs,
        bind(...args: any[]) {
          return createExecution(args);
        }
      };
    }
  };
}

describe("CRM Delete & Contact Export Endpoints", () => {
  const secret = "test-secret-1234567890";

  it("requires authentication for DELETE /api/crm/accounts/:id", async () => {
    const db = createMockDb();
    const env = { DB: db, CRM_JWT_SECRET: secret } as any;
    const res = await app.fetch(new Request("http://localhost/api/crm/accounts/acc_1", { method: "DELETE" }), env);
    expect(res.status).toBe(401);
  });

  it("deletes an account and associated dependencies when authenticated with write role", async () => {
    const db = createMockDb();
    const env = { DB: db, CRM_JWT_SECRET: secret } as any;
    const token = await signJwt({ sub: "usr_1", email: "admin@ark.test", role: "admin", name: "Admin" }, secret);

    const res = await app.fetch(new Request("http://localhost/api/crm/accounts/acc_1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }), env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.id).toBe("acc_1");
    expect(db.accounts.length).toBe(0);
    expect(db.contacts.length).toBe(0);
  });

  it("requires authentication for DELETE /api/crm/contacts/:id", async () => {
    const db = createMockDb();
    const env = { DB: db, CRM_JWT_SECRET: secret } as any;
    const res = await app.fetch(new Request("http://localhost/api/crm/contacts/ct_1", { method: "DELETE" }), env);
    expect(res.status).toBe(401);
  });

  it("deletes a contact when authenticated with write role", async () => {
    const db = createMockDb();
    const env = { DB: db, CRM_JWT_SECRET: secret } as any;
    const token = await signJwt({ sub: "usr_1", email: "rep@ark.test", role: "vendedor", name: "Sales Rep" }, secret);

    const res = await app.fetch(new Request("http://localhost/api/crm/contacts/ct_1", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }), env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.id).toBe("ct_1");
    expect(db.contacts.length).toBe(0);
  });

  it("lists contacts with joined account details and supports high limits", async () => {
    const db = createMockDb();
    const env = { DB: db, CRM_JWT_SECRET: secret } as any;
    const token = await signJwt({ sub: "usr_1", email: "admin@ark.test", role: "admin", name: "Admin" }, secret);

    const res = await app.fetch(new Request("http://localhost/api/crm/contacts?limit=1000", {
      headers: { Authorization: `Bearer ${token}` }
    }), env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.items.length).toBe(1);
    expect(body.items[0].name).toBe("Roberto Gómez");
    expect(body.items[0].account_name).toBe("Despacho Contable Test");
    expect(body.total).toBe(1);
  });
});
