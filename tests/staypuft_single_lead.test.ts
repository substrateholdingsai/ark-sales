import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { internalRouter } from "../src/routes/internal";
import { authMiddleware } from "../src/auth/middleware";
import { Env } from "../src/types";

const STAYPUFT_TEST_KEY = "test-staypuft-key-not-a-secret";
const RATE_LIMIT_TEST_KEY = "test-rate-limit-key-not-a-secret";
const ALLOWED_TENANTS = ["acc_ark_ledger", "acc_futura_capital"];
const KNOWN_COHORTS = [
  "ark_ledger_despachos",
  "futura_medicos_merida",
  "despachos_sat",
  "bpo_morosidad",
  "inmobiliarias_flujo",
  "futura_capital_patrimonial",
  "futura_logistica_progreso",
  "futura_brokers_aliados",
];

const BASE_LEAD: any = {
  tenant_id: "acc_ark_ledger",
  cohort: "ark_ledger_despachos",
  firm_name: "Despacho Ejemplo SA",
  contact_name: "Ana Ejemplo",
  contact_role: "Contacto de prueba",
  city: "Pachuca de Soto",
  state: "Hidalgo",
  phone: "+523331234567",
  whatsapp: "+523331234567",
  email: "Contacto1@example.com",
  website: "https://empresa-ejemplo1.test/pagina-1",
  instagram: "despacho_ejemplo",
  instagram_url: "https://www.instagram.com/despacho_ejemplo/",
  facebook: null,
  facebook_url: null,
  source: "instagram_manual",
  source_url: "https://www.instagram.com/despacho_ejemplo/",
  score: 85,
  pain: "Cierre fiscal y CFDI",
  products: ["ledger"],
  notes: "Datos ficticios de prueba",
};

function createLeadDb() {
  const leads: any[] = [];
  const audit: any[] = [];
  const queries: string[] = [];

  function findByPhone(args: any[]) {
    return leads.find((l) => l.phone === args[0]) || null;
  }
  function findByEmail(args: any[]) {
    return leads.find((l) => l.email === args[0]) || null;
  }
  function findByInstagram(args: any[]) {
    return leads.find((l) => l.instagram_handle && l.instagram_handle.toLowerCase() === String(args[0]).toLowerCase()) || null;
  }
  function findByFacebook(args: any[]) {
    return leads.find((l) => l.facebook_url === args[0]) || null;
  }
  function findTenant(args: any[]) {
    return ALLOWED_TENANTS.includes(args[0]) ? { id: args[0] } : null;
  }
  function findCohort(args: any[]) {
    return KNOWN_COHORTS.includes(args[0]) ? { cohort_id: args[0] } : null;
  }
  function websiteCandidates(args: any[]) {
    const name = String(args[0]).toLowerCase();
    return leads.filter((l) => l.despacho_nombre?.toLowerCase() === name && l.website_url);
  }

  return {
    _leads: leads,
    _audit: audit,
    queries,
    prepare(sql: string) {
      const s = sql.trim();
      const sl = s.toLowerCase();
      queries.push(s);
      const isWebsiteQuery =
        sl.includes("sales_leads") && sl.includes("lower(despacho_nombre) = lower(?)") && sl.includes("limit 100");
      return {
        bind(...args: any[]) {
          return {
            async first() {
              if (sl.startsWith("insert")) return null;
              if (sl.includes("sales_accounts") && sl.includes("where id = ?")) return findTenant(args);
              if (sl.includes("sales_cohorts") && sl.includes("where cohort_id = ?")) return findCohort(args);
              if (sl.includes("where phone = ?")) return findByPhone(args);
              if (sl.includes("where email = ?")) return findByEmail(args);
              if (sl.includes("where lower(instagram_handle) = lower(?)")) return findByInstagram(args);
              if (sl.includes("where facebook_url = ?")) return findByFacebook(args);
              return null;
            },
            async all() {
              if (sl.startsWith("insert")) return { results: [] };
              if (isWebsiteQuery) return { results: websiteCandidates(args) };
              return { results: [] };
            },
            async run() {
              if (sl.startsWith("insert into sales_leads")) {
                leads.push({
                  id: args[0],
                  tenant_id: args[1],
                  despacho_nombre: args[2],
                  email: args[3],
                  phone: args[4],
                  website_url: args[5],
                  instagram_handle: args[6],
                  facebook_url: args[7],
                  estado: "nuevo",
                  score: args[8],
                  conversation_summary: args[9],
                });
                return { success: true };
              }
              if (sl.startsWith("insert into crm_audit_log")) {
                audit.push({
                  id: args[0],
                  actor_user_id: args[1],
                  action: "lead_create_single",
                  entity_type: "lead",
                  entity_id: args[2],
                  metadata_json: args[3],
                });
                return { success: true };
              }
              return { success: true };
            },
          };
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true };
        },
      };
    },
  } as any;
}

function createEnv(db: any, staypuftKey: string = STAYPUFT_TEST_KEY): Env {
  return {
    DB: db,
    AI: {},
    SALES_INGEST_QUEUE: { send: vi.fn() } as any,
    SALES_AGENT: {} as any,
    ENVIRONMENT: "production",
    INTERNAL_SERVICE_KEY: "test-internal-key",
    STAYPUFT_API_KEY: staypuftKey,
  };
}

function createApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", authMiddleware());
  app.route("/api/internal", internalRouter);
  return app;
}

async function postLead(app: any, env: Env, body: any, key: string = STAYPUFT_TEST_KEY) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-StayPuft-Key": key };
  return app.request("/api/internal/leads", { method: "POST", headers, body: JSON.stringify(body) }, env);
}

describe("POST /api/internal/leads — alta de lead único (StayPuft)", () => {
  describe("Autorización", () => {
    it("rechaza petición sin X-StayPuft-Key (401)", async () => {
      const env = createEnv(createLeadDb());
      const app = createApp(env);
      const res = await app.request(
        "/api/internal/leads",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(BASE_LEAD) },
        env,
      );
      expect(res.status).toBe(401);
    });

    it("acepta petición con X-StayPuft-Key válida y opera como staypuft", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, BASE_LEAD);
      expect(res.status).toBe(201);
    });
  });

  describe("Validación de entrada", () => {
    it("lead válido de Instagram se crea con etapa nuevo (201) y registra auditoría", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, BASE_LEAD);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data).toMatchObject({
        status: "nuevo",
        created: true,
        duplicate: false,
      });
      expect(typeof data.lead_id).toBe("string");
      expect(data.lead_id.startsWith("lead_manual_")).toBe(true);

      expect(db._leads).toHaveLength(1);
      const lead = db._leads[0];
      expect(lead.estado).toBe("nuevo");
      expect(lead.despacho_nombre).toBe("Despacho Ejemplo SA");
      expect(lead.email).toBe("contacto1@example.com");
      expect(lead.phone).toBe("+523331234567");
      expect(lead.instagram_handle).toBe("despacho_ejemplo");
      expect(lead.tenant_id).toBe("acc_ark_ledger");

      expect(db._audit).toHaveLength(1);
      const audit = db._audit[0];
      expect(audit.actor_user_id).toBe("staypuft");
      expect(audit.action).toBe("lead_create_single");
      expect(audit.entity_type).toBe("lead");
      expect(audit.entity_id).toBe(data.lead_id);
      const meta = JSON.parse(audit.metadata_json);
      expect(meta).toEqual({
        tenant_id: "acc_ark_ledger",
        cohort: "ark_ledger_despachos",
        source: "instagram_manual",
        source_url: "https://www.instagram.com/despacho_ejemplo/",
      });
    });

    it("teléfono nacional de 10 dígitos se normaliza a E.164 (+52)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, phone: "3331234567", email: undefined });

      expect(res.status).toBe(201);
      expect(db._leads[0].phone).toBe("+523331234567");
    });

    it("teléfono malformado se anula a null, nunca se prefiere +52 ciegamente (con email como canal)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, phone: "not-a-phone", email: "contacto2@example.com" });

      expect(res.status).toBe(201);
      expect(db._leads[0].phone).toBeNull();
      expect(db._leads[0].email).toBe("contacto2@example.com");
      const summary = JSON.parse(db._leads[0].conversation_summary);
      expect(summary.phone_raw).toBe("not-a-phone");
    });

    it("teléfono malformado como único canal declarado → 400 (no queda ningún canal válido)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, phone: "not-a-phone", email: undefined, website: undefined, instagram: undefined, facebook: undefined });

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
    });

    it("teléfono malformado con dominio no mexicano se anula a null (email cubre el requisito)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, phone: "+12025550100" });

      expect(res.status).toBe(201);
      expect(db._leads[0].phone).toBeNull();
    });

    it("rechaza arreglos y payloads masivos (un solo lead por request)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, [BASE_LEAD, BASE_LEAD]);

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
      expect(db._audit).toHaveLength(0);
    });

    it("campos obligatorios faltantes → 400 y no crea nada", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const incomplete = { ...BASE_LEAD };
      delete incomplete.firm_name;
      const res = await postLead(app, env, incomplete);

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
    });

    it("sin ningún canal de contacto → 400 y no crea nada", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const noChannel = { ...BASE_LEAD, phone: undefined, email: undefined, website: undefined, instagram: undefined, facebook: undefined };
      const res = await postLead(app, env, noChannel);

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
      expect(db._audit).toHaveLength(0);
    });
  });

  describe("Fuente (source)", () => {
    it.each([["x"], ["twitter"], ["x_manual"]])("rechaza fuente %s con 400 (X.com no es target)", async (source) => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, source, email: "contacto2@example.com" });

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
    });

    it("acepta fuentes permitidas: instagram_manual, facebook_manual, web_manual, referral, harvester", async () => {
      for (const source of ["instagram_manual", "facebook_manual", "web_manual", "referral", "harvester"]) {
        const db = createLeadDb();
        const env = createEnv(db);
        const app = createApp(env);
        const res = await postLead(app, env, { ...BASE_LEAD, source, phone: "+523331234569" });
        expect(res.status).toBe(201);
      }
    });
  });

  describe("Aislamiento por tenant y cohorte", () => {
    it("tenant desconocido → 400, no crea nada", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, tenant_id: "acc_inexistente", phone: "+523331234570" });

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
    });

    it("cohort desconocida → 400, no crea nada", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, cohort: "cohort_inexistente", phone: "+523331234571" });

      expect(res.status).toBe(400);
      expect(db._leads).toHaveLength(0);
    });

    it("tenant permitido pero distinto al de la cohorte de Ledger aún se valida cohort por existencia (fail-closed)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);
      const res = await postLead(app, env, { ...BASE_LEAD, tenant_id: "acc_futura_capital", phone: "+523331234572" });
      // ark_ledger_despachos existe en sales_cohorts → se acepta el par (tenant, cohort) válidos
      expect(res.status).toBe(201);
    });
  });

  describe("Deduplicación (antes del insert, sin sobrescribir)", () => {
    it("teléfono duplicado devuelve el lead existente (200) y no crea un segundo lead", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);

      const first = await postLead(app, env, BASE_LEAD);
      expect(first.status).toBe(201);
      const firstId = (await first.json()).lead_id;

      const second = await postLead(app, env, {
        ...BASE_LEAD,
        firm_name: "Despacho Prueba 2 SA",
        email: "contacto3@example.com",
        instagram: "despacho_ejemplo2",
      });
      expect(second.status).toBe(200);
      const data = await second.json();
      expect(data).toMatchObject({ created: false, duplicate: true, lead_id: firstId });

      expect(db._leads).toHaveLength(1);
      expect(db._audit).toHaveLength(1);
    });

    it("handle de Instagram duplicado devuelve el existente (200) y no crea nada", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);

      await postLead(app, env, BASE_LEAD);

      const second = await postLead(app, env, {
        ...BASE_LEAD,
        firm_name: "Despacho Prueba 2 SA",
        phone: "+523331234573",
        email: "contacto3@example.com",
      });
      expect(second.status).toBe(200);
      const data = await second.json();
      expect(data.created).toBe(false);
      expect(data.duplicate).toBe(true);
      expect(typeof data.lead_id).toBe("string");

      expect(db._leads).toHaveLength(1);
      expect(db._audit).toHaveLength(1);
    });

    it("email duplicado (case-insensitive) devuelve el existente", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);

      await postLead(app, env, BASE_LEAD);

      const second = await postLead(app, env, {
        ...BASE_LEAD,
        firm_name: "Despacho Prueba 2 SA",
        phone: "+523331234574",
        instagram: "despacho_ejemplo2",
        email: "Contacto1@example.com",
      });
      expect(second.status).toBe(200);
      const data = await second.json();
      expect(data.created).toBe(false);
      expect(data.duplicate).toBe(true);
      expect(db._leads).toHaveLength(1);
    });

    it("misma firma + mismo dominio de sitio web → duplicado (200), sin crear", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);

      await postLead(app, env, BASE_LEAD);

      const second = await postLead(app, env, {
        ...BASE_LEAD,
        firm_name: "Despacho Ejemplo SA",
        phone: "+523331234575",
        email: "contacto4@example.com",
        instagram: "despacho_ejemplo2",
        website: "https://empresa-ejemplo1.test/pagina-2",
      });
      expect(second.status).toBe(200);
      const data = await second.json();
      expect(data.created).toBe(false);
      expect(data.duplicate).toBe(true);
      expect(db._leads).toHaveLength(1);
    });

    it("mismo dominio web pero firma distinta NO es duplicado (se crea lead nuevo)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);

      await postLead(app, env, BASE_LEAD);

      const second = await postLead(app, env, {
        ...BASE_LEAD,
        firm_name: "Despacho Prueba 3 SA",
        phone: "+523331234576",
        email: "contacto3@example.com",
        instagram: "despacho_ejemplo2",
        website: "https://empresa-ejemplo1.test/pagina-1",
      });
      expect(second.status).toBe(201);
      expect(db._leads).toHaveLength(2);
    });
  });

  describe("Efectos colaterales (ninguno al crear)", () => {
    it("no envía email, WhatsApp ni encola tarea automática al crear (0 llamadas)", async () => {
      const db = createLeadDb();
      const env = createEnv(db);
      const app = createApp(env);

      const res = await postLead(app, env, BASE_LEAD);
      expect(res.status).toBe(201);

      expect(env.SALES_INGEST_QUEUE.send).toHaveBeenCalledTimes(0);
      expect(db._leads).toHaveLength(1);
      expect(db._audit).toHaveLength(1);

      // El endpoint solo lee sales_leads / sales_accounts / sales_cohorts y escribe sales_leads + crm_audit_log.
      const writes = db.queries.filter((q: string) => q.toLowerCase().startsWith("insert"));
      expect(writes.length).toBe(2); // 1 lead + 1 auditoría
      expect(writes.some((q: string) => q.includes("resend") || q.includes("telnyx") || q.includes("instagram.com") || q.includes("facebook.com"))).toBe(false);
    });
  });

  describe("Límite de tasa (60 creates/hora por clave de operador)", () => {
    it("rechaza con 429 tras 60 creates en la hora", async () => {
      const env = createEnv(createLeadDb(), RATE_LIMIT_TEST_KEY);
      const app = createApp(env);

      let created = 0;
      let rateLimited = false;
      let lastStatus: number | null = null;

      for (let i = 0; i < 61; i++) {
        const body = {
          ...BASE_LEAD,
          firm_name: `Firma Test ${i} SC`,
          phone: `+525500000${String(100 + i).slice(-3)}`,
          email: `lead${i}@despacho-test.com`,
          instagram: `handle_test_${i}`,
        };
        const res = await postLead(app, env, body, RATE_LIMIT_TEST_KEY);
        lastStatus = res.status;
        if (res.status === 201) created++;
        if (res.status === 429) rateLimited = true;
      }

      expect(created).toBe(60);      expect(rateLimited).toBe(true);
      expect(lastStatus).toBe(429);
    });
  });
});
