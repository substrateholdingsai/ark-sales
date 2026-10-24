import { Env, LeadIngestPayload } from "../types";

export class QueueConsumer {
  constructor(private env: Env) {}

  /**
   * Consumidor de SALES_INGEST_QUEUE.
   * Procesa en lotes y realiza POST /api/internal/leads/ingest al hermano destino.
   */
  async processBatch(batch: MessageBatch<LeadIngestPayload>): Promise<void> {
    for (const message of batch.messages) {
      const payload = message.body;

      try {
        const result = await this.deliverLead(payload);

        if (result.success) {
          // Marcar como entregado en la tabla de Outbox sales_pending_ingest
          await this.markOutboxStatus(payload.lead_id, "delivered", null);
          message.ack();
        } else {
          console.warn(`[QueueConsumer] Entrega fallida para lead ${payload.lead_id} a ${payload.destination}: ${result.error}`);
          await this.markOutboxStatus(payload.lead_id, "pending", result.error || null);
          message.retry();
        }
      } catch (err: any) {
        console.error(`[QueueConsumer] Excepción procesando mensaje ${message.id}:`, err);
        await this.markOutboxStatus(payload.lead_id, "pending", err.message || "QUEUE_DELIVERY_EXCEPTION");
        message.retry();
      }
    }
  }

  /**
   * Realiza la llamada HTTP al endpoint interno del hermano destino.
   */
  async deliverLead(payload: LeadIngestPayload): Promise<{ success: boolean; error?: string; status?: number }> {
    const destinationUrl = this.resolveDestinationUrl(payload.destination);

    if (!destinationUrl) {
      return { success: false, error: `URL no configurada para el destino: ${payload.destination}` };
    }

    const endpoint = `${destinationUrl}/api/internal/leads/ingest`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ark-Source": "ark-sales",
          "X-Ark-Contract": "LEAD_INGEST_V3",
          "X-Idempotency-Key": payload.lead_id,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return { success: true, status: response.status };
      }

      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network/Fetch error: ${err.message}`,
      };
    }
  }

  private resolveDestinationUrl(destination: "ledger" | "angel" | "commerce" | "bundle"): string | null {
    switch (destination) {
      case "ledger":
        return this.env.LEDGER_API_URL || "https://ledger.arksystems.site";
      case "angel":
        return this.env.ANGEL_API_URL || "https://angel.arksystems.site";
      case "commerce":
        return this.env.COMMERCE_API_URL || "https://tiendas.arksystems.site";
      case "bundle":
        // El bundle notifica primariamente a ledger para provisión contable o angel para onboarding legal
        return this.env.LEDGER_API_URL || "https://ledger.arksystems.site";
      default:
        return null;
    }
  }

  private async markOutboxStatus(leadId: string, status: "delivered" | "failed" | "pending", error: string | null) {
    if (!this.env.DB) return;
    try {
      await this.env.DB.prepare(`
        UPDATE sales_pending_ingest
        SET status = ?,
            retries = retries + 1,
            last_error = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE lead_id = ?
      `).bind(status, error, leadId).run();
    } catch (dbErr) {
      console.error("[QueueConsumer] Error actualizando outbox en D1:", dbErr);
    }
  }
}
