import { Env, LeadIngestPayload, PendingIngestRecord } from "../types";
import { QueueConsumer } from "./consumer";

export class OutboxProcessor {
  private consumer: QueueConsumer;

  constructor(private env: Env) {
    this.consumer = new QueueConsumer(env);
  }

  /**
   * Reintenta entregar leads pendientes o con errores en la tabla sales_pending_ingest.
   * Ejecutado por el Cron Trigger cada 15 minutos.
   */
  async processOutbox(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (!this.env.DB) {
      console.warn("[OutboxProcessor] D1 no está configurado.");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    try {
      // Buscar leads pendientes con menos de 5 reintentos
      const { results } = await this.env.DB.prepare(`
        SELECT * FROM sales_pending_ingest
        WHERE status = 'pending' AND retries < 5
        ORDER BY created_at ASC
        LIMIT 20
      `).all<PendingIngestRecord>();

      if (!results || results.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
      }

      for (const row of results) {
        processed++;
        let payload: LeadIngestPayload;

        try {
          payload = JSON.parse(row.payload_json);
        } catch (e: any) {
          console.error(`[OutboxProcessor] JSON inválido en outbox id ${row.id}:`, e);
          await this.env.DB.prepare(`
            UPDATE sales_pending_ingest
            SET status = 'failed', last_error = 'JSON_CORRUPTO', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(row.id).run();
          failed++;
          continue;
        }

        const delivery = await this.consumer.deliverLead(payload);

        if (delivery.success) {
          succeeded++;
          await this.env.DB.prepare(`
            UPDATE sales_pending_ingest
            SET status = 'delivered', retries = retries + 1, last_error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(row.id).run();
        } else {
          failed++;
          const nextRetries = row.retries + 1;
          const newStatus = nextRetries >= 5 ? "failed" : "pending";

          await this.env.DB.prepare(`
            UPDATE sales_pending_ingest
            SET status = ?, retries = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(newStatus, nextRetries, delivery.error || "RETRY_FAILED", row.id).run();
        }
      }
    } catch (err) {
      console.error("[OutboxProcessor] Error general procesando outbox:", err);
    }

    return { processed, succeeded, failed };
  }
}
