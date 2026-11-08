import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { internalRouter, isGenericFirmName, isValidEmailFormat, validateSkillResult } from "../src/routes/internal";
import { webhookRouter } from "../src/routes/webhooks";
import { Env } from "../src/types";

describe("StayPuft Cohort Enqueue & Fail-Closed Quarantine Suite", () => {
  const STAYPUFT_TEST_KEY = "staypuft_secret_live_key_xyz123";

  describe("1. Validators: isGenericFirmName & isValidEmailFormat", () => {
    it("identifies generic DENUE firm names and accepts real firm names", () => {
      // Generic names from harvest
      expect(isGenericFirmName(null)).toBe(true);
      expect(isGenericFirmName("")).toBe(true);
      expect(isGenericFirmName("   ")).toBe(true);
      expect(isGenericFirmName("ab")).toBe(true);
      expect(isGenericFirmName("SIN NOMBRE")).toBe(true);
      expect(isGenericFirmName("Despacho")).toBe(true);
      expect(isGenericFirmName("DESPACHO CONTABLE")).toBe(true);
      expect(isGenericFirmName("Contabilidad")).toBe(true);
      expect(isGenericFirmName("Contador")).toBe(true);
      expect(isGenericFirmName("Asesoría Contable")).toBe(true);
      expect(isGenericFirmName("Servicios Contables")).toBe(true);
      expect(isGenericFirmName("Consultoria")).toBe(true);
      expect(isGenericFirmName("S/N")).toBe(true);
      expect(isGenericFirmName("No Aplica")).toBe(true);
      expect(isGenericFirmName("Desconocido")).toBe(true);

      // Real firm names
      expect(isGenericFirmName("Despacho Contable Maya S.C.")).toBe(false);
      expect(isGenericFirmName("Pérez & Asociados Consultores")).toBe(false);
      expect(isGenericFirmName("Corporativo Contable de Yucatán")).toBe(false);
      expect(isGenericFirmName("Castillo Fiscalistas")).toBe(false);
    });

    it("validates emails strictly and rejects placeholders and bad formats", () => {
      // Invalid or placeholder emails
      expect(isValidEmailFormat(null)).toBe(false);
      expect(isValidEmailFormat("")).toBe(false);
      expect(isValidEmailFormat("invalid-email")).toBe(false);
      expect(isValidEmailFormat("@domain.com")).toBe(false);
      expect(isValidEmailFormat("user@")).toBe(false);
      expect(isValidEmailFormat("denue_12345@harvest.arksystems.local")).toBe(false);
      expect(isValidEmailFormat("test@example.com")).toBe(false);
      expect(isValidEmailFormat("info@sub.example.com")).toBe(false);
      expect(isValidEmailFormat("noemail@despacho.com")).toBe(false);
      expect(isValidEmailFormat("sincorreo@despacho.com")).toBe(false);
      expect(isValidEmailFormat("noreply@despacho.com")).toBe(false);
      expect(isValidEmailFormat("no-reply@despacho.com")).toBe(false);

      // Valid emails
      expect(isValidEmailFormat("contacto@despachomaya.com")).toBe(true);
      expect(isValidEmailFormat("director_fiscal@castillo-auditores.mx")).toBe(true);
      expect(isValidEmailFormat("pablo@arksystems.site")).toBe(true);
    });
  });

  describe("2. validateSkillResult: StayPuft Extended Schema vs Grok Bot Strict Schema", () => {
    it("validates StayPuft research_prospect_web results including new fields and descartar", () => {
      const validStayPuftResult = {
        tamano: "6-20",
        email_valid: true,
        website_url: "https://despachomaya.com",
        linkedin_url: "https://linkedin.com/company/despachomaya",
        software_detectado: "Contpaqi Contabilidad y AdminPAQ",
        socios: ["C.P. Rodrigo Maya"],
        senales_dolor: ["Conciliación bancaria SAT lenta"],
        fuentes: ["https://despachomaya.com"],
        confidence: 88,
        descartar: false,
      };

      const res = validateSkillResult("research_prospect_web", validStayPuftResult, "staypuft");
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("requires motivo_descarte when StayPuft flags descartar = true", () => {
      const missingReason = {
        descartar: true,
        motivo_descarte: "",
      };
      const res = validateSkillResult("research_prospect_web", missingReason, "staypuft");
      expect(res.success).toBe(false);
      expect(res.error).toContain("motivo_descarte");

      const withReason = {
        descartar: true,
        motivo_descarte: "Despacho liquidado, número telefónico fuera de servicio.",
      };
      const resValid = validateSkillResult("research_prospect_web", withReason, "staypuft");
      expect(resValid.success).toBe(true);
    });

    it("rejects invalid confidence numbers and tamano enums for StayPuft", () => {
      const badConfidence = {
        confidence: 150,
      };
      const res1 = validateSkillResult("research_prospect_web", badConfidence, "staypuft");
      expect(res1.success).toBe(false);
      expect(res1.error).toContain("confidence");

      const badTamano = {
        tamano: "gigante_invalido",
      };
      const res2 = validateSkillResult("research_prospect_web", badTamano, "staypuft");
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("tamano");
    });

    it("preserves strict validation for Grok Bot (requires tamano_estimado, fuentes, confianza)", () => {
      const incompleteGrokResult = {
        tamano: "6-20",
        confidence: 90,
      };
      // Grok bot requires tamano_estimado, fuentes, confianza
      const res = validateSkillResult("research_prospect_web", incompleteGrokResult, "grok_bot");
      expect(res.success).toBe(false);
      expect(res.error).toContain("tamano_estimado");

      const validGrokResult = {
        tamano_estimado: "6-20",
        fuentes: ["https://example.com"],
        confianza: 90,
      };
      const validGrok = validateSkillResult("research_prospect_web", validGrokResult, "grok_bot");
      expect(validGrok.success).toBe(true);
    });
  });

  describe("3. Enqueue Cohort Endpoint: POST /api/internal/agent-tasks/enqueue-cohort", () => {
    const mockApp = (db: any) => {
      const app = new Hono<{ Bindings: Env }>();
      app.use("*", async (c, next) => {
        c.env = {
          DB: db,
          STAYPUFT_API_KEY: STAYPUFT_TEST_KEY,
          ENVIRONMENT: "test",
        } as any;
        await next();
      });
      app.route("/api/internal", internalRouter);
      return app;
    };

    it("rejects unauthorized calls without valid internal/staypuft key", async () => {
      const app = mockApp({});
      const res = await app.request("/api/internal/agent-tasks/enqueue-cohort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohort_slug: "ark_ledger_despachos" }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects unauthorized cohorts or skills", async () => {
      const db = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      };
      const app = mockApp(db);
      const resCohort = await app.request("/api/internal/agent-tasks/enqueue-cohort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
        },
        body: JSON.stringify({ cohort_slug: "futura_capital_medicos" }),
      });
      expect(resCohort.status).toBe(400);

      const resSkill = await app.request("/api/internal/agent-tasks/enqueue-cohort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
        },
        body: JSON.stringify({ cohort_slug: "ark_ledger_despachos", skill_name: "unauthorized_skill" }),
      });
      expect(resSkill.status).toBe(400);
    });

    it("enqueues valid candidates up to limit and filters out invalid/duplicate leads", async () => {
      const insertedTasks: any[] = [];
      const existingTasks = [
        { lead_id: "lead_already_done", skill_name: "research_prospect_web" },
      ];

      const candidateRows = [
        // 1. Valid candidate 1
        {
          lead_id: "lead_merida_1",
          lead_email: "contacto@fiscalmaya.com",
          despacho_nombre: "Fiscal Maya S.C.",
          city: "Mérida",
          state: "Yucatán",
          scian_code: "541211",
          tenant_id: "acc_ark_ledger",
          origin: "denue",
          created_at: "2026-11-01",
        },
        // 2. Generic name -> excluded
        {
          lead_id: "lead_generic",
          lead_email: "info@generic.com",
          despacho_nombre: "DESPACHO CONTABLE",
          city: "Mérida",
          state: "Yucatán",
          scian_code: "541211",
          tenant_id: "acc_ark_ledger",
          origin: "denue",
          created_at: "2026-11-02",
        },
        // 3. Placeholder email -> excluded
        {
          lead_id: "lead_placeholder_mail",
          lead_email: "denue_999@harvest.arksystems.local",
          despacho_nombre: "Contadores del Sureste",
          city: "Mérida",
          state: "Yucatán",
          scian_code: "541211",
          tenant_id: "acc_ark_ledger",
          origin: "denue",
          created_at: "2026-11-03",
        },
        // 4. Non-Mérida city -> excluded
        {
          lead_id: "lead_cancun",
          lead_email: "contacto@cancunfiscal.com",
          despacho_nombre: "Cancún Fiscalistas",
          city: "Cancún",
          state: "Quintana Roo",
          scian_code: "541211",
          tenant_id: "acc_ark_ledger",
          origin: "denue",
          created_at: "2026-11-04",
        },
        // 5. SOFOM lead -> excluded
        {
          lead_id: "lead_sipres_15147",
          lead_email: "pld@creditocorporativo.com.mx",
          despacho_nombre: "Crédito Corporativo SAPI",
          city: "Mérida",
          state: "Yucatán",
          scian_code: "541211",
          tenant_id: "acc_ark_ledger",
          origin: "sipres",
          created_at: "2026-11-05",
        },
        // 6. Already enqueued lead -> skipped
        {
          lead_id: "lead_already_done",
          lead_email: "ya@registrado.com",
          despacho_nombre: "Despacho Ya Registrado",
          city: "Mérida",
          state: "Yucatán",
          scian_code: "541211",
          tenant_id: "acc_ark_ledger",
          origin: "denue",
          created_at: "2026-11-06",
        },
        // 7. Valid candidate 2
        {
          lead_id: "lead_merida_2",
          lead_email: "socios@peninsulacontable.mx",
          despacho_nombre: "Península Contable Asesores",
          city: "Mérida",
          state: "Yucatán",
          scian_code: "541212",
          tenant_id: "acc_ark_ledger",
          origin: "denue",
          created_at: "2026-11-06",
        },
      ];

      const createHandler = (query: string, params: any[] = []) => ({
        all: vi.fn().mockImplementation(async () => {
          if (query.includes("FROM sales_accounts a")) {
            return { results: candidateRows };
          }
          return { results: [] };
        }),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes("agent_tasks") && query.includes("lead_id = ?")) {
            const leadId = params[0];
            const skillName = params[1];
            const found = existingTasks.find(t => t.lead_id === leadId && t.skill_name === skillName);
            return found || null;
          }
          return null;
        }),
        run: vi.fn().mockImplementation(async () => {
          if (query.includes("INSERT INTO agent_tasks")) {
            insertedTasks.push({
              id: params[0],
              lead_id: params[1],
              skill_name: params[2],
              operator: params[3],
              payload: JSON.parse(params[4]),
              status: "pending",
            });
            return { success: true };
          }
          return { success: true };
        }),
      });

      const db = {
        prepare: vi.fn().mockImplementation((query: string) => {
          const handler = createHandler(query);
          return {
            ...handler,
            bind: vi.fn().mockImplementation((...params: any[]) => createHandler(query, params)),
          };
        }),
      };

      const app = mockApp(db);
      const res = await app.request("/api/internal/agent-tasks/enqueue-cohort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
        },
        body: JSON.stringify({
          cohort_slug: "ark_ledger_despachos",
          skill_name: "research_prospect_web",
          limit: 20,
        }),
      });

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.enqueued).toHaveLength(2);
      expect(data.enqueued[0].lead_id).toBe("lead_merida_1");
      expect(data.enqueued[1].lead_id).toBe("lead_merida_2");

      // Verify inserted tasks in DB
      expect(insertedTasks).toHaveLength(2);
      expect(insertedTasks[0].operator).toBe("staypuft");
      expect(insertedTasks[0].status).toBe("pending");
      expect(insertedTasks[0].payload.despacho_nombre).toBe("Fiscal Maya S.C.");

      // Check skipped reasons
      expect(data.skipped.some((s: any) => s.reason === "nombre_generico")).toBe(true);
      expect(data.skipped.some((s: any) => s.reason === "email_invalido_o_placeholder")).toBe(true);
      expect(data.skipped.some((s: any) => s.reason === "ciudad_no_merida")).toBe(true);
      expect(data.skipped.some((s: any) => s.reason === "origen_sipres_sofom")).toBe(true);
      expect(data.skipped.some((s: any) => s.reason === "tarea_ya_existente")).toBe(true);
    });
  });

  describe("4. Webhook Ingest Fail-Closed Quarantine", () => {
    const mockWebhookApp = (quarantineRows: any[] = [], leadsRows: any[] = []) => {
      const app = new Hono<{ Bindings: Env }>();
      const db = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockImplementation((...params: any[]) => ({
            run: vi.fn().mockImplementation(async () => {
              if (query.includes("INSERT INTO sales_lead_quarantine")) {
                quarantineRows.push({
                  id: params[0],
                  lead_id: params[1],
                  email: params[2],
                  despacho_nombre: params[3],
                  reason: params[4],
                  payload_json: params[5],
                });
              } else if (query.includes("INSERT INTO sales_leads")) {
                leadsRows.push({ id: params[0], email: params[1] });
              }
              return { success: true };
            }),
            first: vi.fn().mockResolvedValue(null),
          })),
        })),
        batch: vi.fn().mockResolvedValue([{ success: true }]),
      };

      app.route("/webhooks/ingest", webhookRouter);
      return { app, db, quarantineRows, leadsRows };
    };

    it("quarantines lead when firm name is generic", async () => {
      const { app, db, quarantineRows, leadsRows } = mockWebhookApp();
      const res = await app.fetch(
        new Request("http://localhost/webhooks/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: "lead_quar_generic_01",
            email: "contador@despachoreal.com",
            despacho_nombre: "DESPACHO CONTABLE",
          }),
        }),
        { DB: db, ENVIRONMENT: "test" } as any,
      );

      expect(res.status).toBe(202);
      const json: any = await res.json();
      expect(json.status).toBe("quarantined");
      expect(json.quarantined).toBe(true);
      expect(json.reason).toBe("sin_nombre_real_generico");
      expect(quarantineRows).toHaveLength(1);
      expect(quarantineRows[0].reason).toBe("sin_nombre_real_generico");
      expect(leadsRows).toHaveLength(0); // Not inserted in active leads!
    });

    it("quarantines lead when email is invalid or harvest placeholder", async () => {
      const { app, db, quarantineRows, leadsRows } = mockWebhookApp();
      const res = await app.fetch(
        new Request("http://localhost/webhooks/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: "lead_quar_placeholder_02",
            email: "denue_555@harvest.arksystems.local",
            despacho_nombre: "Pérez & Asociados Consultores S.C.",
          }),
        }),
        { DB: db, ENVIRONMENT: "test" } as any,
      );

      expect(res.status).toBe(202);
      const json: any = await res.json();
      expect(json.status).toBe("quarantined");
      expect(json.quarantined).toBe(true);
      expect(json.reason).toBe("email_invalido_o_placeholder");
      expect(quarantineRows).toHaveLength(1);
      expect(quarantineRows[0].reason).toBe("email_invalido_o_placeholder");
      expect(leadsRows).toHaveLength(0);
    });

    it("quarantines lead when both name is generic and email is invalid", async () => {
      const { app, db, quarantineRows, leadsRows } = mockWebhookApp();
      const res = await app.fetch(
        new Request("http://localhost/webhooks/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: "lead_quar_both_03",
            email: "sincorreo@example.com",
            despacho_nombre: "SIN NOMBRE",
          }),
        }),
        { DB: db, ENVIRONMENT: "test" } as any,
      );

      expect(res.status).toBe(202);
      const json: any = await res.json();
      expect(json.status).toBe("quarantined");
      expect(json.quarantined).toBe(true);
      expect(json.reason).toBe("sin_nombre_real_y_email_invalido");
      expect(quarantineRows).toHaveLength(1);
      expect(quarantineRows[0].reason).toBe("sin_nombre_real_y_email_invalido");
      expect(leadsRows).toHaveLength(0);
    });

    it("allows valid lead through to sales_leads with HTTP 201", async () => {
      const { app, db, quarantineRows, leadsRows } = mockWebhookApp();
      const res = await app.fetch(
        new Request("http://localhost/webhooks/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: "lead_valid_04",
            email: "contacto@fiscalmaya.mx",
            despacho_nombre: "Despacho Maya y Asociados",
          }),
        }),
        { DB: db, ENVIRONMENT: "test" } as any,
      );

      expect(res.status).toBe(201);
      expect(quarantineRows).toHaveLength(0); // Never quarantined
    });
  });
});
