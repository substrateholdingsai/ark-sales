import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { internalRouter, normalizeMexicanPhone } from "../src/routes/internal";
import { superadminRouter } from "../src/routes/superadmin";
import { authMiddleware } from "../src/auth/middleware";
import { Env, AgentSkill } from "../src/types";

describe("Operador StayPuft: Suite de Integración, Seguridad y Observabilidad", () => {
  const STAYPUFT_TEST_KEY = "staypuft_secret_live_key_xyz123";
  const INTERNAL_SERVICE_KEY = "test-internal-key";

  const createMockDb = (leads: Record<string, any> = {}, tasks: any[] = [], runs: any[] = []) => {
    return {
      prepare: vi.fn().mockImplementation((query: string) => {
        const createResultHandler = (args: any[] = []) => ({
          first: vi.fn().mockImplementation(async () => {
            if (query.includes("sales_leads") && query.includes("id = ?")) {
              const id = args[0];
              return leads[id] || null;
            }
            if (query.includes("agent_tasks") && query.includes("status = 'pending'")) {
              const pending = tasks.find(t => t.status === "pending" && t.retry_count < 3);
              return pending || null;
            }
            if (query.includes("agent_tasks") && query.includes("lead_id = ?")) {
              const found = tasks.find(t => t.lead_id === args[0] && t.skill_name === args[1]);
              return found || null;
            }
            if (query.includes("sales_leads") && query.includes("ORDER BY created_at DESC")) {
              const unresearched = Object.values(leads).find(
                l => l.despacho_nombre && (!l.conversation_summary || !l.conversation_summary.includes("research"))
              );
              return unresearched || null;
            }
            if (query.includes("COUNT(*) as cnt FROM sales_accounts")) {
              return { cnt: 150 };
            }
            if (query.includes("COUNT(*) as cnt FROM sales_observations")) {
              return { cnt: 45 };
            }
            if (query.includes("COUNT(*) as cnt FROM agent_tasks WHERE status = 'pending'")) {
              return { cnt: tasks.filter(t => t.status === "pending").length };
            }
            if (query.includes("FROM harvest_runs ORDER BY started_at DESC LIMIT 1")) {
              return { run_id: "run_test_01", status: "completed", started_at: "2026-11-05 20:00:00" };
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes("FROM agent_skills WHERE is_active = 1")) {
              return {
                results: [
                  { id: "s1", operator: "staypuft", skill_name: "research_prospect_web" },
                  { id: "s2", operator: "staypuft", skill_name: "generate_custom_pdf" },
                  { id: "s3", operator: "staypuft", skill_name: "tag_prospect_on_x" },
                ],
              };
            }
            if (query.includes("agent_tasks")) {
              return { results: tasks };
            }
            if (query.includes("agent_skill_runs")) {
              return { results: runs };
            }
            if (query.includes("sales_cohorts")) {
              return { results: [{ cohort_id: "ch_01", name: "Despachos Fiscales", vertical: "fiscal" }] };
            }
            return { results: [] };
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        });

        const handler = createResultHandler([]);
        return {
          ...handler,
          bind: vi.fn().mockImplementation((...boundArgs: any[]) => createResultHandler(boundArgs)),
        };
      }),
    };
  };

  const createMockEnv = (db?: any): Env => ({
    DB: db || createMockDb(),
    AI: {},
    SALES_INGEST_QUEUE: { send: vi.fn() } as any,
    SALES_AGENT: {
      idFromName: vi.fn().mockReturnValue("stub_id"),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))),
      }),
    } as any,
    ENVIRONMENT: "production",
    INTERNAL_SERVICE_KEY: INTERNAL_SERVICE_KEY,
    STAYPUFT_API_KEY: STAYPUFT_TEST_KEY,
  });

  const createApp = (env: Env) => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", authMiddleware());
    app.route("/api/internal", internalRouter);
    app.route("/api/superadmin", superadminRouter);
    return app;
  };

  describe("1. Autenticación y Least-Privilege de StayPuft (Req 1)", () => {
    it("debe aceptar petición con clave correcta STAYPUFT_API_KEY", async () => {
      const app = createApp(createMockEnv());
      const res = await app.request(
        "/api/internal/skills",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        createMockEnv()
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.skills).toBeDefined();
    });

    it("debe rechazar petición con clave incorrecta (401 Unauthorized)", async () => {
      const app = createApp(createMockEnv());
      const res = await app.request(
        "/api/internal/skills",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": "clave_falsa_invalida" },
        },
        createMockEnv()
      );

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error).toContain("Unauthorized");
    });

    it("debe rechazar petición sin ninguna clave (401 Unauthorized)", async () => {
      const app = createApp(createMockEnv());
      const res = await app.request(
        "/api/internal/skills",
        { method: "GET" },
        createMockEnv()
      );

      expect(res.status).toBe(401);
    });

    it("StayPuft con Acceso Total debe poder acceder a endpoints internos del worker (200 OK)", async () => {
      const app = createApp(createMockEnv());
      // Acceso total: ingest y endpoints internos autorizados
      const res = await app.request(
        "/api/internal/leads/ingest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            email: "contacto@despacholeal.com",
            despacho_nombre: "Despacho Leal SC",
            tamano: "6-20",
          }),
        },
        createMockEnv()
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe("2. Tareas Pendientes (/api/internal/skills/pending) (Req 2)", () => {
    it("debe responder vacío ({}) con 200 OK cuando no hay nada pendiente (no error)", async () => {
      // Mock DB sin leads pendientes y sin tareas en cola
      const db = createMockDb({}, [], []);
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills/pending",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      // Debe responder vacío
      expect(Object.keys(data).length).toBe(0);
    });

    it("debe devolver siguiente tarea de agent_tasks con lead_id, skill, payload y created_at", async () => {
      const mockTasks = [
        {
          id: "task_1001",
          lead_id: "lead_fiscal_77",
          skill_name: "research_prospect_web",
          payload: JSON.stringify({ despacho_nombre: "García & Asociados SC", dominio: "garcia.mx" }),
          status: "pending",
          retry_count: 0,
          created_at: "2026-11-06T02:00:00Z",
        },
      ];
      const db = createMockDb({}, mockTasks, []);
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills/pending",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.lead_id).toBe("lead_fiscal_77");
      expect(data.skill).toBe("research_prospect_web");
      expect(data.payload.despacho_nombre).toBe("García & Asociados SC");
      expect(data.created_at).toBeDefined();
    });
  });

  describe("3. Reporte de Ejecución y Validación JSON Schema (/api/internal/skills/execute) (Req 2 y 3)", () => {
    it("debe rechazar execute con JSON Schema inválido para research_prospect_web (falta confianza y fuentes)", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            lead_id: "lead_test_123",
            skill: "research_prospect_web",
            status: "completed",
            result: {
              tamano_estimado: "6-20",
              // Faltan fuentes y confianza obligatorios
            },
          }),
        },
        env
      );

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain("Validación de JSON Schema fallida");
    });

    it("debe rechazar execute con JSON Schema inválido para generate_custom_pdf (falta sello SHA-256)", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            lead_id: "lead_test_123",
            skill: "generate_custom_pdf",
            status: "completed",
            result: {
              pdf_url_o_id: "https://ledger.arksystems.site/docs/reporte_123.pdf",
              calculo_resumen: { impuesto_determinado: 45000 },
              // Falta sello_sha256 y qr_payload
            },
          }),
        },
        env
      );

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toContain("sello_sha256");
    });

    it("debe aceptar execute válido y persistir resultado en base de datos", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            lead_id: "lead_test_123",
            skill: "research_prospect_web",
            status: "completed",
            result: {
              tamano_estimado: "6-20",
              socios: ["C.P. Mario Delgado", "Lic. Claudia Morales"],
              software_detectado: ["Aspel", "Contpaqi"],
              senales_dolor: ["Conciliación bancaria manual SAT"],
              fuentes: ["https://despachomario.com", "LinkedIn"],
              confianza: 95,
            },
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.saved).toBe(true);
      expect(data.status).toBe("completed");
    });

    it("circuit breaker: al 3er fallo consecutivo debe quedar en status 'failed' y no reintentar", async () => {
      const existingTask = {
        id: "task_reintentos_fail",
        lead_id: "lead_fail_33",
        skill_name: "research_prospect_web",
        retry_count: 2, // Ya falló 2 veces
        status: "running",
      };
      const db = createMockDb({}, [existingTask], []);
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills/execute",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            lead_id: "lead_fail_33",
            skill: "research_prospect_web",
            status: "failed",
            error: "Web del despacho no responde / Timeout 30s",
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.status).toBe("failed");
      expect(data.retry_count).toBe(3);
    });
  });

  describe("4. Ingesta de Enriquecimiento (/api/internal/leads/:lead_id/enrich) (Req 2)", () => {
    it("debe responder 404 Not Found si el lead no existe", async () => {
      const db = createMockDb({}); // sin leads
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/leads/lead_fantasma_404/enrich",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            tamano_estimado: "6-20",
            software_detectado: ["Aspel"],
            socios: ["C.P. Gomez"],
            confianza: 90,
            fuentes: ["LinkedIn"],
          }),
        },
        env
      );

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toContain("no encontrado");
    });

    it("debe enriquecer exitosamente un lead existente con el contrato StayPuft", async () => {
      const mockLead = {
        id: "lead_existente_01",
        email: "socio@despacholeal.com",
        despacho_nombre: "Despacho Leal SC",
        tamano: "1-5",
        score: 60,
        conversation_summary: "Interesado en cálculo fiscal.",
      };
      const db = createMockDb({ lead_existente_01: mockLead });
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/leads/lead_existente_01/enrich",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            tamano_estimado: "21-50",
            software_detectado: ["Contpaqi", "Excel"],
            socios: ["C.P. Laura Leal"],
            senales_dolor: ["Sobrecarga regulatoria SAT"],
            fuentes: ["Sitio oficial", "Google Maps"],
            confianza: 92,
            resumen: "Despacho con 35 contadores y alta carga tributaria.",
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.tamano_asignado).toBe("21-50");
      expect(data.score_actualizado).toBe(75);
      expect(data.operator).toBe("staypuft");
    });
  });

  describe("5. Protección de Cuota D1 y Paginación Máximo 100 (Req 4)", () => {
    it("debe limitar a 100 registros en /api/internal/skills aunque se solicite limit=500", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/skills?limit=500",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.limit).toBe(100);
    });

    it("Super Admin métricas de harvest (/api/superadmin/harvest/metrics) debe ser accesible con StayPuft key", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/superadmin/harvest/metrics",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.total_accounts).toBe(150);
      expect(data.agent_tasks).toBeDefined();
    });

    it("Alias interno de métricas (/api/internal/harvest/metrics) debe retornar observabilidad", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/harvest/metrics",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.total_accounts).toBe(150);
      expect(data.phone_coverage).toBeDefined();
    });
  });

  describe("6. Acceso Total y Enriquecimiento WhatsApp para StayPuft (Nov 2026)", () => {
    it("debe aceptar y normalizar teléfono y WhatsApp en POST /api/internal/leads/:lead_id/enrich", async () => {
      const mockLead = {
        id: "lead_wa_01",
        email: "fiscal@merida-contadores.mx",
        despacho_nombre: "Mérida Contadores SC",
        tamano: "1-5",
        estado: "nuevo",
        score: 40,
        account_id: "acc_wa_01",
      };
      const db = createMockDb({ lead_wa_01: mockLead });
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/leads/lead_wa_01/enrich",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            tamano_estimado: "6-20",
            telefono: "9991234567",
            whatsapp: "9991234567",
            whatsapp_valid: true,
            fuente_telefono: "website",
            telefono_url: "https://merida-contadores.mx/contacto",
            telefono_verificado: true,
            sin_whatsapp: false,
            confianza: 95,
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.telefono).toBe("+529991234567");
      expect(data.whatsapp).toBe("+529991234567");
      expect(data.whatsapp_valid).toBe(true);
    });

    it("debe retornar phone_coverage en /api/internal/harvest/metrics y /api/internal/metrics", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/metrics",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.phone_coverage).toBeDefined();
      expect(data.phone_coverage.cohorts.ark_ledger_despachos).toBeDefined();
      expect(data.phone_coverage.cohorts.futura_medicos_merida).toBeDefined();
    });

    it("GET /api/internal/leads permite consultar con filtro sin_whatsapp y cohort con cap 100", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/leads?cohort=ark_ledger_despachos&sin_whatsapp=true&limit=150",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.limit).toBe(100); // Enforced cap 100
      expect(data.total).toBeDefined();
      expect(Array.isArray(data.leads)).toBe(true);
    });

    it("normalizeMexicanPhone valida estrictamente 10 dígitos y rechaza números malformados", () => {
      // Casos válidos
      const val1 = normalizeMexicanPhone("9991234567");
      expect(val1).toEqual({
        telefono: "+529991234567",
        whatsapp: "+529991234567",
        whatsapp_valid: true,
        malformed: false,
      });

      const val2 = normalizeMexicanPhone("+52 999 123 4567");
      expect(val2).toEqual({
        telefono: "+529991234567",
        whatsapp: "+529991234567",
        whatsapp_valid: true,
        malformed: false,
      });

      const val3 = normalizeMexicanPhone("5219991234567");
      expect(val3).toEqual({
        telefono: "+529991234567",
        whatsapp: "+529991234567",
        whatsapp_valid: true,
        malformed: false,
      });

      // Casos malformados (12 a 15 dígitos concatenados con 01 legacy, números truncados)
      const mal1 = normalizeMexicanPhone("+222012223729222"); // 15 dígitos
      expect(mal1.malformed).toBe(true);
      expect(mal1.telefono).toBeNull();
      expect(mal1.whatsapp_valid).toBe(false);

      const mal2 = normalizeMexicanPhone("+81018183440404"); // 14 dígitos
      expect(mal2.malformed).toBe(true);
      expect(mal2.telefono).toBeNull();
      expect(mal2.whatsapp_valid).toBe(false);

      const mal3 = normalizeMexicanPhone("+555536839216"); // 12 dígitos pero no empieza con 52
      expect(mal3.malformed).toBe(true);
      expect(mal3.telefono).toBeNull();

      const mal4 = normalizeMexicanPhone("12345"); // Demasiado corto
      expect(mal4.malformed).toBe(true);

      const mal5 = normalizeMexicanPhone("0180012345"); // Inicia con 0
      expect(mal5.malformed).toBe(true);
    });

    it("GET /api/internal/leads/:lead_id resuelve cohorte real ark_ledger_despachos vs sipres_sofom", async () => {
      const mockLeadDespacho = {
        id: "lead_despacho_merida_01",
        account_id: "acc_despacho_01",
        phone: "+529991112233",
        score: 80,
      };
      const mockAccountDespacho = {
        id: "acc_despacho_01",
        name: "Despacho Fiscal Peninsular S.C.",
        scian_code: "541211",
        city: "Mérida, Yucatán",
      };

      const mockLeadSofom = {
        id: "lead_sipres_1844",
        account_id: "acc_sipres_1844",
        phone: "+222012223729222",
        score: 30,
      };
      const mockAccountSofom = {
        id: "acc_sipres_1844",
        name: "CrediPronto SOFOM E.N.R.",
        scian_code: "522210",
        city: "Puebla",
      };

      const db = {
        prepare: vi.fn().mockImplementation((query: string) => ({
          bind: vi.fn().mockImplementation((...params: any[]) => ({
            first: vi.fn().mockImplementation(async () => {
              if (query.includes("sales_leads WHERE id = ?")) {
                const id = params[0];
                if (id === "lead_despacho_merida_01") return mockLeadDespacho;
                if (id === "lead_sipres_1844") return mockLeadSofom;
              }
              if (query.includes("sales_accounts WHERE id = ?")) {
                const id = params[0];
                if (id === "acc_despacho_01") return mockAccountDespacho;
                if (id === "acc_sipres_1844") return mockAccountSofom;
              }
              return null;
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ success: true }),
          })),
        })),
      };

      const env = createMockEnv(db);
      const app = createApp(env);

      // 1. Probar despacho
      const resDespacho = await app.request(
        "/api/internal/leads/lead_despacho_merida_01",
        { headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY } },
        env
      );
      expect(resDespacho.status).toBe(200);
      const dataDespacho: any = await resDespacho.json();
      expect(dataDespacho.cohort).toBe("ark_ledger_despachos");
      expect(dataDespacho.lead.phone).toBe("+529991112233");
      expect(dataDespacho.lead.whatsapp_valid).toBe(true);

      // 2. Probar SOFOM SIPRES con teléfono malformado
      const resSofom = await app.request(
        "/api/internal/leads/lead_sipres_1844",
        { headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY } },
        env
      );
      expect(resSofom.status).toBe(200);
      const dataSofom: any = await resSofom.json();
      expect(dataSofom.cohort).toBe("sipres_sofom");
      expect(dataSofom.lead.phone).toBeNull(); // Rechazado por malformado
      expect(dataSofom.lead.whatsapp_valid).toBe(false);
      expect(dataSofom.lead.sin_whatsapp).toBe(true);
    });

    it("GET /api/internal/quarantine retorna registros de cuarentena", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/quarantine",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.quarantine)).toBe(true);
    });

    it("POST /api/internal/agent-tasks/enqueue permite encolar tarea individual", async () => {
      const env = createMockEnv();
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/agent-tasks/enqueue",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            lead_id: "lead_test_enqueue_01",
            skill_name: "research_prospect_web",
            operator: "staypuft",
            payload: { domain: "despacho-test.com" },
          }),
        },
        env
      );

      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.task_id).toBeDefined();
      expect(data.status).toBe("pending");
    });

    it("POST /api/internal/leads/:lead_id/draft-email prepara borrador sin enviar (gate seguro)", async () => {
      const mockLead = {
        id: "lead_draft_01",
        email: "director@despacho-yucatan.mx",
        despacho_nombre: "Despacho Yucatán SC",
      };
      const db = {
        ...createMockDb({ lead_draft_01: mockLead }),
        prepare: vi.fn().mockImplementation((q: string) => ({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockImplementation(async () => {
              if (q.includes("sales_leads")) return mockLead;
              if (q.includes("email_templates")) {
                return {
                  id: "ark_ledger_invitacion_oficial",
                  subject: "Alianza Estratégica con {{despacho_nombre}}",
                  html_content: "<p>Hola {{despacho_nombre}}</p>",
                };
              }
              return null;
            }),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        })),
      };
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/leads/lead_draft_01/draft-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            template_id: "ark_ledger_invitacion_oficial",
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.draft.subject).toContain("Despacho Yucatán SC");
      expect(data.draft.requires_approval).toBe(true);
    });

    it("POST /api/internal/voice/prepare-call prepara contexto sin realizar llamada", async () => {
      const mockLead = {
        id: "lead_voice_01",
        despacho_nombre: "Despacho Auditores Península",
        phone: "+529995551234",
        tamano: "6-20",
        dolor_detectado: "fiscal",
      };
      const db = createMockDb({ lead_voice_01: mockLead });
      const env = createMockEnv(db);
      const app = createApp(env);

      const res = await app.request(
        "/api/internal/voice/prepare-call",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({
            lead_id: "lead_voice_01",
          }),
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.prospect.phone).toBe("+529995551234");
      expect(data.requires_approval).toBe(true);
    });
  });
});
