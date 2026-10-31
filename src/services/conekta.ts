import { D1Database } from "@cloudflare/workers-types";
import { Env, LeadIngestPayload, SalesPaymentOrder } from "../types";

export interface CreateOrderParams {
  leadId?: string;
  accountId?: string;
  opportunityId?: string;
  contactId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  amountCents: number;
  productName: string;
  currency?: string;
  method: "spei" | "checkout";
  expiresInHours?: number;
}

export interface ConektaOrderResult {
  success: boolean;
  orderId: string;
  internalPaymentId: string;
  paymentMethodType: "spei" | "checkout";
  status: "pending" | "paid" | "failed";
  amountCents: number;
  currency: string;
  speiClabe?: string;
  speiBank?: string;
  checkoutUrl?: string;
  checkoutId?: string;
  rawResponse?: any;
  error?: string;
  simulated?: boolean;
}

export class ConektaService {
  constructor(private env: Env) {}

  /**
   * Crea una orden de pago institucional en Conekta (SPEI STP o Hosted Checkout Link).
   * Modo simulado seguro si CONEKTA_API_KEY no está provista.
   */
  async createPaymentOrder(params: CreateOrderParams): Promise<ConektaOrderResult> {
    const currency = params.currency || "MXN";
    const internalPaymentId = `pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const expiresInHours = params.expiresInHours || 72;
    const expiresAtUnix = Math.floor(Date.now() / 1000) + expiresInHours * 3600;

    let conektaOrderId = "";
    let speiClabe: string | undefined;
    let speiBank: string | undefined;
    let checkoutUrl: string | undefined;
    let checkoutId: string | undefined;
    let rawResponse: any = null;
    let isSimulated = false;

    if (this.env.CONEKTA_API_KEY) {
      try {
        const bodyPayload: any = {
          currency,
          customer_info: {
            name: params.customerName || "Cliente ARK",
            email: params.customerEmail || "cliente@ejemplo.com",
            phone: params.customerPhone || "+525500000000",
          },
          line_items: [
            {
              name: params.productName,
              unit_price: params.amountCents,
              quantity: 1,
            },
          ],
          metadata: {
            internal_payment_id: internalPaymentId,
            lead_id: params.leadId || "",
            account_id: params.accountId || "",
            opportunity_id: params.opportunityId || "",
            contact_id: params.contactId || "",
          },
        };

        if (params.method === "spei") {
          bodyPayload.charges = [
            {
              payment_method: {
                type: "spei",
                expires_at: expiresAtUnix,
              },
            },
          ];
        } else {
          bodyPayload.checkout = {
            allowed_payment_methods: ["card", "spei"],
            type: "HostedPayment",
            success_url: `${this.env.SALES_API_URL || "https://sales.arksystems.site"}/crm`,
            failure_url: `${this.env.SALES_API_URL || "https://sales.arksystems.site"}/crm`,
            monthly_installments_enabled: false,
            expires_at: expiresAtUnix,
          };
        }

        const res = await fetch("https://api.conekta.io/orders", {
          method: "POST",
          headers: {
            "Accept": "application/vnd.conekta-v2.0.0+json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.env.CONEKTA_API_KEY}`,
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[ConektaService] Error API Conekta (${res.status}):`, errText);
          throw new Error(`Conekta API respondió con status ${res.status}: ${errText}`);
        }

        rawResponse = await res.json();
        conektaOrderId = rawResponse.id;

        if (params.method === "spei") {
          const charge = rawResponse.charges?.data?.[0];
          speiClabe = charge?.payment_method?.clabe;
          speiBank = charge?.payment_method?.bank || "STP";
        } else {
          checkoutUrl = rawResponse.checkout?.url;
          checkoutId = rawResponse.checkout?.id;
        }
      } catch (err: any) {
        console.error("[ConektaService] Excepción al llamar Conekta API:", err);
        return {
          success: false,
          orderId: "",
          internalPaymentId,
          paymentMethodType: params.method,
          status: "failed",
          amountCents: params.amountCents,
          currency,
          error: err.message || "Error al conectar con Conekta",
        };
      }
    } else {
      // Modo simulado seguro para testing/dev
      isSimulated = true;
      conektaOrderId = `ord_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      if (params.method === "spei") {
        // STP 646 + 12 dígitos pseudo-aleatorios (18 dígitos)
        const random12 = Math.floor(100000000000 + Math.random() * 900000000000).toString();
        speiClabe = `646180${random12}`;
        speiBank = "STP";
      } else {
        checkoutId = `chk_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        checkoutUrl = `https://pay.conekta.com/checkout/${checkoutId}`;
      }
      rawResponse = {
        id: conektaOrderId,
        simulated: true,
        charges: speiClabe ? { data: [{ payment_method: { type: "spei", clabe: speiClabe, bank: speiBank } }] } : undefined,
        checkout: checkoutUrl ? { id: checkoutId, url: checkoutUrl } : undefined,
      };
      console.log(`[ConektaService:Simulación] Orden ${conektaOrderId} creada (${params.method}). CLABE: ${speiClabe || "N/A"}`);
    }

    // Persistir en sales_payment_orders en D1
    if (this.env.DB) {
      try {
        await this.env.DB.prepare(`
          INSERT INTO sales_payment_orders (
            id, lead_id, account_id, opportunity_id, contact_id,
            conekta_order_id, amount_cents, currency, status,
            payment_method_type, spei_clabe, spei_bank,
            checkout_url, checkout_id, raw_response_json, metadata_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          internalPaymentId,
          params.leadId || null,
          params.accountId || null,
          params.opportunityId || null,
          params.contactId || null,
          conektaOrderId,
          params.amountCents,
          currency,
          params.method,
          speiClabe || null,
          speiBank || null,
          checkoutUrl || null,
          checkoutId || null,
          JSON.stringify(rawResponse),
          JSON.stringify({
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            productName: params.productName,
            simulated: isSimulated,
          })
        ).run();

        // Registrar actividad en sales_activities si hay cuenta/lead/oportunidad
        const actId = `act_pay_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
        const contentDesc = params.method === "spei"
          ? `Orden Conekta SPEI emitida por $${(params.amountCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN. CLABE STP: ${speiClabe}`
          : `Orden Conekta Checkout emitida por $${(params.amountCents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN. Link: ${checkoutUrl}`;

        await this.env.DB.prepare(`
          INSERT INTO sales_activities (
            id, account_id, contact_id, opportunity_id, lead_id,
            type, author_user_id, content, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, 'note', 'system', ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          actId,
          params.accountId || null,
          params.contactId || null,
          params.opportunityId || null,
          params.leadId || null,
          contentDesc,
          JSON.stringify({ internalPaymentId, conektaOrderId, method: params.method })
        ).run().catch((e) => console.warn("[ConektaService] No se pudo registrar actividad de emisión:", e));

      } catch (dbErr) {
        console.error("[ConektaService] Error persistiendo orden en D1:", dbErr);
      }
    }

    return {
      success: true,
      orderId: conektaOrderId,
      internalPaymentId,
      paymentMethodType: params.method,
      status: "pending",
      amountCents: params.amountCents,
      currency,
      speiClabe,
      speiBank,
      checkoutUrl,
      checkoutId,
      rawResponse,
      simulated: isSimulated,
    };
  }

  /**
   * Procesa un webhook recibido de Conekta (generalmente order.paid o charge.paid).
   * Actualiza sales_payment_orders a 'paid', mueve sales_opportunities a 'ganado',
   * registra en sales_activities y encola LEAD_INGEST_V3 hacia los hermanos.
   */
  async processWebhookEvent(payload: any, signatureHeader?: string): Promise<{
    success: boolean;
    event?: string;
    orderId?: string;
    opportunityId?: string;
    error?: string;
  }> {
    if (!payload || !payload.type) {
      return { success: false, error: "Payload de webhook inválido: falta 'type'" };
    }

    const eventType: string = payload.type;
    console.log(`[ConektaWebhook] Procesando evento '${eventType}'...`);

    // Manejar eventos de pago exitoso
    if (eventType === "order.paid" || eventType === "charge.paid") {
      const orderData = eventType === "order.paid" ? payload.data?.object : payload.data?.object?.order;
      const conektaOrderId = orderData?.id || payload.data?.object?.order_id || payload.data?.object?.id;

      if (!conektaOrderId) {
        return { success: false, error: "No se encontró conektaOrderId en el evento" };
      }

      if (!this.env.DB) {
        return { success: true, event: eventType, orderId: conektaOrderId, error: "DB no disponible" };
      }

      // 1. Buscar la orden en sales_payment_orders
      const orderRow = await this.env.DB.prepare(
        "SELECT * FROM sales_payment_orders WHERE conekta_order_id = ? LIMIT 1"
      ).bind(conektaOrderId).first<SalesPaymentOrder>();

      if (!orderRow) {
        console.warn(`[ConektaWebhook] Orden ${conektaOrderId} no encontrada en sales_payment_orders.`);
        return { success: false, event: eventType, orderId: conektaOrderId, error: "Orden no encontrada en D1" };
      }

      // 2. Actualizar estado a 'paid'
      await this.env.DB.prepare(`
        UPDATE sales_payment_orders
        SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(orderRow.id).run();

      const leadId = orderRow.lead_id;
      let oppId = orderRow.opportunity_id;

      // 3. Si no tiene opportunity_id pero tiene lead_id, buscar la oportunidad asociada
      if (!oppId && leadId) {
        const oppRow = await this.env.DB.prepare(
          "SELECT id FROM sales_opportunities WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1"
        ).bind(leadId).first<{ id: string }>();
        if (oppRow) oppId = oppRow.id;
      }

      // 4. Mover la oportunidad a 'ganado'
      if (oppId) {
        await this.env.DB.prepare(`
          UPDATE sales_opportunities
          SET stage = 'ganado', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(oppId).run();
      }

      // 5. Mover el lead a 'cerrado' si existe
      if (leadId) {
        await this.env.DB.prepare(`
          UPDATE sales_leads
          SET estado = 'cerrado', score = 100, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(leadId).run();
      }

      // 6. Registrar en sales_activities
      const actId = `act_paid_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const montoFormateado = (orderRow.amount_cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2 });
      await this.env.DB.prepare(`
        INSERT INTO sales_activities (
          id, account_id, contact_id, opportunity_id, lead_id,
          type, author_user_id, content, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, 'stage_change', 'system', ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        actId,
        orderRow.account_id,
        orderRow.contact_id,
        oppId || null,
        leadId || null,
        `Pago confirmado vía Conekta (${orderRow.payment_method_type.toUpperCase()}) por $${montoFormateado} ${orderRow.currency}. Oportunidad avanzada a etapa 'ganado'.`,
        JSON.stringify({
          conekta_order_id: conektaOrderId,
          amount_cents: orderRow.amount_cents,
          currency: orderRow.currency,
          payment_method: orderRow.payment_method_type,
          spei_clabe: orderRow.spei_clabe,
        })
      ).run().catch((e) => console.warn("[ConektaWebhook] Error registrando actividad:", e));

      // 7. Encolar LEAD_INGEST_V3 federado si hay leadId
      if (leadId) {
        try {
          const leadData: any = await this.env.DB.prepare(
            "SELECT * FROM sales_leads WHERE id = ?"
          ).bind(leadId).first();

          if (leadData) {
            const ingestPayload: LeadIngestPayload = {
              version: 3,
              lead_id: leadId,
              email: leadData.email,
              source_worker: "ark-sales",
              destination: "bundle",
              vertical: "bundle",
              score: 100,
              conversation_summary: `Cierre exitoso con pago confirmado vía Conekta SPEI/Checkout ($${montoFormateado} MXN).`,
              account_context: {
                despacho_nombre: leadData.despacho_nombre || "Despacho Contable",
                tamano: leadData.tamano || "1-5",
                productos_interes: ["ledger", "angel", "commerce"],
                dolor_principal: leadData.dolor_detectado || "integral_general",
              },
            };

            // Outbox D1
            const outboxId = `outbox_${crypto.randomUUID()}`;
            await this.env.DB.prepare(`
              INSERT INTO sales_pending_ingest (id, lead_id, destination, payload_json, status, retries, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `).bind(outboxId, leadId, "bundle", JSON.stringify(ingestPayload)).run();

            // Cloudflare Queue
            if (this.env.SALES_INGEST_QUEUE) {
              await this.env.SALES_INGEST_QUEUE.send(ingestPayload).catch((qErr) =>
                console.warn("[ConektaWebhook] Error encolando en SALES_INGEST_QUEUE:", qErr)
              );
            }
          }
        } catch (federationErr) {
          console.error("[ConektaWebhook] Error en entrega federada post-pago:", federationErr);
        }
      }

      return {
        success: true,
        event: eventType,
        orderId: conektaOrderId,
        opportunityId: oppId || undefined,
      };
    }

    return {
      success: true,
      event: eventType,
    };
  }
}
