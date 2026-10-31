import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";
import { interpolateTemplate } from "../src/routes/superadmin";

const JWT_SECRET = "superadmin-test-secret-key-123";

function createMockSuperAdminDb() {
  const templates: any[] = [
    {
      id: "tmpl_enterprise_proposal",
      tenant_id: null,
      name: "Propuesta Paquete Enterprise (Ark Angel + Ark Ledger)",
      slug: "propuesta_enterprise",
      category: "propuesta",
      subject: "Propuesta Formal ARK Systems: Paquete Enterprise para {{despacho_nombre}}",
      html_content: "<h1>Propuesta Enterprise</h1><p>Hola {{contacto_nombre}} de {{despacho_nombre}}, precio: {{precio_mxn}}</p>",
      variables_json: JSON.stringify(["despacho_nombre", "contacto_nombre", "precio_mxn"]),
      is_active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const dispatches: any[] = [];
  const voiceCampaigns: any[] = [];
  const voiceTargets: any[] = [];
  const accounts: any[] = [
    { id: "acc_1", name: "Despacho Morales", size: "6-20", city: "CDMX", origin: "lead", created_at: new Date().toISOString() },
    { id: "acc_2", name: "Inmobiliaria Riviera", size: "21-50", city: "Cancún", origin: "proptech", created_at: new Date().toISOString() },
  ];
  const contacts: any[] = [
    { id: "cnt_1", account_id: "acc_1", name: "Carlos Morales", email: "carlos@morales.com", phone: "+525512345678" },
    { id: "cnt_2", account_id: "acc_2", name: "Sofia Vega", email: "sofia@riviera.com", phone: "+529981234567" },
  ];
  const voiceSessions: any[] = [];

  return {
    _templates: templates,
    _dispatches: dispatches,
    _campaigns: voiceCampaigns,
    _targets: voiceTargets,
    _accounts: accounts,
    _contacts: contacts,
    _sessions: voiceSessions,

    prepare(sql: string) {
      const s = sql.toLowerCase();

      function exec(args: any[]) {
        return {
          async first() {
            if (s.includes("from email_templates where id = ? or slug = ?")) {
              const target = args[0];
              return templates.find((t) => t.id === target || t.slug === target) || null;
            }
            if (s.includes("from email_dispatches")) {
              return { total: dispatches.length, sent: dispatches.filter((d) => d.status === "sent" || d.status === "simulated").length, failed: 0 };
            }
            if (s.includes("from voice_campaigns where id = ?")) {
              return voiceCampaigns.find((c) => c.id === args[0]) || null;
            }
            return null;
          },
          async all() {
            if (s.includes("from email_templates")) {
              return { results: [...templates] };
            }
            if (s.includes("from email_dispatches")) {
              return { results: [...dispatches] };
            }
            if (s.includes("from voice_campaigns")) {
              return { results: [...voiceCampaigns] };
            }
            if (s.includes("from voice_campaign_targets")) {
              return { results: voiceTargets.filter((t) => !args[0] || t.campaign_id === args[0]) };
            }
            if (s.includes("from sales_contacts c")) {
              return {
                results: contacts.map((c) => ({
                  contact_id: c.id,
                  account_id: c.account_id,
                  name: c.name,
                  phone: c.phone,
                  despacho_nombre: accounts.find((a) => a.id === c.account_id)?.name || c.name,
                })),
              };
            }
            if (s.includes("from sales_voice_sessions")) {
              return { results: [...voiceSessions] };
            }
            if (s.includes("from sales_accounts a")) {
              return {
                results: accounts.map((a) => ({
                  ...a,
                  total_contacts: contacts.filter((c) => c.account_id === a.id).length,
                  total_opportunities: 1,
                  total_emails_sent: dispatches.filter((d) => d.account_id === a.id).length,
                  total_voice_sessions: 0,
                })),
              };
            }
            return { results: [] };
          },
          async run() {
            if (s.startsWith("insert into email_templates")) {
              templates.push({
                id: args[0],
                tenant_id: args[1],
                name: args[2],
                slug: args[3],
                category: args[4],
                subject: args[5],
                html_content: args[6],
                variables_json: args[7],
                is_active: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              return { success: true };
            }
            if (s.startsWith("update email_templates")) {
              const target = args[6];
              const item = templates.find((t) => t.id === target || t.slug === target);
              if (item) {
                if (args[0]) item.name = args[0];
                if (args[1]) item.subject = args[1];
                if (args[2]) item.html_content = args[2];
              }
              return { success: true };
            }
            if (s.includes("into email_dispatches")) {
              dispatches.push({
                id: args[0],
                recipient_email: args[1],
                recipient_name: args[2],
                subject: args[3],
                status: args[4] || "sent",
                resend_id: args[5],
                created_at: new Date().toISOString(),
              });
              return { success: true };
            }
            if (s.includes("into voice_campaigns")) {
              voiceCampaigns.push({
                id: args[0],
                tenant_id: args[1],
                name: args[2],
                description: args[3],
                dolor_principal: args[4],
                assistant_id: args[5],
                status: "draft",
                created_by_user_id: args[6],
                total_targets: 0,
                completed_calls: 0,
                failed_calls: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              return { success: true };
            }
            if (s.includes("into voice_campaign_targets")) {
              voiceTargets.push({
                id: args[0],
                campaign_id: args[1],
                tenant_id: args[2],
                account_id: args[3],
                contact_id: args[4],
                despacho_nombre: args[5],
                to_phone: args[6],
                status: "pending",
                created_at: new Date().toISOString(),
              });
              return { success: true };
            }
            if (s.includes("update voice_campaigns set total_targets")) {
              const cId = args[0];
              const camp = voiceCampaigns.find((c) => c.id === cId);
              if (camp) {
                camp.total_targets = voiceTargets.filter((t) => t.campaign_id === cId).length;
              }
              return { success: true };
            }
            if (s.includes("update voice_campaigns set status = 'running'")) {
              const cId = args[0];
              const camp = voiceCampaigns.find((c) => c.id === cId);
              if (camp) camp.status = "running";
              return { success: true };
            }
            if (s.includes("update voice_campaign_targets set status = ?")) {
              const targetId = args[3];
              const tar = voiceTargets.find((t) => t.id === targetId);
              if (tar) {
                tar.status = args[0];
                tar.call_control_id = args[1];
              }
              return { success: true };
            }
            if (s.includes("update voice_campaigns set completed_calls")) {
              const cId = args[2];
              const camp = voiceCampaigns.find((c) => c.id === cId);
              if (camp) {
                camp.completed_calls += args[0];
                camp.failed_calls += args[1];
                camp.status = "completed";
              }
              return { success: true };
            }
            return { success: true };
          },
        };
      }

      return {
        bind(...args: any[]) {
          return exec(args);
        },
        ...exec([]),
      };
    },
  } as any;
}

describe("Panel Super Admin (Resend Templates & Telnyx Voice Campaigns)", () => {
  let env: any;
  let adminToken: string;
  let sellerToken: string;

  beforeEach(async () => {
    env = {
      DB: createMockSuperAdminDb(),
      AI: null,
      SALES_INGEST_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
      SALES_AGENT: {},
      ENVIRONMENT: "development",
      CRM_JWT_SECRET: JWT_SECRET,
      RESEND_API_KEY: "", // Modo simulado por defecto
      RESEND_FROM_EMAIL: "ventas@arksystems.site",
      TELNYX_API_KEY: "", // Modo simulado por defecto
      TELNYX_PHONE_NUMBER: "+525500000000",
    };

    adminToken = await signJwt({ sub: "usr_admin", email: "admin@arksystems.site", role: "admin" }, JWT_SECRET);
    sellerToken = await signJwt({ sub: "usr_seller", email: "seller@arksystems.site", role: "vendedor" }, JWT_SECRET);
  });

  describe("Seguridad y Control de Acceso RBAC", () => {
    it("debe rechazar solicitudes no autenticadas con 401", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/resend/status", { method: "GET" }),
        env
      );
      expect(res.status).toBe(401);
    });

    it("debe rechazar a usuarios con rol 'vendedor' con 403 Forbidden", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/resend/status", {
          method: "GET",
          headers: { Authorization: `Bearer ${sellerToken}` },
        }),
        env
      );
      expect(res.status).toBe(403);
    });

    it("debe permitir acceso a usuarios con rol 'admin'", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/resend/status", {
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        env
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.from_email).toBe("ventas@arksystems.site");
    });
  });

  describe("Control de Resend & Plantillas HTML", () => {
    it("helper interpolateTemplate reemplaza correctamente las variables {{variable}}", () => {
      const template = "Hola {{contacto_nombre}} de {{despacho_nombre}}, inversión {{precio_mxn}}.";
      const interpolated = interpolateTemplate(template, {
        contacto_nombre: "Lic. Vega",
        despacho_nombre: "Despacho Contable CDMX",
        precio_mxn: "$8,000 MXN",
      });
      expect(interpolated).toBe("Hola Lic. Vega de Despacho Contable CDMX, inversión $8,000 MXN.");
    });

    it("permite listar plantillas pre-diseñadas", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/templates", {
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        env
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.templates[0].slug).toBe("propuesta_enterprise");
    });

    it("permite generar preview dinámico de plantilla con variables inyectadas", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/templates/propuesta_enterprise/preview", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            variables: {
              despacho_nombre: "Auditores del Norte S.C.",
              contacto_nombre: "Lic. Roberto Garza",
              precio_mxn: "$12,000 MXN/mes",
            },
          }),
        }),
        env
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.html).toContain("Lic. Roberto Garza");
      expect(data.html).toContain("Auditores del Norte S.C.");
      expect(data.html).toContain("$12,000 MXN/mes");
    });

    it("permite enviar correo de prueba en modo simulado registrando en email_dispatches", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/resend/test", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ to: "socio@despacho.com" }),
        }),
        env
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.simulated).toBe(true);
      expect(env.DB._dispatches.length).toBe(1);
      expect(env.DB._dispatches[0].recipient_email).toBe("socio@despacho.com");
    });

    it("permite despachar una plantilla a un destinatario específico", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/templates/propuesta_enterprise/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: "director@inmobiliaria.com",
            recipient_name: "Arq. Diana Ruiz",
            account_id: "acc_2",
            variables: {
              despacho_nombre: "Inmobiliaria Riviera",
              contacto_nombre: "Arq. Diana Ruiz",
              precio_mxn: "$10,000 MXN/mes",
            },
          }),
        }),
        env
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.recipient).toBe("director@inmobiliaria.com");
      expect(data.subject).toContain("Inmobiliaria Riviera");
    });
  });

  describe("Campañas de Voz AI Telnyx", () => {
    it("permite crear una campaña de voz multi-tenant o por despacho", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/voice/campaigns", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Outbound Cobranza Q4",
            dolor_principal: "cobranza_morosos",
            tenant_id: null, // omni-tenant
          }),
        }),
        env
      );
      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.success).toBe(true);
      expect(data.campaign.name).toBe("Outbound Cobranza Q4");
      expect(data.campaign.status).toBe("draft");
    });

    it("permite auto-poblar targets y disparar la campaña de voz AI", async () => {
      // 1. Crear campaña
      const campRes = await app.fetch(
        new Request("http://localhost/api/superadmin/voice/campaigns", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "Campaña Fiscal Automatizada",
            dolor_principal: "sat_fiscal_calculo",
          }),
        }),
        env
      );
      const campData: any = await campRes.json();
      const campaignId = campData.campaign.id;

      // 2. Auto-poblar targets desde los contactos de los tenants
      const targetsRes = await app.fetch(
        new Request(`http://localhost/api/superadmin/voice/campaigns/${campaignId}/targets`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ auto_populate_tenant_id: "all" }),
        }),
        env
      );
      const targetsData: any = await targetsRes.json();
      expect(targetsData.success).toBe(true);
      expect(targetsData.targets_added).toBe(2);

      // 3. Disparar la campaña
      const dispatchRes = await app.fetch(
        new Request(`http://localhost/api/superadmin/voice/campaigns/${campaignId}/dispatch`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }),
        env
      );
      expect(dispatchRes.status).toBe(200);
      const dispatchData: any = await dispatchRes.json();
      expect(dispatchData.success).toBe(true);
      expect(dispatchData.total_dispatched).toBe(2);
      expect(dispatchData.initiated).toBe(2);
      expect(dispatchData.failed).toBe(0);
      expect(dispatchData.execution_logs[0].phone).toBe("+525512345678");
    });
  });

  describe("Visión Consolidada Multi-Tenant & Frontend HTML", () => {
    it("debe devolver métricas agregadas por despacho/tenant", async () => {
      const res = await app.fetch(
        new Request("http://localhost/api/superadmin/tenants/overview", {
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        env
      );
      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.count).toBe(2);
      expect(data.tenants[0].name).toBe("Despacho Morales");
      expect(data.tenants[0].total_contacts).toBe(1);
    });

    it("el endpoint GET /superadmin debe entregar la interfaz HTML para usuarios autorizados", async () => {
      const res = await app.fetch(
        new Request("http://localhost/superadmin", {
          method: "GET",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        env
      );
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("ARK <span class=\"text-blue-400\">SUPER ADMIN</span>");
      expect(html).toContain("Resend & Plantillas HTML");
      expect(html).toContain("Campañas de Voz AI Telnyx");
      expect(html).toContain("Vista Multi-Tenant");
    });
  });
});
