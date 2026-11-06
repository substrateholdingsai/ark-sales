import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { internalRouter } from "../src/routes/internal";
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

    it("StayPuft NO debe poder acceder a rutas destructivas o no autorizadas (403 Forbidden)", async () => {
      const app = createApp(createMockEnv());
      // Intentar una ruta interna no autorizada para StayPuft
      const res = await app.request(
        "/api/internal/leads/ingest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          },
          body: JSON.stringify({ email: "hacker@test.com" }),
        },
        createMockEnv()
      );

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.error).toContain("Forbidden");
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
    });
  });
});
