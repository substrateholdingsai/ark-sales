import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index";
import { futuraAccountSqlPredicate, resolveTenantId, isFuturaAccount } from "../src/routes/crmAccounts";
import { signJwt } from "../src/auth/jwt";

function createMockD1() {
  const accounts = [
    { id: "acc_med_1", name: "Clínica Médica Altabrisa", scian_code: "621111", tenant_id: "acc_futura_capital", created_at: "2026-11-01 10:00:00" },
    { id: "acc_med_2", name: "Dr. Especialista Che", scian_code: "621112", tenant_id: "acc_futura_capital", created_at: "2026-11-01 11:00:00" },
    { id: "acc_med_3", name: "Consultorio Dental Sonrisas", scian_code: "621211", tenant_id: "acc_futura_capital", created_at: "2026-11-01 12:00:00" },
    { id: "acc_med_4", name: "Consultorio Privado Mérida", scian_code: "621399", tenant_id: "acc_futura_capital", created_at: "2026-11-01 13:00:00" },
    { id: "acc_leg_1", name: "Despacho Contable Fiscal", scian_code: "541211", tenant_id: "acc_ark_ledger", created_at: "2026-11-06 08:00:00" },
    { id: "acc_leg_2", name: "SOFOM Crédito Empresarial", scian_code: null, tenant_id: "acc_ark_ledger", created_at: "2026-11-06 08:30:00" },
  ];

  const contacts = [
    { id: "ct_med_1", account_id: "acc_med_1", name: "Dr. Roberto", email: "roberto@clinica.mx", phone: "9991234567", created_at: "2026-11-01 10:05:00" },
    { id: "ct_leg_1", account_id: "acc_leg_1", name: "C.P. Ana", email: "ana@despacho.mx", phone: "5512345678", created_at: "2026-11-06 08:05:00" },
  ];

  return {
    prepare(sql: string) {
      let boundArgs: any[] = [];
      return {
        bind(...args: any[]) {
          boundArgs = args;
          return this;
        },
        async first() {
          if (sql.includes("COUNT(*)")) {
            if (sql.includes("acc_futura_capital") || sql.includes("62%")) {
              if (sql.includes("sales_contacts")) {
                return { n: 1 };
              }
              return { n: 4 };
            }
            if (sql.includes("sales_contacts")) return { n: contacts.length };
            return { n: accounts.length };
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM sales_contacts c")) {
            let res = contacts.map(c => {
              const a = accounts.find(acc => acc.id === c.account_id);
              return {
                ...c,
                account_name: a?.name,
                account_city: "Mérida",
                account_origin: "lead",
                account_scian: a?.scian_code,
                account_tenant_id: a?.tenant_id,
                has_proposal_sent: 0
              };
            });
            if (sql.includes("acc_futura_capital") || sql.includes("62%")) {
              res = res.filter(c => c.account_tenant_id === "acc_futura_capital" || (c.account_scian && c.account_scian.startsWith("62")));
            }
            return { results: res };
          }
          if (sql.includes("sales_accounts")) {
            let res = [...accounts];
            if (sql.includes("acc_futura_capital") || sql.includes("62%")) {
              res = res.filter(a => a.tenant_id === "acc_futura_capital" || (a.scian_code && a.scian_code.startsWith("62")));
            } else if (sql.includes("acc_ark_ledger")) {
              res = res.filter(a => a.tenant_id === "acc_ark_ledger");
            }
            return { results: res };
          }
          return { results: [] };
        }
      };
    }
  };
}

describe("Medical Leads & Tenant Isolation Suite (Futura Capital)", () => {
  const secret = "test-jwt-secret-at-least-32-chars-long";
  let token: string;

  beforeEach(async () => {
    token = await signJwt({
      sub: "usr_admin_test",
      email: "admin@arksystems.site",
      role: "admin",
      name: "Admin Tester"
    }, secret);
  });

  it("resolveTenantId clasifica cualquier SCIAN 62xxxx (médicos) como acc_futura_capital", () => {
    expect(isFuturaAccount({ scian_code: "621111" })).toBe(true);
    expect(isFuturaAccount({ scian_code: "621112" })).toBe(true);
    expect(isFuturaAccount({ scian_code: "621211" })).toBe(true);
    expect(isFuturaAccount({ scian_code: "621399" })).toBe(true);
    expect(isFuturaAccount({ scian_code: "622111" })).toBe(true);
    expect(isFuturaAccount({ origin: "proptech" })).toBe(true);
    expect(isFuturaAccount({ origin: "inmobiliaria" })).toBe(true);
    expect(isFuturaAccount({ origin: "hermes" })).toBe(true);
    expect(resolveTenantId({ scian_code: "621111", tenant_id: "acc_ark_ledger" })).toBe("acc_futura_capital");
    expect(resolveTenantId({ scian_code: "621399" })).toBe("acc_futura_capital");
    expect(resolveTenantId({ scian_code: "541211", tenant_id: "acc_ark_ledger" })).toBe("acc_ark_ledger");
  });

  it("cuentas y contactos usan el mismo predicado SQL de tenant, seguro ante columnas nulas", async () => {
    const queries: string[] = [];
    const db = {
      prepare(sql: string) {
        return {
          bind() { return this; },
          async all() {
            queries.push(sql);
            return { results: [] };
          },
          async first() {
            queries.push(sql);
            return { n: 0 };
          }
        };
      }
    };
    const env: any = { DB: db, CRM_JWT_SECRET: secret };
    for (const [path, alias] of [
      ["/api/crm/accounts", "sales_accounts"],
      ["/api/crm/contacts", "a"]
    ]) {
      for (const tenant of ["acc_futura_capital", "acc_ark_ledger"]) {
        const res = await app.fetch(
          new Request(`https://sales.arksystems.site${path}?tenant=${tenant}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          env
        );
        expect(res.status).toBe(200);
      }
    }

    for (const alias of ["sales_accounts", "a"]) {
      const predicate = futuraAccountSqlPredicate(alias);
      expect(predicate).toContain(`COALESCE(${alias}.origin, '')`);
      expect(predicate).toContain(`COALESCE(NULLIF(${alias}.harvest_source, ''), ${alias}.origin, '')`);
      expect(predicate).toContain("LIKE '%proptech%'");
      expect(predicate).toContain("LIKE '%inmobiliaria%'");
      expect(predicate).toContain("LIKE '%hermes%'");
      expect(predicate).toContain("LIKE '%vektor%'");
      const relatedQueries = queries.filter(sql => sql.includes(alias === "a" ? "FROM sales_contacts c" : "FROM sales_accounts"));
      expect(relatedQueries.length).toBeGreaterThanOrEqual(4);
      expect(relatedQueries.every(sql => sql.includes(predicate))).toBe(true);
      expect(relatedQueries.some(sql => sql.includes("NOT " + predicate))).toBe(true);
    }
  });

  it("GET /api/crm/accounts?tenant=acc_futura_capital filtra a nivel base de datos y devuelve leads médicos", async () => {
    const mockDb = createMockD1();
    const env: any = {
      DB: mockDb,
      CRM_JWT_SECRET: secret
    };

    const res = await app.fetch(
      new Request("https://sales.arksystems.site/api/crm/accounts?tenant=acc_futura_capital&limit=50", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      env
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.items.length).toBe(4);
    expect(body.total).toBe(4);
    expect(body.items.every((i: any) => i.tenant_id === "acc_futura_capital")).toBe(true);
    expect(body.items.some((i: any) => i.name.includes("Clínica Médica Altabrisa"))).toBe(true);
  });

  it("GET /api/crm/contacts?tenant=acc_futura_capital filtra a nivel base de datos y devuelve contactos médicos", async () => {
    const mockDb = createMockD1();
    const env: any = {
      DB: mockDb,
      CRM_JWT_SECRET: secret
    };

    const res = await app.fetch(
      new Request("https://sales.arksystems.site/api/crm/contacts?tenant=acc_futura_capital&limit=50", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      env
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].name).toBe("Dr. Roberto");
    expect(body.items[0].tenant_id).toBe("acc_futura_capital");
  });

  it("GET /api/crm/contacts?city=merida busca variantes con y sin acento y teléfonos de Mérida", async () => {
    const queries: Array<{ sql: string; params: any[] }> = [];
    const db = {
      prepare(sql: string) {
        const statement = {
          params: [] as any[],
          bind(...args: any[]) {
            this.params = args;
            return this;
          },
          async all() {
            queries.push({ sql, params: this.params });
            return { results: [] };
          },
          async first() {
            queries.push({ sql, params: this.params });
            return { n: 0 };
          }
        };
        return statement;
      }
    };
    const env: any = { DB: db, CRM_JWT_SECRET: secret };
    const res = await app.fetch(
      new Request("https://sales.arksystems.site/api/crm/contacts?city=merida", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      env
    );

    expect(res.status).toBe(200);
    const contactQueries = queries.filter(query => query.sql.includes("FROM sales_contacts c"));
    expect(contactQueries).toHaveLength(2);
    for (const query of contactQueries) {
      expect(query.sql).toContain("a.city LIKE ?");
      expect(query.params).toContain("%Mérida%");
      expect(query.params).toContain("%Merida%");
      expect(query.params).toContain("%Yucatán%");
      expect(query.params).toContain("%999%");
    }
  });

  it("GET /api/superadmin/tenants/overview?tenant=acc_futura_capital devuelve únicamente cuentas de Futura Capital", async () => {
    const mockDb = createMockD1();
    const env: any = {
      DB: mockDb,
      CRM_JWT_SECRET: secret
    };

    const res = await app.fetch(
      new Request("https://sales.arksystems.site/api/superadmin/tenants/overview?tenant=acc_futura_capital", {
        headers: { Authorization: `Bearer ${token}` }
      }),
      env
    );

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.tenants.length).toBe(4);
    expect(body.tenants.every((t: any) => t.tenant_id === "acc_futura_capital")).toBe(true);
  });
});
