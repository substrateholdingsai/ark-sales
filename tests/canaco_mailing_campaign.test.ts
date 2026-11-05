import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";
import { signJwt } from "../src/auth/jwt";

const JWT_SECRET = "superadmin-test-secret-key-123";

function createMockDb() {
  const campaignConfig = {
    id: "camp_canaco_siem_1200",
    tenant_id: "canaco",
    name: "Campaña Oficial SIEM CANACO · 1,200 Socios",
    total_subscribers: 1200,
    daily_batch_limit: 100,
    cycle_days: 12,
    current_cycle: 1,
    current_day_in_cycle: 1,
    dispatched_total: 0,
    opened_total: 0,
    clicks_total: 0,
    conversions_siem_total: 0,
    conversions_pro_total: 0,
    dedicated_domain: "siem-canaco.com.mx",
    domain_cost_mxn: 299.00,
    domain_billing_status: "pendiente_refacturacion",
    from_email: "afiliacion@siem-canaco.com.mx",
    landing_base_url: "https://canacomerida.arksystems.site/registro-siem",
    status: "active",
  };

  const templates = [
    {
      id: "tmpl_canaco_siem_invitacion",
      tenant_id: "canaco",
      name: "CANACO · Invitación Exclusiva SIEM",
      slug: "canaco_siem_invitacion",
      category: "onboarding",
      subject: "CANACO: Beneficio Institucional SIEM para {{empresa_nombre}}",
      html_content: "<h1>Hola {{socio_nombre}}</h1><p>Tu link: <a href=\"{{registration_link}}\">Click</a></p>",
      variables_json: JSON.stringify(["empresa_nombre", "socio_nombre", "registration_link"]),
      is_active: 1,
    },
  ];

  const dispatches: any[] = [];
  const leads: any[] = [
    { id: "lead_1", email: "socio1@canaco.mx", conversation_summary: "[ALTA SIEM CANACO] Registro validado." },
  ];
  const opps: any[] = [
    { id: "opp_1", products_interest_json: '["ledger_pro"]', estimated_value: 399.00 },
  ];

  return {
    _config: campaignConfig,
    _templates: templates,
    _dispatches: dispatches,
    _leads: leads,
    _opps: opps,

    prepare(sql: string) {
      const s = sql.toLowerCase();

      function exec(args: any[]) {
        return {
          async first() {
            if (s.includes("from canaco_campaign_config")) {
              return campaignConfig;
            }
            if (s.includes("from email_templates")) {
              return templates[0];
            }
            if (s.includes("from sales_leads")) {
              return { cnt: leads.length };
            }
            if (s.includes("from sales_opportunities")) {
              return { cnt: opps.length };
            }
            if (s.includes("from email_dispatches")) {
              return { cnt: dispatches.length };
            }
            return null;
          },
          async all() {
            if (s.includes("from canaco_subscribers")) {
              return { results: [] };
            }
            return { results: [] };
          },
          async run() {
            if (s.includes("update canaco_campaign_config") && s.includes("domain_billing_status")) {
              campaignConfig.domain_billing_status = args[0];
              campaignConfig.domain_cost_mxn = args[1];
              campaignConfig.dedicated_domain = args[2];
            }
            if (s.includes("update canaco_campaign_config") && s.includes("dispatched_total")) {
              campaignConfig.dispatched_total += args[0];
              campaignConfig.current_day_in_cycle = args[1];
              campaignConfig.current_cycle = args[2];
            }
            if (s.includes("insert into email_dispatches")) {
              dispatches.push({ id: args[0], to: args[1] });
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
  };
}

describe("Campaña de Mailing CANACO (1,200 socios) · Resend Free Tier & Dominio", () => {
  let mockEnv: any;
  let adminToken: string;

  beforeEach(async () => {
    mockEnv = {
      DB: createMockDb(),
      CRM_JWT_SECRET: JWT_SECRET,
      RESEND_API_KEY: "",
      ENVIRONMENT: "development",
    };

    adminToken = await signJwt(
      { sub: "usr_superadmin", email: "admin@arksystems.site", role: "admin" },
      JWT_SECRET
    );
  });

  it("GET /api/superadmin/canaco/campaign debe reportar métricas de la campaña, ciclo de 12 días y dominio", async () => {
    const req = new Request("http://localhost/api/superadmin/canaco/campaign", {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.campaign.total_subscribers).toBe(1200);
    expect(json.campaign.daily_batch_limit).toBe(100);
    expect(json.campaign.cycle_days).toBe(12);
    expect(json.resend_tier.cost_usd).toBe(0.00);
    expect(json.resend_tier.daily_limit).toBe(100);
    expect(json.resend_tier.cadence_description).toContain("12 días");
    expect(json.dedicated_domain.domain).toBe("siem-canaco.com.mx");
    expect(json.dedicated_domain.cost_mxn).toBe(299.00);
    expect(json.dedicated_domain.billing_status).toBe("pendiente_refacturacion");
  });

  it("POST /api/superadmin/canaco/dispatch-batch debe despachar el lote diario de 100 correos y avanzar el ciclo", async () => {
    const req = new Request("http://localhost/api/superadmin/canaco/dispatch-batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ batch_size: 100 }),
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.batch_dispatched).toBe(100);
    expect(json.new_day_in_cycle).toBe(2);
    expect(mockEnv.DB._config.dispatched_total).toBe(100);
    expect(mockEnv.DB._dispatches.length).toBe(100);
  });

  it("POST /api/superadmin/canaco/domain/bill debe actualizar el estado de cobro del dominio a 'facturado'", async () => {
    const req = new Request("http://localhost/api/superadmin/canaco/domain/bill", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "facturado",
        domain: "siem-canaco.com.mx",
        amount_mxn: 299.00,
      }),
    });

    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.billing_status).toBe("facturado");
    expect(json.amount_mxn).toBe(299.00);
    expect(mockEnv.DB._config.domain_billing_status).toBe("facturado");
  });
});
