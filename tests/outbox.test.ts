import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueueConsumer } from "../src/queue/consumer";
import { OutboxProcessor } from "../src/queue/outbox";
import { Env, LeadIngestPayload } from "../src/types";

describe("Outbox Pattern & Queue Consumer Resiliency", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const samplePayload: LeadIngestPayload = {
    version: 3,
    lead_id: "lead_outbox_test",
    email: "despacho@prueba.com",
    source_worker: "ark-sales",
    destination: "ledger",
    vertical: "fiscal",
    score: 85,
    conversation_summary: "Test outbox",
    account_context: {
      despacho_nombre: "Despacho Prueba",
      tamano: "1-5",
      productos_interes: ["ledger"],
      dolor_principal: "SAT",
    },
  };

  it("debe procesar exitosamente la entrega cuando el hermano destino responde 200 OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ received: true }),
    } as any);

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ run: mockRun }),
        }),
      } as any,
      AI: null,
      SALES_INGEST_QUEUE: {} as any,
      SALES_AGENT: {} as any,
      LEDGER_API_URL: "https://ledger.arksystems.site",
    };

    const consumer = new QueueConsumer(mockEnv);
    const ackMock = vi.fn();
    const retryMock = vi.fn();

    await consumer.processBatch({
      queue: "ark-sales-ingest-queue",
      messages: [
        {
          id: "msg_1",
          timestamp: new Date(),
          body: samplePayload,
          ack: ackMock,
          retry: retryMock,
        } as any,
      ],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as any);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ledger.arksystems.site/api/internal/leads/ingest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Ark-Source": "ark-sales",
          "X-Ark-Contract": "LEAD_INGEST_V3",
          "X-Idempotency-Key": "lead_outbox_test",
        }),
      })
    );
    expect(ackMock).toHaveBeenCalled();
    expect(retryMock).not.toHaveBeenCalled();
  });

  it("debe reintentar el mensaje en la cola y mantener en pending si el hermano destino responde con error 500 (ej. deploy)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Internal Server Error during deploy"),
    } as any);

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({ run: mockRun }),
        }),
      } as any,
      AI: null,
      SALES_INGEST_QUEUE: {} as any,
      SALES_AGENT: {} as any,
      LEDGER_API_URL: "https://ledger.arksystems.site",
    };

    const consumer = new QueueConsumer(mockEnv);
    const ackMock = vi.fn();
    const retryMock = vi.fn();

    await consumer.processBatch({
      queue: "ark-sales-ingest-queue",
      messages: [
        {
          id: "msg_2",
          timestamp: new Date(),
          body: samplePayload,
          ack: ackMock,
          retry: retryMock,
        } as any,
      ],
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as any);

    expect(retryMock).toHaveBeenCalled();
    expect(ackMock).not.toHaveBeenCalled();
  });

  it("el OutboxProcessor debe reintentar registros pendientes desde sales_pending_ingest (Cron Trigger)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ received: true }),
    } as any);

    const mockRun = vi.fn().mockResolvedValue({ success: true });
    const mockEnv: Env = {
      DB: {
        prepare: vi.fn().mockImplementation((query: string) => {
          if (query.includes("SELECT * FROM sales_pending_ingest")) {
            return {
              all: vi.fn().mockResolvedValue({
                results: [
                  {
                    id: "outbox_1",
                    lead_id: "lead_outbox_test",
                    destination: "ledger",
                    payload_json: JSON.stringify(samplePayload),
                    status: "pending",
                    retries: 1,
                  },
                ],
              }),
            };
          }
          return {
            bind: vi.fn().mockReturnValue({ run: mockRun }),
          };
        }),
      } as any,
      AI: null,
      SALES_INGEST_QUEUE: {} as any,
      SALES_AGENT: {} as any,
      LEDGER_API_URL: "https://ledger.arksystems.site",
    };

    const outbox = new OutboxProcessor(mockEnv);
    const result = await outbox.processOutbox();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });
});
