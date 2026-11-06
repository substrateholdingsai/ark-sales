import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { internalRouter } from "../src/routes/internal";
import { authMiddleware } from "../src/auth/middleware";
import { Env } from "../src/types";

describe("Operador StayPuft: Suite de Herramientas de Correo (Resend) y Fail-Closed", () => {
  const STAYPUFT_TEST_KEY = "staypuft_secret_live_key_xyz123";
  const INTERNAL_SERVICE_KEY = "test-internal-key";

  const sampleTemplates = [
    {
      id: "tmpl_propuesta_01",
      name: "Propuesta Comercial Enterprise",
      slug: "propuesta_enterprise",
      category: "propuesta",
      subject: "Propuesta de Automatización para {{despacho_nombre}}",
      html_content: "<html><body><p>Hola {{contacto_nombre}}, adjuntamos la propuesta para {{despacho_nombre}}.</p></body></html>",
      variables_json: JSON.stringify(["despacho_nombre", "contacto_nombre"]),
      is_active: 1,
    },
    {
      id: "tmpl_onboarding_02",
      name: "Onboarding y Bienvenida",
      slug: "onboarding_bienvenida",
      category: "onboarding",
      subject: "Bienvenido a bordo de ARK Systems",
      html_content: "<html><body><p>Bienvenido {{contacto_nombre}} de {{despacho_nombre}}.</p></body></html>",
      variables_json: JSON.stringify(["contacto_nombre"]),
      is_active: 1,
    },
  ];

  const sampleLeads: Record<string, any> = {
    "lead_100": {
      id: "lead_100",
      email: "director@despachofiscal.mx",
      despacho_nombre: "Despacho Fiscal Pérez y Asociados",
      contacto_nombre: "Lic. Roberto Pérez",
    },
    "lead_no_email": {
      id: "lead_no_email",
      email: "",
      despacho_nombre: "Sin Correo SC",
    },
  };

  const createMockDb = (options: {
    leads?: Record<string, any>;
    templates?: any[];
    dispatches?: any[];
    activities?: any[];
  } = {}) => {
    const leads = options.leads || { ...sampleLeads };
    const templates = options.templates || [...sampleTemplates];
    const dispatches = options.dispatches || [];
    const activities = options.activities || [];

    return {
      prepare: vi.fn().mockImplementation((query: string) => {
        const createHandler = (args: any[] = []) => ({
          first: vi.fn().mockImplementation(async () => {
            // Count queries for rate limits
            if (query.includes("COUNT(*) as cnt FROM email_dispatches") && query.includes("-1 hour")) {
              const recent = dispatches.filter(d => d._hoursAgo !== undefined && d._hoursAgo < 1);
              return { cnt: recent.length };
            }
            if (query.includes("COUNT(*) as cnt FROM email_dispatches") && query.includes("-24 hours")) {
              return { cnt: dispatches.length };
            }
            if (query.includes("sales_leads") && query.includes("id = ?")) {
              const id = args[0];
              return leads[id] || null;
            }
            if (query.includes("sales_leads") && query.includes("email FROM sales_leads WHERE id = ?")) {
              const id = args[0];
              return leads[id] ? { email: leads[id].email } : null;
            }
            if (query.includes("email_templates") && (query.includes("id = ?") || query.includes("slug = ?"))) {
              const idOrSlug = args[0];
              const t = templates.find(item => (item.id === idOrSlug || item.slug === idOrSlug) && item.is_active === 1);
              return t || null;
            }
            if (query.includes("FROM email_dispatches") && query.includes("template_slug = ?") && query.includes("-24 hours")) {
              const email = args[0];
              const accId = args[1];
              const slug = args[2];
              const found = dispatches.find(d => (d.recipient_email === email || d.account_id === accId) && d.template_slug === slug);
              return found || null;
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (query.includes("FROM email_templates")) {
              return { results: templates.filter(t => t.is_active === 1) };
            }
            if (query.includes("FROM email_dispatches")) {
              const accountId = args[0];
              const email = args[1];
              const limit = typeof args[2] === "number" ? args[2] : 50;
              const filtered = dispatches.filter(d => d.account_id === accountId || d.recipient_email === email || d.recipient_email === accountId);
              return { results: filtered.slice(0, limit) };
            }
            return { results: [] };
          }),
          run: vi.fn().mockImplementation(async () => {
            if (query.includes("INSERT INTO email_dispatches")) {
              dispatches.push({
                id: args[0],
                account_id: args[2],
                template_slug: args[3],
                recipient_email: args[4],
                recipient_name: args[5],
                subject: args[6],
                variables_payload_json: args[7],
                status: args[8],
                resend_id: args[9],
              });
            }
            if (query.includes("INSERT INTO sales_activities")) {
              activities.push({
                id: args[0],
                account_id: args[1],
                author_user_id: args[2],
                content: args[3],
                metadata: args[4],
              });
            }
            return { success: true };
          }),
        });

        const handler = createHandler([]);
        return {
          ...handler,
          bind: vi.fn().mockImplementation((...boundArgs: any[]) => createHandler(boundArgs)),
        };
      }),
      _dispatches: dispatches,
      _activities: activities,
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
    RESEND_FROM_EMAIL: "ventas@mail.arksystems.site",
  });

  const createApp = (env: Env) => {
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      // Garantizar que c.env siempre esté disponible en el ciclo de middleware
      if (!c.env || Object.keys(c.env).length === 0) {
        (c as any).env = env;
      }
      await next();
    });
    app.use("*", authMiddleware());
    app.route("/api/internal", internalRouter);
    return {
      request: (path: string, init?: RequestInit) => app.request(path, init, env),
    };
  };

  describe("1. Autenticación y Autorización de StayPuft para Endpoints de Email", () => {
    it("debe rechazar llamadas sin clave con 401", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/templates", { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("debe rechazar llamadas con clave inválida con 401", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/templates", {
        method: "GET",
        headers: { "X-StayPuft-Key": "clave_falsa" },
      });
      expect(res.status).toBe(401);
    });

    it("debe aceptar clave STAYPUFT_API_KEY vía X-StayPuft-Key", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/templates", {
        method: "GET",
        headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
      });
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.count).toBe(2);
      expect(data.templates[0].slug).toBe("propuesta_enterprise");
    });

    it("debe aceptar clave STAYPUFT_API_KEY vía Authorization: Bearer", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/templates", {
        method: "GET",
        headers: { Authorization: `Bearer ${STAYPUFT_TEST_KEY}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("2. Catálogo de Plantillas y Previsualización Segura", () => {
    it("GET /api/internal/email/templates lista las plantillas activas con sus variables requeridas", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/templates", {
        method: "GET",
        headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.count).toBe(2);
      expect(body.templates[0].variables_requeridas).toEqual(["despacho_nombre", "contacto_nombre"]);
    });

    it("GET /api/internal/email/templates/:id/preview devuelve 404 para plantilla inexistente", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/templates/plantilla_inexistente/preview", {
        method: "GET",
        headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
      });
      expect(res.status).toBe(404);
    });

    it("GET /api/internal/email/templates/:id/preview previsualiza HTML con variables inyectadas", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request(
        "/api/internal/email/templates/propuesta_enterprise/preview?despacho_nombre=Corporativo%20Fiscal&contacto_nombre=Lic.%20Gomez",
        {
          method: "GET",
          headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
        }
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.subject).toContain("Corporativo Fiscal");
      expect(body.html).toContain("Lic. Gomez");
      expect(body.html).toContain("Corporativo Fiscal");
      expect(body.gate_ok).toBe(true);
    });
  });

  describe("3. Estado de Resend y Envío de Pruebas Restringido", () => {
    it("GET /api/internal/email/status devuelve estado sin exponer API key", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/status", {
        method: "GET",
        headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.from_email).toBe("ventas@mail.arksystems.site");
      expect(body.limits.hourly).toBe(20);
      expect(body.limits.daily).toBe(100);
      expect(body.RESEND_API_KEY).toBeUndefined();
    });

    it("POST /api/internal/email/test rechaza destinatarios arbitrarios no autorizados con 403", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/test", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: "hacker@externo.com" }),
      });
      expect(res.status).toBe(403);
      const body: any = await res.json();
      expect(body.error).toContain("Forbidden");
    });

    it("POST /api/internal/email/test permite envío a destinatario autorizado (pablo@arksystems.site)", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/test", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: "pablo@arksystems.site" }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.recipient).toBe("pablo@arksystems.site");
    });
  });

  describe("4. Reglas Fail-Closed en POST /api/internal/email/send", () => {
    it("falla con 404 si lead_id no existe en D1", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_inexistente_999",
          template_id: "propuesta_enterprise",
          variables: { despacho_nombre: "Test", contacto_nombre: "Juan" },
        }),
      });
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.error).toContain("Lead con ID 'lead_inexistente_999' no encontrado");
    });

    it("falla con 404 si template_id no existe o está inactiva", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "plantilla_fantasma",
          variables: { despacho_nombre: "Test", contacto_nombre: "Juan" },
        }),
      });
      expect(res.status).toBe(404);
      const body: any = await res.json();
      expect(body.error).toContain("Plantilla 'plantilla_fantasma' no existe o no está activa");
    });

    it("falla con 400 si falta una variable requerida por la plantilla", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "propuesta_enterprise",
          variables: { despacho_nombre: "Despacho Fiscal Pérez y Asociados" }, // Falta contacto_nombre
        }),
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toContain("contacto_nombre");
      expect(body.missing_variables).toContain("contacto_nombre");
    });

    it("falla con 400 si el correo destino en 'to' no coincide con el registrado para el lead", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "propuesta_enterprise",
          to: "otro_correo@desconocido.com", // Lead tiene director@despachofiscal.mx
          variables: { despacho_nombre: "Despacho", contacto_nombre: "Roberto" },
        }),
      });
      expect(res.status).toBe(400);
      const body: any = await res.json();
      expect(body.error).toContain("Prohibido enviar a un correo arbitrario");
    });

    it("deduplica con 200 y evita reenvío si la plantilla ya se envió a ese lead en las últimas 24h", async () => {
      const db = createMockDb({
        dispatches: [
          {
            id: "disp_prev_01",
            recipient_email: "director@despachofiscal.mx",
            account_id: "lead_100",
            template_slug: "propuesta_enterprise",
            status: "sent",
            created_at: "2026-11-06T10:00:00Z",
          },
        ],
      });
      const client = createApp(createMockEnv(db));
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "propuesta_enterprise",
          variables: { despacho_nombre: "Despacho", contacto_nombre: "Roberto" },
          dry_run: false,
        }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.deduplicated).toBe(true);
      expect(body.previous_dispatch.id).toBe("disp_prev_01");
    });

    it("falla con 429 si se superan los 20 envíos en la última hora (Rate limit StayPuft)", async () => {
      const db = createMockDb({
        dispatches: Array.from({ length: 20 }, (_, i) => ({
          id: `disp_${i}`,
          _hoursAgo: 0.5,
          recipient_email: `otro_${i}@mail.com`,
          template_slug: "onboarding_bienvenida",
          status: "sent",
        })),
      });
      const client = createApp(createMockEnv(db));
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "propuesta_enterprise",
          variables: { despacho_nombre: "Despacho", contacto_nombre: "Roberto" },
          dry_run: false,
        }),
      });
      expect(res.status).toBe(429);
      const body: any = await res.json();
      expect(body.error).toContain("Límite horario de StayPuft excedido");
    });

    it("dry_run: true valida e interpola pero NO llama a Resend ni registra dispatch", async () => {
      const db = createMockDb();
      const client = createApp(createMockEnv(db));
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "propuesta_enterprise",
          variables: { despacho_nombre: "Despacho Fiscal Pérez y Asociados", contacto_nombre: "Lic. Roberto Pérez" },
          dry_run: true,
        }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.dry_run).toBe(true);
      expect(body.recipient).toBe("director@despachofiscal.mx");
      expect(body.subject).toContain("Despacho Fiscal Pérez y Asociados");
      expect(body.html).toContain("Lic. Roberto Pérez");
      expect(db._dispatches.length).toBe(0);
    });

    it("dry_run: false ejecuta el envío real y registra en email_dispatches y sales_activities con autor staypuft", async () => {
      const db = createMockDb();
      const client = createApp(createMockEnv(db));
      const res = await client.request("/api/internal/email/send", {
        method: "POST",
        headers: {
          "X-StayPuft-Key": STAYPUFT_TEST_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: "lead_100",
          template_id: "propuesta_enterprise",
          variables: { despacho_nombre: "Despacho Fiscal Pérez y Asociados", contacto_nombre: "Lic. Roberto Pérez" },
          dry_run: false,
        }),
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.success).toBe(true);
      expect(body.dry_run).toBe(false);
      expect(body.recipient).toBe("director@despachofiscal.mx");
      expect(db._dispatches.length).toBe(1);
      expect(db._dispatches[0].recipient_email).toBe("director@despachofiscal.mx");
      expect(db._activities.length).toBeGreaterThanOrEqual(1);
      expect(db._activities[0].author_user_id).toBe("staypuft");
    });
  });

  describe("5. Historial Paginado en GET /api/internal/email/history", () => {
    it("falla con 400 si falta el parámetro query lead_id", async () => {
      const client = createApp(createMockEnv());
      const res = await client.request("/api/internal/email/history", {
        method: "GET",
        headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
      });
      expect(res.status).toBe(400);
    });

    it("devuelve los envíos del lead ordenados", async () => {
      const db = createMockDb({
        dispatches: [
          {
            id: "disp_h1",
            account_id: "lead_100",
            recipient_email: "director@despachofiscal.mx",
            template_slug: "propuesta_enterprise",
            subject: "Propuesta",
            status: "sent",
            created_at: "2026-11-06T12:00:00Z",
          },
        ],
      });
      const client = createApp(createMockEnv(db));
      const res = await client.request("/api/internal/email/history?lead_id=lead_100", {
        method: "GET",
        headers: { "X-StayPuft-Key": STAYPUFT_TEST_KEY },
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.lead_id).toBe("lead_100");
      expect(body.count).toBe(1);
      expect(body.dispatches[0].id).toBe("disp_h1");
    });
  });
});
