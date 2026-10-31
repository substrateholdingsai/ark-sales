import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env, LeadIngestPayload } from "./types";
import { chatRouter } from "./routes/chat";
import { webhookRouter } from "./routes/webhooks";
import { telnyxRouter } from "./routes/telnyxWebhook";
import { telnyxVoiceAiRouter } from "./routes/telnyxVoiceAi";
import { internalRouter } from "./routes/internal";
import { authRouter } from "./routes/auth";
import { crmRouter } from "./routes/crm";
import { crmAccountsRouter } from "./routes/crmAccounts";
import { crmContactsRouter } from "./routes/crmContacts";
import { crmOpportunitiesRouter } from "./routes/crmOpportunities";
import { crmActivitiesRouter } from "./routes/crmActivities";
import { crmTasksRouter } from "./routes/crmTasks";
import { superadminRouter } from "./routes/superadmin";
import { conektaWebhookRouter } from "./routes/conektaWebhook";
import { AuthVariables, authMiddleware } from "./auth/middleware";
import { CatalogService, FAIL_CLOSED_MESSAGE } from "./catalog/service";
import { QueueConsumer } from "./queue/consumer";
import { OutboxProcessor } from "./queue/outbox";
import { SalesAgent } from "./durable-objects/SalesAgent";
import { WIDGET_JS_SOURCE } from "./client/widgetScript";
import { renderLandingHtml } from "./client/demoPage";
import { renderPublicLandingHtml } from "./client/landingPage";
import { renderCrmLoginHtml, renderCrmHtml, isAuthenticated } from "./client/crmPage";
import { renderSuperAdminHtml } from "./client/superAdminPage";
import { renderAltumPage } from "./client/altumPage";
import { getAltumAsset } from "./client/altumAssets";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Middleware CORS
app.use("*", cors({
  origin: (origin) => {
    if (!origin) return "*";
    if (origin.endsWith(".arksystems.site") || origin === "https://arksystems.site" || origin.includes("localhost")) {
      return origin;
    }
    return "https://arksystems.site";
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-Ark-Internal-Key"],
  credentials: true,
}));

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    worker: "ark-sales",
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || "development",
  });
});

// Entrega del script del Chat Widget (para embeber en landings externas como Astro o HTML)
app.get("/widget.js", (c) => {
  return new Response(WIDGET_JS_SOURCE, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// Landing Page Demo con el widget interactivo embebido
app.get("/", (c) => {
  return c.html(renderLandingHtml(c));
});

app.get("/demo", (c) => {
  return c.html(renderLandingHtml(c));
});

// Landing Page pÃºblica que explica las funciones del proyecto
const publicLandingPaths = [
  "/landing",
  "/landing-page",
  "/public",
  "/public-landing",
  "/features",
  "/funciones",
  "/about",
  "/info",
  "/project",
  "/functions",
];
for (const p of publicLandingPaths) {
  app.get(p, (c) => {
    return c.html(renderPublicLandingHtml());
  });
}

// Showcase Inmobiliario ALTUM Sureste (Herméticamente aislado para no contaminar Ark)
app.get("/altum", (c) => c.html(renderAltumPage()));
app.get("/altum-sureste", (c) => c.html(renderAltumPage()));

// Entrega de assets vectoriales ALTUM
app.get("/assets/altum/:file", (c) => {
  const file = c.req.param("file");
  const asset = getAltumAsset(file);
  if (!asset) {
    return c.json({ error: "Asset no encontrado" }, 404);
  }
  return new Response(asset.content, {
    status: 200,
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// Endpoint pÃºblico para consultar catÃ¡logo oficial (Fail-Closed)
app.get("/api/catalog", async (c) => {
  const catalogService = new CatalogService(c.env.DB);
  const result = await catalogService.getCatalog();
  if (!result.success) {
    return c.json({ error: FAIL_CLOSED_MESSAGE }, 503);
  }
  return c.json(result);
});

// Middleware de autenticaciÃ³n (parsea token si existe) para rutas CRM y Auth
app.use("/api/auth", authMiddleware());
app.use("/api/auth/*", authMiddleware());
app.use("/api/crm", authMiddleware());
app.use("/api/crm/*", authMiddleware());
app.use("/api/superadmin", authMiddleware());
app.use("/api/superadmin/*", authMiddleware());

// Montar submódulos
app.route("/api/chat", chatRouter);
app.route("/webhooks/telnyx", telnyxRouter);
app.route("/webhooks/telnyx/voice-ai", telnyxVoiceAiRouter);
app.route("/webhooks/conekta", conektaWebhookRouter);
app.route("/webhooks/ingest", webhookRouter);
app.route("/api/internal", internalRouter);
app.route("/api/crm/voice", telnyxVoiceAiRouter);
app.route("/api/auth", authRouter);
app.route("/api/crm", crmRouter);
app.route("/api/crm/accounts", crmAccountsRouter);
app.route("/api/crm/contacts", crmContactsRouter);
app.route("/api/crm/opportunities", crmOpportunitiesRouter);
app.route("/api/crm/activities", crmActivitiesRouter);
app.route("/api/crm/tasks", crmTasksRouter);
app.route("/api/superadmin", superadminRouter);

// CRM privado
app.get("/crm/login", (c) => {
  return c.html(renderCrmLoginHtml());
});

app.get("/crm", async (c) => {
  const ok = await isAuthenticated(c.req.raw, c.env);
  if (!ok) return c.html(renderCrmLoginHtml());
  return c.html(renderCrmHtml());
});

// Consola Super Admin (Multi-Tenant, Resend & Telnyx Voice AI)
app.get("/superadmin", async (c) => {
  const ok = await isAuthenticated(c.req.raw, c.env);
  if (!ok) return c.html(renderCrmLoginHtml());
  return c.html(renderSuperAdminHtml());
});
app.notFound((c) => {
  return c.json({ error: "Endpoint no encontrado en ark-sales." }, 404);
});

// Handler de errores globales
app.onError((err, c) => {
  console.error("[ark-sales global error]:", err);
  return c.json({ error: "Error interno en ark-sales." }, 500);
});

// Export de la clase Durable Object
export { SalesAgent };

// Export de la instancia Hono para pruebas
export { app };

// Handler principal del Cloudflare Worker
export default {
  // Manejador HTTP (Hono)
  fetch: app.fetch,

  // Manejador de Cloudflare Queues (SALES_INGEST_QUEUE)
  async queue(batch: MessageBatch<LeadIngestPayload>, env: Env): Promise<void> {
    console.log(`[ark-sales queue] Procesando lote de ${batch.messages.length} mensajes en SALES_INGEST_QUEUE...`);
    const consumer = new QueueConsumer(env);
    await consumer.processBatch(batch);
  },

  // Manejador de Cron Triggers (Outbox Pattern Retry - */15 * * * *)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[ark-sales cron] Ejecutando outbox retry programado (${event.cron})...`);
    const outbox = new OutboxProcessor(env);
    ctx.waitUntil(
      outbox.processOutbox().then((stats) => {
        console.log(`[ark-sales cron] Outbox completado. Procesados: ${stats.processed}, Ã‰xitos: ${stats.succeeded}, Fallos: ${stats.failed}`);
      })
    );
  },
};

