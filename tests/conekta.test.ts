import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";
import { ConektaService } from "../src/services/conekta";
import { ToolExecutor } from "../src/tools/index";
import { signJwt } from "../src/auth/jwt";

const JWT_SECRET = "conekta-test-jwt-secret-xyz";

function createMockConektaDb() {
  const paymentOrders: any[] = [];
  const opportunities: any[] = [
    {
      id: "opp_test_101",
      lead_id: "lead_test_101",
      account_id: "acc_test_101",
      stage: "propuesta_enviada",
      estimated_value: 10000,
      currency: "MXN",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  const leads: any[] = [
    {
      id: "lead_test_101",
      email: "director@moralescontadores.com",
      despacho_nombre: "Despacho Contable Morales",
      tamano: "6-20",
      dolor_detectado: "integral_general",
      estado: "calificado",
      score: 85,
      account_id: "acc_test_101",
      contact_id: "cnt_test_101",
    },
  ];
  const activities: any[] = [];
  const pendingIngests: any[] = [];
  const accounts: any[] = [
    { id: "acc_test_101", name: "Despacho Contable Morales", size: "6-20", city: "CDMX" },
  ];
  const catalog: any[] = [
    {
      id: "cfg_bundle",
      product_key: "bundle",
      name: "Paquete Enterprise ARK (Ark Angel + Ark Ledger)",
      price_mxn: 10000,
      status: "active",
      features_json: JSON.stringify(["Ledger Fiscal", "Angel Voice"]),
    },
    {
      id: "cfg_ledger",
      product_key: "ledger",
      name: "Ark Ledger Core",
      price_mxn: 6000,
      status: "active",
      features_json: JSON.stringify(["SAT Direct"]),
    },
  ];

  return {
    _paymentOrders: paymentOrders,
    _opportunities: opportunities,
    _leads: leads,
    _activities: activities,
    _pendingIngests: pendingIngests,
    _accounts: accounts,
    _catalog: catalog,

    prepare(sql: string) {
      const s = sql.toLowerCase();

      function exec(args: any[]) {
        return {
          async first() {
            if (s.includes("from sales_payment_orders where conekta_order_id = ?")) {
              const id = args[0];
              return paymentOrders.find((p) => p.conekta_order_id === id) || null;
            }
            if (s.includes("from sales_payment_orders")) {
              const paid = paymentOrders.filter((p) => p.status === "paid");
              const pending = paymentOrders.filter((p) => p.status === "pending");
              const revenueCents = paid.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
              return {
                total: paymentOrders.length,
                paid: paid.length,
                pending: pending.length,
                revenue_cents: revenueCents,
              };
            }
            if (s.includes("from sales_opportunities where id = ? or lead_id = ?")) {
              const id = args[0];
              return opportunities.find((o) => o.id === id || o.lead_id === id) || null;
            }
            if (s.includes("from sales_opportunities where lead_id = ?")) {
              const leadId = args[0];
              return opportunities.find((o) => o.lead_id === leadId) || null;
            }
            if (s.includes("from sales_leads where id = ?")) {
              const leadId = args[0];
              return leads.find((l) => l.id === leadId) || null;
            }
            return null;
          },

          async all() {
            if (s.includes("from sales_config")) {
              return { results: [...catalog] };
            }
            if (s.includes("from sales_payment_orders")) {
              const enriched = paymentOrders.map((p) => {
                const acc = accounts.find((a) => a.id === p.account_id);
                const ld = leads.find((l) => l.id === p.lead_id);
                return {
                  ...p,
                  account_name: acc?.name,
                  lead_email: ld?.email,
                  lead_despacho: ld?.despacho_nombre,
                };
              });
              return { results: enriched };
            }
            return { results: [] };
          },

          async run() {
            if (s.includes("insert into sales_payment_orders")) {
              paymentOrders.push({
                id: args[0],
                lead_id: args[1],
                account_id: args[2],
                opportunity_id: args[3],
                contact_id: args[4],
                conekta_order_id: args[5],
                amount_cents: args[6],
                currency: args[7],
                status: "pending",
                payment_method_type: args[8],
                spei_clabe: args[9],
                spei_bank: args[10],
                checkout_url: args[11],
                checkout_id: args[12],
                raw_response_json: args[13],
                metadata_json: args[14],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              return { success: true };
            }

            if (s.includes("update sales_payment_orders") && s.includes("set status = 'paid'")) {
              const id = args[0];
              const order = paymentOrders.find((p) => p.id === id);
              if (order) {
                order.status = "paid";
                order.paid_at = new Date().toISOString();
                order.updated_at = new Date().toISOString();
              }
              return { success: true };
            }

            if (s.includes("update sales_opportunities") && s.includes("set stage = 'ganado'")) {
              const oppId = args[0];
              const opp = opportunities.find((o) => o.id === oppId);
              if (opp) {
                opp.stage = "ganado";
                opp.updated_at = new Date().toISOString();
              }
              return { success: true };
            }

            if (s.includes("update sales_leads") && s.includes("set estado = 'cerrado'")) {
              const leadId = args[0];
              const lead = leads.find((l) => l.id === leadId);
              if (lead) {
                lead.estado = "cerrado";
                lead.score = 100;
              }
              return { success: true };
            }

            if (s.includes("insert into sales_activities")) {
              activities.push({
                id: args[0],
                account_id: args[1],
                contact_id: args[2],
                opportunity_id: args[3],
                lead_id: args[4],
                type: args[5],
                author_user_id: args[6],
                content: args[7],
                metadata: args[8],
                created_at: new Date().toISOString(),
              });
              return { success: true };
            }

            if (s.includes("insert into sales_pending_ingest")) {
              pendingIngests.push({
                id: args[0],
                lead_id: args[1],
                destination: args[2],
                payload_json: args[3],
                status: "pending",
              });
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
        first() {
          return exec([]).first();
        },
        all() {
          return exec([]).all();
        },
        run() {
          return exec([]).run();
        },
      };
    },
  };
}

describe("Conekta SPEI STP & Hosted Checkout Suite", () => {
  let mockDb: any;
  let mockQueue: any;
  let mockEnv: any;

  beforeEach(() => {
    mockDb = createMockConektaDb();
    mockQueue = { send: vi.fn().mockResolvedValue(undefined) };
    mockEnv = {
      DB: mockDb,
      CRM_JWT_SECRET: JWT_SECRET,
      SALES_INGEST_QUEUE: mockQueue,
      SALES_API_URL: "https://sales.arksystems.site",
    };
  });

  describe("ConektaService (Simulated Mode)", () => {
    it("debe generar una orden SPEI con CLABE STP de 18 dígitos que empiece con 646", async () => {
      const service = new ConektaService(mockEnv);
      const res = await service.createPaymentOrder({
        leadId: "lead_test_101",
        customerName: "Despacho Morales",
        customerEmail: "director@morales.com",
        amountCents: 1000000,
        productName: "Paquete Enterprise ARK",
        method: "spei",
      });

      expect(res.success).toBe(true);
      expect(res.paymentMethodType).toBe("spei");
      expect(res.status).toBe("pending");
      expect(res.speiClabe).toBeDefined();
      expect(res.speiClabe?.length).toBe(18);
      expect(res.speiClabe?.startsWith("646180")).toBe(true);
      expect(res.speiBank).toBe("STP");
      expect(res.simulated).toBe(true);

      // Debe guardarse en D1
      expect(mockDb._paymentOrders.length).toBe(1);
      expect(mockDb._paymentOrders[0].conekta_order_id).toBe(res.orderId);
      expect(mockDb._paymentOrders[0].spei_clabe).toBe(res.speiClabe);
    });

    it("debe generar una orden hosted checkout link cuando method es checkout", async () => {
      const service = new ConektaService(mockEnv);
      const res = await service.createPaymentOrder({
        leadId: "lead_test_101",
        customerName: "Despacho Morales",
        customerEmail: "director@morales.com",
        amountCents: 600000,
        productName: "Ark Ledger Core",
        method: "checkout",
      });

      expect(res.success).toBe(true);
      expect(res.paymentMethodType).toBe("checkout");
      expect(res.checkoutUrl).toBeDefined();
      expect(res.checkoutUrl).toContain("https://pay.conekta.com/checkout/");
      expect(mockDb._paymentOrders.length).toBe(1);
      expect(mockDb._paymentOrders[0].checkout_url).toBe(res.checkoutUrl);
    });
  });

  describe("Tool Calling: generar_orden_pago", () => {
    it("el agente Llama 3.3 debe invocar generar_orden_pago con bundle y recibir instrucciones SPEI", async () => {
      const toolExecutor = new ToolExecutor(mockEnv);
      const res = await toolExecutor.execute(
        "generar_orden_pago",
        {
          lead_id: "lead_test_101",
          bundle: true,
          metodo: "spei",
        },
        { lead_id: "lead_test_101", leadEmail: "director@morales.com", despachoNombre: "Despacho Morales" }
      );

      expect(res.status).toBe("success");
      expect(res.metodo).toBe("spei");
      expect(res.monto_mxn).toBe(10000); // Precio del catálogo D1
      expect(res.spei_clabe).toBeDefined();
      expect(res.spei_clabe.length).toBe(18);
      expect(res.spei_banco).toBe("STP");
      expect(res.beneficiario).toBe("ARK Systems Technologies");
      expect(res.instrucciones).toContain(res.spei_clabe);
      expect(res.instrucciones).toContain("STP");
    });

    it("debe generar orden checkout cuando el método solicitado es checkout", async () => {
      const toolExecutor = new ToolExecutor(mockEnv);
      const res = await toolExecutor.execute(
        "generar_orden_pago",
        {
          lead_id: "lead_test_101",
          bundle: false,
          producto_key: "ledger",
          metodo: "checkout",
        },
        { lead_id: "lead_test_101" }
      );

      expect(res.status).toBe("success");
      expect(res.metodo).toBe("checkout");
      expect(res.monto_mxn).toBe(6000); // Ark Ledger de catálogo
      expect(res.checkout_url).toBeDefined();
      expect(res.instrucciones).toContain(res.checkout_url);
    });
  });

  describe("Webhook Reconciliación (order.paid -> Ganado)", () => {
    it("al recibir evento order.paid de Conekta, debe marcar orden pagada, mover oportunidad a ganado y encolar LEAD_INGEST_V3", async () => {
      // 1. Crear la orden previa
      const service = new ConektaService(mockEnv);
      const created = await service.createPaymentOrder({
        leadId: "lead_test_101",
        opportunityId: "opp_test_101",
        customerName: "Despacho Morales",
        customerEmail: "director@morales.com",
        amountCents: 1000000,
        productName: "Paquete Enterprise ARK",
        method: "spei",
      });

      expect(mockDb._opportunities[0].stage).toBe("propuesta_enviada");
      expect(mockDb._leads[0].estado).toBe("calificado");

      // 2. Disparar webhook order.paid
      const webhookPayload = {
        type: "order.paid",
        id: "evt_conekta_test_999",
        data: {
          object: {
            id: created.orderId,
            payment_status: "paid",
            amount: 1000000,
            currency: "MXN",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      };

      const webhookRes = await service.processWebhookEvent(webhookPayload);
      expect(webhookRes.success).toBe(true);
      expect(webhookRes.orderId).toBe(created.orderId);

      // 3. Verificar que la orden en D1 pasó a 'paid'
      const updatedOrder = mockDb._paymentOrders.find((p: any) => p.conekta_order_id === created.orderId);
      expect(updatedOrder.status).toBe("paid");
      expect(updatedOrder.paid_at).toBeDefined();

      // 4. Verificar que la oportunidad avanzó a 'ganado'
      expect(mockDb._opportunities[0].stage).toBe("ganado");

      // 5. Verificar que el lead pasó a cerrado con 100 puntos
      expect(mockDb._leads[0].estado).toBe("cerrado");
      expect(mockDb._leads[0].score).toBe(100);

      // 6. Verificar entrega federada encolada
      expect(mockDb._pendingIngests.length).toBe(1);
      expect(mockDb._pendingIngests[0].destination).toBe("bundle");
      expect(mockQueue.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("Endpoints HTTP Super Admin Billing", () => {
    let adminToken: string;

    beforeEach(async () => {
      adminToken = await signJwt(
        { sub: "usr_admin_1", email: "admin@arksystems.site", role: "admin", name: "Super Admin" },
        JWT_SECRET
      );
    });

    it("GET /api/superadmin/billing/status retorna resumen de métricas y modo seguro", async () => {
      const res = await app.request("/api/superadmin/billing/status", {
        headers: { Authorization: `Bearer ${adminToken}` },
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("simulated_mode");
      expect(json.has_api_key).toBe(false);
      expect(json.stats).toBeDefined();
    });

    it("POST /api/superadmin/billing/create-order genera orden manual desde consola", async () => {
      const res = await app.request("/api/superadmin/billing/create-order", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: "acc_test_101",
          customer_name: "Despacho Morales",
          customer_email: "director@morales.com",
          amount_mxn: 10000,
          product_name: "Paquete Enterprise ARK",
          method: "spei",
        }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.paymentMethodType).toBe("spei");
      expect(json.speiClabe).toBeDefined();
      expect(json.speiClabe.length).toBe(18);
    });

    it("POST /api/superadmin/billing/simulate-paid simula webhook y cambia oportunidad a ganado", async () => {
      // Crear orden primero
      const service = new ConektaService(mockEnv);
      const created = await service.createPaymentOrder({
        leadId: "lead_test_101",
        opportunityId: "opp_test_101",
        customerName: "Despacho Morales",
        customerEmail: "director@morales.com",
        amountCents: 1000000,
        productName: "Paquete Enterprise ARK",
        method: "spei",
      });

      const res = await app.request("/api/superadmin/billing/simulate-paid", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conekta_order_id: created.orderId,
        }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockDb._opportunities[0].stage).toBe("ganado");
    });

    it("POST /webhooks/conekta responde 200 al recibir webhook oficial", async () => {
      const res = await app.request("/webhooks/conekta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "charge.paid",
          data: {
            object: {
              id: "chg_123",
              order_id: "ord_non_existent",
              status: "paid",
            },
          },
        }),
      }, mockEnv);

      expect(res.status).toBe(200);
    });
  });
});
