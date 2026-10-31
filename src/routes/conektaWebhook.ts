import { Hono } from "hono";
import { Env } from "../types";
import { ConektaService } from "../services/conekta";

export const conektaWebhookRouter = new Hono<{ Bindings: Env }>();

conektaWebhookRouter.get("/", (c) => {
  return c.json({
    status: "active",
    service: "ark-sales-conekta-webhook",
    events_supported: ["order.paid", "charge.paid"],
  });
});

conektaWebhookRouter.post("/", async (c) => {
  try {
    const rawBody = await c.req.json().catch(() => null);
    if (!rawBody) {
      return c.json({ error: "Cuerpo de solicitud vacío o JSON inválido" }, 400);
    }

    const signature = c.req.header("Conekta-Signature") || c.req.header("X-Conekta-Signature") || "";
    const conektaService = new ConektaService(c.env);
    const result = await conektaService.processWebhookEvent(rawBody, signature);

    if (!result.success) {
      console.warn("[ConektaWebhookRouter] Webhook warning/error:", result.error);
      // Retornar 200 si es un evento ignorado o procesado parcialmente para evitar reintentos infinitos si Conekta reenvía
      return c.json(result, 200);
    }

    return c.json({
      received: true,
      event: result.event,
      order_id: result.orderId,
      opportunity_id: result.opportunityId,
    }, 200);
  } catch (err: any) {
    console.error("[ConektaWebhookRouter] Excepción fatal en webhook:", err);
    return c.json({ error: err.message || "Error interno procesando webhook Conekta" }, 500);
  }
});
