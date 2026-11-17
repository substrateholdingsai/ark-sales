import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";
import {
  normalizeQuoteInputs,
  computeQuote,
  listPriceCentsFromUnit,
  QuoteError,
  type QuoteInputs,
  type PricingRuleLimits,
} from "../src/server/realEstate/quoteEngine";

const JWT_SECRET = "test-jwt-secret";
const ALTUM_TENANT = "acc_altum_sureste";
const FUTURA_TENANT = "acc_futura_capital";

const rule: PricingRuleLimits = {
  version: "2026-v1",
  name: "Demo Altum",
  max_discount_pct: 15,
  max_down_payment_pct: 50,
  allow_monthly: true,
};

function createEnv(db: any) {
  return {
    DB: db,
    AI: null as any,
    ENVIRONMENT: "development",
    CRM_JWT_SECRET: JWT_SECRET,
  } as any;
}

async function token(role: "admin" | "vendedor" | "lector" = "admin") {
  return signJwt({ sub: `usr_${role}`, email: `${role}@altum.test`, role }, JWT_SECRET);
}

async function authHeaders(role: "admin" | "vendedor" | "lector" = "admin") {
  return { Authorization: `Bearer ${await token(role)}` };
}

function makeDb(scenario: { projects: any[]; units: any[]; quotes: any[]; rules: any[] }) {
  const audit: any[] = [];
  const createdQuotes: any[] = [];
  const createdOpps: any[] = [];
  const units = [...scenario.units];
  const quotes = [...scenario.quotes];

  return {
    _audit: audit,
    _quotes: quotes,
    _opps: createdOpps,
    prepare(_sql: string) {
      const s = _sql.toLowerCase().replace(/\s+/g, " ").trim();
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (s.includes("from re_projects where id = ? and tenant_id = ? limit 1")) {
                return scenario.projects.find((p) => p.id === args[0] && p.tenant_id === args[1]) || null;
              }
              if (s.includes("from re_units u join re_projects p on p.id = u.project_id where u.id = ? and p.tenant_id = ? limit 1")) {
                const u = units.find((u) => u.id === args[0]);
                const p = scenario.projects.find((p) => p.id === u?.project_id && p.tenant_id === args[1]);
                if (!u || !p) return null;
                return { ...u, old_status: u.status, project_name: p.name, project_city: p.city, project_currency: p.currency, tenant_id: p.tenant_id };
              }
              if (
                s.includes(
                  "from re_quotes q join re_units u on u.id = q.unit_id join re_projects p on p.id = u.project_id where q.id = ? and p.tenant_id = ? limit 1",
                )
              ) {
                const q = quotes.find((q) => q.id === args[0]);
                const u = units.find((u) => u.id === q?.unit_id);
                const p = scenario.projects.find((p) => p.id === u?.project_id && p.tenant_id === args[1]);
                if (!q || !u || !p) return null;
                return { ...u, ...q, project_name: p.name, project_city: p.city, project_currency: p.currency, tenant_id: p.tenant_id };
              }
              if (s.includes("from re_pricing_rules where tenant_id = ? and is_active = 1 limit 1")) {
                return scenario.rules.find((r) => r.tenant_id === args[0] && r.is_active === 1) || null;
              }
              return null;
            },
            async all() {
              if (s.includes("from re_units where project_id = ? order by block, level, unit_number limit ?")) {
                return { results: units.filter((u) => u.project_id === args[0]) };
              }
              return { results: [] };
            },
            async run() {
              if (s.startsWith("update re_units set status = ? where id = ?")) {
                const u = units.find((u) => u.id === args[1]);
                if (u) u.status = args[0];
                return { success: true };
              }
              if (s.startsWith("insert into re_quotes")) {
                const quote = {
                  id: args[0],
                  unit_id: args[1],
                  account_id: args[2],
                  contact_id: args[3],
                  opportunity_id: args[4],
                  discount_pct: args[5],
                  discount_amount: args[6],
                  total_sale: args[7],
                  down_payment_pct: args[8],
                  down_payment_amount: args[9],
                  down_payment_count: args[10],
                  monthly_pct: args[11],
                  monthly_amount: args[12],
                  monthly_count: args[13],
                  payment_plan: args[14],
                  status: args[15],
                  created_by: args[16],
                  created_at: args[17],
                };
                createdQuotes.push(quote);
                quotes.push(quote);
                return { success: true };
              }
              if (s.startsWith("insert into sales_opportunities")) {
                createdOpps.push({
                  id: args[0],
                  account_id: args[1],
                  contact_id: args[2],
                  stage: "nuevo",
                  owner_user_id: args[5],
                  products_interest_json: args[6],
                  estimated_value: args[5],
                  currency: args[6],
                });
                return { success: true };
              }
              if (s.startsWith("update re_quotes set status = 'aceptada' where id = ?")) {
                const q = quotes.find((q) => q.id === args[0]);
                if (q) q.status = "aceptada";
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
                });
                return { success: true };
              }
              return { success: true };
            },
          };
        },
      };
    },
  } as any;
}

describe("quote engine — golden vectors", () => {
  it("descuento porcentual sobre precio lista", () => {
    const n = normalizeQuoteInputs({ unit_id: "u1", discount_pct: 10 } as QuoteInputs, rule);
    const c = computeQuote(n, 100_000_000, rule); // $1,000,000.00 MXN
    expect(c.discount_amount_cents).toBe(10_000_000);
    expect(c.total_sale_cents).toBe(90_000_000);
    expect(c.total_sale_mxn).toBe("900000.00");
    expect(c.discount_amount_mxn).toBe("100000.00");
  });

  it("descuento monto explícito cuando pct es 0", () => {
    const n = normalizeQuoteInputs({ unit_id: "u1", discount_pct: 0, discount_amount: 50000 } as QuoteInputs, rule);
    const c = computeQuote(n, 100_000_000, rule);
    expect(c.discount_amount_cents).toBe(5_000_000);
    expect(c.total_sale_cents).toBe(95_000_000);
  });

  it("enganche porcentual sobre total de venta", () => {
    const n = normalizeQuoteInputs({ unit_id: "u1", discount_pct: 10, down_payment_pct: 20 } as QuoteInputs, rule);
    const c = computeQuote(n, 100_000_000, rule);
    expect(c.down_payment_amount_cents).toBe(18_000_000);
    expect(c.monthly_pool_cents).toBe(72_000_000);
  });

  it("reparto de centavos restantes en mensualidades", () => {
    const n = normalizeQuoteInputs({ unit_id: "u1", monthly_count: 3 } as QuoteInputs, rule);
    const c = computeQuote(n, 100_000, rule); // $1,000.00 MXN
    expect(c.monthly_amount_cents).toBe(33_333);
    expect(c.remainder_cents).toBe(1);
    expect(c.monthly_breakdown.map((p) => p.amount_cents)).toEqual([33_334, 33_333, 33_333]);
    expect(c.monthly_breakdown.map((p) => p.amount_mxn)).toEqual(["333.34", "333.33", "333.33"]);
  });

  it("contado (monthly_count 0) sin mensualidades", () => {
    const n = normalizeQuoteInputs({ unit_id: "u1", monthly_count: 0 } as QuoteInputs, rule);
    const c = computeQuote(n, 50_000_000, rule);
    expect(c.monthly_count).toBe(0);
    expect(c.monthly_amount_cents).toBe(0);
    expect(c.monthly_breakdown).toEqual([]);
    expect(c.monthly_pool_cents).toBe(50_000_000);
  });

  it("precio lista desde area_m2 * price_per_m2 cuando no hay list_price explícito", () => {
    const cents = listPriceCentsFromUnit({ areaM2: 60, pricePerM2: 25000, explicitListPrice: null });
    expect(cents).toBe(150_000_000);
    const explicit = listPriceCentsFromUnit({ areaM2: 60, pricePerM2: 25000, explicitListPrice: 999999 });
    expect(explicit).toBe(99_999_900);
  });

  it("rechaza valores fuera de rango", () => {
    expect(() => normalizeQuoteInputs({ unit_id: "u1", discount_pct: 110 } as QuoteInputs, rule)).toThrow(QuoteError);
    expect(() => normalizeQuoteInputs({ unit_id: "u1", down_payment_pct: -5 } as QuoteInputs, rule)).toThrow(QuoteError);
    expect(() => normalizeQuoteInputs({ unit_id: "u1", monthly_count: -1 } as QuoteInputs, rule)).toThrow(QuoteError);
  });
});

describe("endpoints — real estate (tenant acc_altum_sureste)", () => {
  const units = [
    {
      id: "re_unit_001",
      project_id: "re_proj_altum_merida",
      block: "Torre A",
      level: 1,
      unit_number: "A-01",
      area_m2: 60,
      price_per_m2: 25000,
      list_price: 1500000,
      status: "disponible",
      unit_type: "2 recámaras",
      floor_plan_url: null,
      is_demo: 1,
    },
    {
      id: "re_unit_002",
      project_id: "re_proj_altum_merida",
      block: "Torre A",
      level: 1,
      unit_number: "A-02",
      area_m2: 45,
      price_per_m2: 22000,
      list_price: 990000,
      status: "apartado",
      unit_type: "1 recámara",
      floor_plan_url: null,
      is_demo: 1,
    },
    {
      id: "re_unit_003",
      project_id: "re_proj_altum_merida",
      block: "Torre B",
      level: 3,
      unit_number: "B-12",
      area_m2: 80,
      price_per_m2: 30000,
      list_price: 2400000,
      status: "vendido",
      unit_type: "3 recámaras",
      floor_plan_url: null,
      is_demo: 1,
    },
    {
      id: "re_unit_004",
      project_id: "re_proj_altum_merida",
      block: "Torre C",
      level: 2,
      unit_number: "C-05",
      area_m2: 55,
      price_per_m2: 20000,
      list_price: 1100000,
      status: "bloqueado",
      unit_type: "Estudio",
      floor_plan_url: null,
      is_demo: 1,
    },
    {
      id: "re_unit_futura",
      project_id: "re_proj_futura",
      block: "Torre X",
      level: 1,
      unit_number: "X-01",
      area_m2: 60,
      price_per_m2: 25000,
      list_price: 1500000,
      status: "disponible",
      unit_type: "2 recámaras",
      floor_plan_url: null,
      is_demo: 0,
    },
  ];
  const projects = [
    { id: "re_proj_altum_merida", tenant_id: ALTUM_TENANT, name: "Altum Mérida", city: "Mérida", currency: "MXN", total_units: 80, is_demo: 1 },
    { id: "re_proj_futura", tenant_id: FUTURA_TENANT, name: "Futura Sisal", city: "Sisal", currency: "MXN", total_units: 10, is_demo: 0 },
  ];
  const rules = [
    {
      id: "r1",
      tenant_id: ALTUM_TENANT,
      version: "2026-v1",
      name: "Demo Altum",
      rules_json: JSON.stringify({ max_discount_pct: 15, max_down_payment_pct: 50, allow_monthly: true }),
      is_active: 1,
    },
  ];

  it("GET masterplan agrupa unidades por bloque con estatus", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/projects/re_proj_altum_merida/masterplan", { headers: await authHeaders("admin") }),
      env as any,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.project.name).toBe("Altum Mérida");
    expect(body.unit_count).toBe(4);
    expect(body.blocks.map((b: any) => b.block)).toEqual(["Torre A", "Torre B", "Torre C"]);
    const torreA = body.blocks.find((b: any) => b.block === "Torre A");
    expect(torreA.units.map((u: any) => ({ id: u.id, status: u.status }))).toEqual([
      { id: "re_unit_001", status: "disponible" },
      { id: "re_unit_002", status: "apartado" },
    ]);
  });

  it("aislamiento de tenant: proyecto de Altum no es visible para otro tenant", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/projects/re_proj_altum_merida/masterplan", {
        headers: { ...(await authHeaders("admin")), "X-Tenant-Id": FUTURA_TENANT },
      }),
      env as any,
    );
    expect(res.status).toBe(404);
  });

  it("GET unidad detalle", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(new Request("http://localhost/api/crm/re/units/re_unit_001", { headers: await authHeaders("admin") }), env as any);
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.id).toBe("re_unit_001");
    expect(body.list_price).toBe(1500000);
    expect(body.project_name).toBe("Altum Mérida");
  });

  it("aislamiento de tenant: unidad de Altum no visible para otro tenant", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/units/re_unit_001", { headers: { ...(await authHeaders("admin")), "X-Tenant-Id": FUTURA_TENANT } }),
      env as any,
    );
    expect(res.status).toBe(404);
  });

  it("PATCH estatus escribe auditoría y rechaza estatus inválido", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);

    const bad = await app.fetch(
      new Request("http://localhost/api/crm/re/units/re_unit_001/status", {
        method: "PATCH",
        headers: { ...(await authHeaders("admin")), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "otro" }),
      }),
      env as any,
    );
    expect(bad.status).toBe(400);

    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/units/re_unit_001/status", {
        method: "PATCH",
        headers: { ...(await authHeaders("admin")), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "vendido" }),
      }),
      env as any,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe("vendido");
    expect(body.previous_status).toBe("disponible");

    const auditRow = db._audit.find((a: any) => a.action === "re.unit_status_changed");
    expect(auditRow).toBeTruthy();
    const meta = JSON.parse(auditRow.metadata_json);
    expect(meta.from).toBe("disponible");
    expect(meta.to).toBe("vendido");
    expect(auditRow.entity_type).toBe("re_unit");
  });

  it("lector no puede cambiar estatus", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/units/re_unit_001/status", {
        method: "PATCH",
        headers: { ...(await authHeaders("lector")), "Content-Type": "application/json" },
        body: JSON.stringify({ status: "vendido" }),
      }),
      env as any,
    );
    expect(res.status).toBe(403);
  });

  it("POST cotización calcula en servidor y devuelve todos los montos", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/quotes", {
        method: "POST",
        headers: { ...(await authHeaders("admin")), "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: "re_unit_001", discount_pct: 10, down_payment_pct: 20, monthly_count: 12, payment_plan: "Mensualidades iguales" }),
      }),
      env as any,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.quote.status).toBe("borrador");
    expect(body.quote.unit_id).toBe("re_unit_001");
    const c = body.calculation;
    expect(c.list_price_cents).toBe(150_000_000);
    expect(c.discount_amount_cents).toBe(15_000_000);
    expect(c.total_sale_cents).toBe(135_000_000);
    expect(c.total_sale_mxn).toBe("1350000.00");
    expect(c.down_payment_amount_cents).toBe(27_000_000);
    expect(c.monthly_pool_cents).toBe(108_000_000);
    expect(c.monthly_amount_cents).toBe(9_000_000);
    expect(c.monthly_count).toBe(12);
    expect(c.remainder_cents).toBe(0);
    expect(db._audit.some((a: any) => a.action === "re.quote_created")).toBe(true);
  });

  it("POST cotización sin reglas de precios -> fail-closed 503", async () => {
    const db = makeDb({ projects, units, quotes: [], rules: [] });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/quotes", {
        method: "POST",
        headers: { ...(await authHeaders("admin")), "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: "re_unit_001", discount_pct: 10 }),
      }),
      env as any,
    );
    expect(res.status).toBe(503);
  });

  it("POST cotización descuento sobre máximo de regla -> 400", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/quotes", {
        method: "POST",
        headers: { ...(await authHeaders("admin")), "Content-Type": "application/json" },
        body: JSON.stringify({ unit_id: "re_unit_001", discount_pct: 90 }),
      }),
      env as any,
    );
    expect(res.status).toBe(400);
  });

  it("POST convertir cotización a oportunidad stage nuevo, sin envío", async () => {
    const db = makeDb({
      projects,
      units,
      quotes: [{ id: "re_quote_existing", unit_id: "re_unit_001", total_sale: 1350000, status: "borrador", created_by: "usr_admin" }],
      rules,
    });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/quotes/re_quote_existing/convert", {
        method: "POST",
        headers: { ...(await authHeaders("admin")), "Content-Type": "application/json" },
      }),
      env as any,
    );
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.stage).toBe("nuevo");
    expect(body.quote_status).toBe("aceptada");
    expect(body.email_sent).toBe(false);
    expect(body.whatsapp_sent).toBe(false);
    const opp = db._opps[0];
    expect(opp.stage).toBe("nuevo");
    expect(opp.estimated_value).toBe(1350000);
    const auditRow = db._audit.find((a: any) => a.action === "re.quote_converted");
    expect(auditRow).toBeTruthy();
    const meta = JSON.parse(auditRow.metadata_json);
    expect(meta.email_sent).toBe(false);
    expect(meta.whatsapp_sent).toBe(false);
  });

  it("POST convertir cotización ya convertida -> 409", async () => {
    const db = makeDb({ projects, units, quotes: [{ id: "re_quote_aceptada", unit_id: "re_unit_001", status: "aceptada" }], rules });
    const env = createEnv(db);
    const res = await app.fetch(
      new Request("http://localhost/api/crm/re/quotes/re_quote_aceptada/convert", { method: "POST", headers: { ...(await authHeaders("admin")) } }),
      env as any,
    );
    expect(res.status).toBe(409);
  });

  it("GET PDF devuelve documento sin envío", async () => {
    const db = makeDb({
      projects,
      units,
      quotes: [
        {
          id: "re_quote_pdf",
          unit_id: "re_unit_001",
          total_sale: 1350000,
          status: "borrador",
          payment_plan: null,
          discount_pct: 10,
          down_payment_pct: 20,
          monthly_count: 0,
          created_at: new Date().toISOString(),
          area_m2: 60,
          price_per_m2: 25000,
          list_price: 1500000,
          block: "Torre A",
          level: 1,
          unit_number: "A-01",
          unit_type: "2 recámaras",
          project_name: "Altum Mérida",
          project_city: "Mérida",
        },
      ],
      rules,
    });
    const env = createEnv(db);
    const res = await app.fetch(new Request("http://localhost/api/crm/re/quotes/re_quote_pdf/pdf", { headers: await authHeaders("admin") }), env as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("requiere autenticación", async () => {
    const db = makeDb({ projects, units, quotes: [], rules });
    const env = createEnv(db);
    const res = await app.fetch(new Request("http://localhost/api/crm/re/projects/re_proj_altum_merida/masterplan"), env as any);
    expect(res.status).toBe(401);
  });
});
