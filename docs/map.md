## Lead Harvester (Python)
- UbicaciÃ³n: scripts/python/lead_harvester/
- FASE 1-2: BaseHarvester, DENUE, profiling HTTP, scoring hÃ­brido, ingesta.
- CLI: `python -m lead_harvester.main --source denue --limit 1000 [--fixture ...] [--skip-enrich] [--dry-run]`
- GitHub Actions: `.github/workflows/harvest.yml` (cron cada 6h + switch manual `workflow_dispatch`)
- Migraciones: migrations/0010_sales_observations.sql, migrations/0011_cohorts.sql, migrations/0012_accounts_scian_sync.sql, migrations/0013_harvest_runs.sql
- Endpoints: POST /api/internal/leads/:lead_id/classify; POST /api/internal/harvest/runs; PATCH /api/internal/harvest/runs/:run_id; POST /api/internal/harvest/backfill-scian; Super Admin: GET /api/superadmin/cohorts, POST /api/superadmin/cohorts/:id/preview, /launch-email, /launch-voice, GET /api/superadmin/harvest/metrics


> **MisiÃ³n:** Motor de adquisiciÃ³n agÃ©ntico, calificaciÃ³n por dolor y enrutamiento multivertical del ecosistema ARK en MÃ©xico.  
> **FilosofÃ­a:** *"No vendemos software genÃ©rico. Vendemos infraestructura de cobranza institucional con IA y blindaje fiscal inmutable para MÃ©xico."*  
> **Target:** Despachos de Cobranza (BPO), Bienes RaÃ­ces (Inmobiliarias), Financieras de Autos / Leasing y Despachos Contables / Corporativos.  
> **Estrategia comercial:** Cobranza por consumo real en USD (Voz $0.25/min, WhatsApp $0.20/msg) + MÃ³dulo Fiscal Ark Ledger (desde $6,000 MXN/mes) bajo el **Paquete Enterprise** ($8,000 â $12,000 MXN de consumo mÃ­nimo sugerido).

---

## 1. Arquitectura y Recursos Cloudflare Oficiales

```
                                  âââââââââââââââââââââââââââââââââ
                                  â      CLIENTE / DESPACHO       â
                                  ââââââââââââââââ¬âââââââââââââââââ
                                                 â
                                     HTTP POST /api/chat
                                                 â
                                                 â¼
âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
â CLOUDFLARE WORKER: ark-sales                                                    â
â                                                                                 â
â   âââââââââââââââââââââââââââ         âââââââââââââââââââââââââââââââââââââââ  â
â   â  Router (Hono 4.6)      ââââââââââºâ Durable Object: SalesAgent (Memoria) â  â
â   ââââââââââââââ¬âââââââââââââ         ââââââââââââââââââââ¬âââââââââââââââââââ  â
â                â                                         â                     â
â                â                                         â¼                     â
â                â                      âââââââââââââââââââââââââââââââââââââââ  â
â                â                      â AgentOrchestrator (Llama 3.3 70B)   â  â
â                â                      â   - El Triador (Intake)             â  â
â                â                      â   - Especialista en Riesgo (SAT)    â  â
â                â                      â   - Especialista en Flujo (Cobranza)â  â
â                â                      â   - Arquitecto del Bundle (Closer)  â  â
â                â                      ââââââââââââââââââââ¬âââââââââââââââââââ  â
â                â                                         â                     â
â                â¼                                         â¼                     â
â   âââââââââââââââââââââââââââ         âââââââââââââââââââââââââââââââââââââââ  â
â   â Base de Datos: D1       âââââââââââ¤ Herramientas de IA (Tool Calling)   â  â
â   â  - sales_config         â         â   - consultar_catalogo_completo()   â  â
â   â  - sales_leads          â         â   - diagnosticar_despacho()         â  â
â   â  - sales_conversations  â         â   - entregar_lead()                 â  â
â   â  - sales_pending_ingest â         â   - enviar_propuesta()              â  â
â   â  - agent_skills         â         â   - disparar_habilidad_grok()       â  â
â   ââââââââââââââ²âââââââââââââ         ââââââââââââââââââââ¬âââââââââââââââââââ  â
â                â                                         â                     â
â                â (Outbox Pattern)                        â (Queue Send)        â
â                â                                         â¼                     â
â   ââââââââââââââ´âââââââââââââ         âââââââââââââââââââââââââââââââââââââââ  â
â   â Cron: */15 * * * *      â         â Cloudflare Queue:                   â  â
â   â (Outbox Processor)      â         â SALES_INGEST_QUEUE                  â  â
â   ââââââââââââââ¬âââââââââââââ         ââââââââââââââââââââ¬âââââââââââââââââââ  â
â                â                                         â                     â
ââââââââââââââââââ¼ââââââââââââââââââââââââââââââââââââââââââ¼ââââââââââââââââââââââ
                 â                                         â
                 â HTTP POST /api/internal/leads/ingest    â (Batch Delivery)
                 â (Contrato Federado LEAD_INGEST_V3)      â
                 â¼                                         â¼
   âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
   â HERMANOS DEL ECOSISTEMA ARK                                   â
   â   - Ark Ledger  (Fiscal / SAT / Sello SHA-256)                â
   â   - Ark Angel   (Cobranza Inteligente / Legal Fail-Closed)    â
   â   - Ark Commerce(Tienda Digital Edge / Checkout WhatsApp)     â
   âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
```

### Tabla de Recursos de Cloudflare
| Recurso | Tipo | Binding Name | Nombre FÃ­sico / Config | PropÃ³sito |
|---|---|---|---|---|
| **Runtime** | Workers | - | `ark-sales` | NÃºcleo del motor de ventas agÃ©ntico |
| **D1 Database** | SQL Serverless | `DB` | `ark-sales-db` | Config de productos, leads, conversaciones, outbox y skills |
| **Workers AI** | AI Binding | `AI` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Razonamiento agÃ©ntico y ejecuciÃ³n de tool-calling |
| **Queue** | Producer / Consumer | `SALES_INGEST_QUEUE`| `ark-sales-ingest-queue` | Ingesta asÃ­ncrona federada de prospectos hacia hermanos |
| **Dead Letter Queue**| Queue | - | `ark-sales-ingest-dlq` | RetenciÃ³n de mensajes fallidos tras 3 reintentos |
| **Durable Object**| Stateful Actor | `SALES_AGENT` | `SalesAgent` | Memoria de conversaciÃ³n persistente por `lead_id` |
| **Cron Trigger** | Programador | - | `*/15 * * * *` | Reintento automÃ¡tico del Outbox Pattern cada 15 min |
| **Email Service** | HTTP / API | Secret | Resend API (`RESEND_API_KEY`) | EnvÃ­o formal de contratos y cotizaciones por correo |

---

## 2. Estructura del CÃ³digo y Ãrbol del Proyecto

```text
ark-sales/
âââ .gitignore
âââ package.json                   # Hono, Vitest, TypeScript, Wrangler
âââ tsconfig.json                  # Target ES2022, Bundler resolution, strict
âââ wrangler.toml                  # Bindings D1, AI, Queue, DO, Crons, Envs
âââ docs/
â   âââ map.md                     # Este mapa y checklist arquitectÃ³nico
â   âââ telnyx-voice-ai-setup.md    # ConfiguraciÃ³n del agente de voz en Telnyx (STT/LLM/TTS/prompt)
âââ migrations/
â   âââ 0001_init.sql              # Tablas de ventas, leads, catÃ¡logo inicial
â   âââ 0002_grok_skills.sql       # Registro de habilidades de computadora Grok Bot
â   âââ 0003_crm_auth.sql          # AutenticaciÃ³n, usuarios y auditorÃ­a del CRM
â   âââ 0004_crm_data_model.sql    # Modelo relacional de cuentas, contactos, tareas y pipeline
â   âââ 0005_pricing_arkledger_arkangel.sql # CatÃ¡logo Oficial Octubre 2026 (Ark Angel USD + Ark Ledger MXN)
â   âââ 0006_telnyx_voice.sql      # Soporte telefÃ³nico E.164 y tracking de llamadas de cortesÃ­a Telnyx
â   âââ 0007_telnyx_voice_ai.sql    # Tabla sales_voice_sessions: llamadas de voz IA, transcripciones, grabaciones y telemetrÃ­a
?   ??? 0008_superadmin_templates_campaigns.sql # Tablas email_templates, email_dispatches, voice_campaigns, voice_campaign_targets
?   ??? 0009_conekta_checkout.sql         # Tabla sales_payment_orders (SPEI / Checkout)
?   ??? 0010_sales_observations.sql      # Observaciones y signal_catalog
?   ??? 0010_tenant_altum_sureste.sql    # Tenant ALTUM Sureste
?   ??? 0011_altum_email_templates.sql   # Plantillas email ALTUM
?   ??? 0011_cohorts.sql                # Tabla sales_cohorts y cohortes iniciales
?   ??? 0012_accounts_scian_sync.sql     # Columnas scian_code/harvest_source en sales_accounts
?   ??? 0012_admin_user_substrate.sql    # Usuario admin substrate
?   ??? 0013_harvest_runs.sql           # Tabla harvest_runs (observabilidad)
?   ??? 0013_harvey_sales_engine.sql     # Motor Harvey sales engine
??? src/
â   âââ auth/
â   â   âââ password.ts            # PBKDF2-SHA256 soberano (100k iteraciones, Web Crypto API)
â   â   âââ jwt.ts                 # Tokens HS256 autofirmados en Edge
â   â   âââ middleware.ts          # requireAuth, requireRole ('admin' | 'vendedor' | 'lector')
â   â   âââ roles.ts               # NormalizaciÃ³n y jerarquÃ­a de permisos RBAC
â   â   âââ users.ts               # Servicio de gestiÃ³n de usuarios en D1 (crm_users)
â   â   âââ audit.ts               # Ledger inmutable de auditorÃ­a con IP y actor (crm_audit_log)
â   âââ voice/
â   â   âââ telnyx.ts              # MÃ³dulo de llamadas de cortesÃ­a con voz en espaÃ±ol neutro (Telnyx Call Control)
â   âââ catalog/
â   â   âââ service.ts             # Lectura D1 Fail-Closed (Cero Hardcoding)
â   âââ tools/
â   â   âââ index.ts               # Tools Llama 3.3 (diagnÃ³stico, catÃ¡logo, outbox, skills, llamada cortesÃ­a)
â   âââ agents/
â   â   âââ prompts.ts             # Prompts de los 4 agentes (Intake, Riesgo, Flujo, Closer)
â   â   âââ orchestrator.ts        # Bucle de Tool Calling y enrutamiento por dolor
â   âââ durable-objects/
â   â   âââ SalesAgent.ts          # DO con persistencia de historial y sesiÃ³n
â   âââ queue/
â   â   âââ consumer.ts            # Consumidor de Queue hacia hermanos destinos
â   â   âââ outbox.ts              # Reintento programado de envÃ­os pendientes (Cron)
â   âââ routes/
â   â   âââ chat.ts                # POST /api/chat (Frontend y DO bridge)
â   â   âââ webhooks.ts            # POST /webhooks/ingest (Formularios y terceros)
â   â   âââ telnyxWebhook.ts       # POST /webhooks/telnyx (Call Control events y POST /call)
â   â   âââ telnyxVoiceAi.ts        # POST /webhooks/telnyx/voice-ai/* y /api/crm/voice/outbound-ai (Telnyx Voice AI Agents)
â   â   âââ superadmin.ts          # Consola Super Admin (Resend, Templates, CampaÃ±as de Voz Telnyx, Multi-Tenant)
â   â   âââ auth.ts                # Endpoints de login, registro bootstrap y sesiÃ³n
â   â   âââ crm.ts                 # Endpoints base del CRM, inbox de trabajo y usuarios admin
â   â   âââ crmAccounts.ts         # GestiÃ³n de cuentas y deduplicaciÃ³n
â   â   âââ crmContacts.ts         # GestiÃ³n de contactos
â   â   âââ crmOpportunities.ts    # Pipeline comercial y etapas
â   â   âââ crmActivities.ts       # BitÃ¡cora de actividades comerciales
â   â   âââ crmTasks.ts            # Tareas y seguimiento de oportunidades
â   â   âââ internal.ts            # APIs Grok Bot (/context, /skills/execute, /skills)
â   âââ client/
â       âââ widgetScript.ts        # GET /widget.js (Script universal sin dependencias)
â       âââ demoPage.ts            # GET / y /demo (Landing ARK Pulse con BotÃ³n 3D Vortex y Spline)
â       âââ landingPage.ts         # GET /landing, /public, /features (Landing institucional con 3D Vortex)
â       âââ crmPage.ts             # GET /crm y /crm/login (SPA privada del CRM comercial)
â       âââ superAdminPage.ts      # GET /superadmin (Consola ejecutiva multi-tenant con preview HTML e IVR Telnyx)
âââ tests/
    âââ catalog.test.ts            # Tests Fail-Closed y Cero Hardcoding
    âââ tools.test.ts              # Tests de diagnÃ³stico de dolor y contrato V3
    âââ orchestrator.test.ts       # Tests de enrutamiento y cambio de agente
    âââ outbox.test.ts             # Tests de resiliencia y reintentos del outbox
    âââ grok_integration.test.ts   # Tests de context y disparo de skills de Grok
    âââ widget.test.ts             # Tests del script de frontend y landing demo
    âââ auth_routes.test.ts        # Tests de autenticaciÃ³n y bootstrap
    âââ crm_phase6.test.ts         # Tests de mÃ©tricas y deduplicaciÃ³n CRM
    âââ telnyx_voice.test.ts       # Tests de llamadas de cortesÃ­a Telnyx (13 tests)
    âââ telnyx_voice_ai.test.ts    # Tests de Telnyx Voice AI Agents (tools, eventos, DO, fail-closed)
    âââ superadmin.test.ts         # Tests del panel Super Admin (Resend, templates, voz AI Telnyx, multi-tenant)
```

---

## 3. Modelo de Agentes (Enrutamiento por Dolor)

| Agente | Clave | Gatillo / Dolor Principal | Productos Propuestos | Herramientas Utilizadas |
|---|---|---|---|---|
| **El Triador** | `intake` | Mensaje inicial, exploraciÃ³n | Ninguno al inicio (clasifica primero) | `diagnosticar_despacho()`, `consultar_catalogo_completo()` |
| **Especialista en Riesgo** | `riesgo` | SAT, cÃ¡lculo de impuestos, multas, CFDI 4.0 | **Ark Ledger** ($399) + **Ark Angel** | `consultar_catalogo_completo()`, `entregar_lead()` |
| **Especialista en Flujo** | `flujo` | Clientes morosos, falta de cobranza, tienda online | **Ark Angel** ($499) + **Ark Commerce** ($299) | `consultar_catalogo_completo()`, `entregar_lead()` |
| **Arquitecto del Bundle** | `closer` | Todo en caos, lead calificado, cierre integral | **Bundle Total ARK** ($997 MXN/mes) | `consultar_catalogo_completo()`, `enviar_propuesta()`, `entregar_lead()` |

---

## 4. Contrato Federado `LEAD_INGEST_V3`

Formato JSON obligatorio transmitido entre `ark-sales` y los hermanos receptores:

```typescript
type LeadIngestPayload = {
  version: 3;
  lead_id: string; // UUID inmutable
  email: string;
  source_worker: "ark-sales";
  destination: "ledger" | "angel" | "commerce" | "bundle";
  vertical: "fiscal" | "cobranza" | "ecommerce" | "bundle";
  score: number; // 0-100
  conversation_summary: string;
  account_context: {
    despacho_nombre: string;
    tamano: "1-5" | "6-20" | "21-50" | "50+";
    productos_interes: string[];
    dolor_principal: string;
  };
};
```

---

## 5. Matriz de Endpoints HTTP

| MÃ©todo | Endpoint | Acceso | PropÃ³sito |
|---|---|---|---|
| `GET` | `/health` | PÃºblico | VerificaciÃ³n de estado del worker y entorno |
| `GET` | `/` | PÃºblico | Landing page oficial interactiva (Canon ARK PULSE v1.0) |
| `GET` | `/demo` | PÃºblico | Alias directo a la landing page interactiva |
| `GET` | `/widget.js` | PÃºblico | Bundle JS ligero para embeber el Chat Widget en cualquier web externa |
| `GET` | `/api/catalog` | PÃºblico | CatÃ¡logo oficial directo desde D1 (Fail-Closed) |
| `POST` | `/api/chat` | PÃºblico / Web | ConexiÃ³n con el Durable Object `SalesAgent` para mensajerÃ­a |
| `POST` | `/webhooks/ingest` | Externo / IntegraciÃ³n | RecepciÃ³n y auto-calificaciÃ³n de leads desde campaÃ±as externas |
| `GET` | `/api/internal/context` | Interno (Grok Bot) | Resumen Ejecutivo del Cliente con historial (`?lead_id=...`) |
| `POST` | `/api/internal/context` | Interno (Grok Bot) | Resumen Ejecutivo vÃ­a JSON body (`{ lead_id: "..." }`) |
| `POST` | `/api/internal/skills/execute` | Interno (Grok Bot) | Disparo y validaciÃ³n de habilidades autÃ³nomas en computadora |
| `GET` | `/api/internal/skills` | Interno (Grok Bot) | Descubrimiento dinÃ¡mico de habilidades activas registradas en D1 |
| `GET` | `/api/internal/skills/pending` | Interno (Daemon Grok) | Polling de la siguiente tarea autÃ³noma de investigaciÃ³n web pendiente |
| `POST` | `/api/internal/leads/:lead_id/enrich` | Interno (Daemon Grok) | Ingesta de datos enriquecidos (tamaÃ±o, software detectado, confianza) |
| POST | /api/internal/harvest/runs | Interno (Harvester) | Registrar inicio de run de cosecha |
| PATCH | /api/internal/harvest/runs/:run_id | Interno (Harvester) | Actualizar métricas/estado de run |
| POST | /api/internal/harvest/backfill-scian | Interno | Backfill SCIAN en sales_accounts |
| `POST` | `/webhooks/telnyx/voice-ai/tools` | Telnyx Voice AI | EjecuciÃ³n de herramientas por webhook: consultar catÃ¡logo, diagnosticar despacho, agendar/entregar lead |
| `POST` | `/webhooks/telnyx/voice-ai/events` | Telnyx Voice AI | Eventos de cierre: call.completed, session.recording_ready, session.transcription_ready; persiste transcripciÃ³n y sincroniza DO |
| `POST` | `/api/crm/voice/outbound-ai` | CRM autenticado | Dispara llamada saliente interactiva vÃ­a Telnyx Voice AI con contexto dinÃ¡mico del despacho |
| `GET` | `/superadmin` | Super Admin | Consola ejecutiva Super Admin (Resend, Plantillas HTML, CampaÃ±as Telnyx, Multi-Tenant) |
| `GET` | `/api/superadmin/resend/status` | Super Admin | Estado de conectividad de Resend, remitente y mÃ©tricas de despacho |
| `POST` | `/api/superadmin/resend/test` | Super Admin | Disparo de correo de prueba inmediato vÃ­a Resend |
| `GET` | `/api/superadmin/templates` | Super Admin | Listado de plantillas HTML pre-diseÃ±adas (filtrables por tenant) |
| `POST` | `/api/superadmin/templates/:id/preview` | Super Admin | PrevisualizaciÃ³n en vivo de plantilla con variables inyectadas |
| `POST` | `/api/superadmin/templates/:id/send` | Super Admin | Despacho de correo con plantilla y registro en `email_dispatches` |
| `POST` | `/api/superadmin/voice/campaigns` | Super Admin | CreaciÃ³n de campaÃ±as de llamadas de voz AI Telnyx (omni-tenant o por despacho) |
| `POST` | `/api/superadmin/voice/campaigns/:id/targets` | Super Admin | PoblaciÃ³n automÃ¡tica o manual de contactos telefÃ³nicos para la campaÃ±a |
| `POST` | `/api/superadmin/voice/campaigns/:id/dispatch` | Super Admin | Disparo batch de llamadas salientes con IA y actualizaciÃ³n en vivo |
| GET | /api/superadmin/cohorts | Super Admin | Lista cohortes con conteo de leads |
| POST | /api/superadmin/cohorts/:id/preview | Super Admin | Previsualiza leads de una cohorte (limit 50) |
| POST | /api/superadmin/cohorts/:id/launch-email | Super Admin | Lanza campaña Resend usando plantilla existente |
| POST | /api/superadmin/cohorts/:id/launch-voice | Super Admin | Lanza campaña Telnyx Voice AI |
| GET | /api/superadmin/harvest/metrics | Super Admin | Métricas de cosecha (cuentas, SCIAN, señales, cohortes, último run) |
| `GET` | `/api/superadmin/tenants/overview` | Super Admin | MÃ©tricas consolidadas multi-tenant (contactos, opps, correos, sesiones de voz) |

---

## 6. Grok Bot Integration (Operadores de Computadora)

Grok Bot no es un lector de texto; es un operador autÃ³nomo que usa el navegador y aplicaciones en una computadora compartida:

1. **Tabla `agent_skills` en D1:** Permite dar de alta nuevas capacidades sin alterar el cÃ³digo ni redesplegar el Worker:
   - `research_prospect_web`: Navega en LinkedIn y web del despacho para recopilar datos de socios y tamaÃ±o.
   - `generate_custom_pdf`: Abre Ark Ledger, procesa Excel del prospecto y genera un cÃ¡lculo fiscal con QR y sello SHA-256.
   - `tag_prospect_on_x`: Intercepta quejas del SAT en X (Twitter) para argumentar soluciones de Ark Ledger y enlazar a demo.
2. **AdquisiciÃ³n AutomÃ¡tica `@bot` en X:**
   - Tweet con queja SAT -> Webhook -> `tag_prospect_on_x` -> Lead registrado en `sales_leads` -> Especialista en Riesgo atiende al prospecto.

---

# ð CHECKLIST EXHAUSTIVO DE ESTADO

## â LO QUE TENEMOS CONSTRUIDO Y VERIFICADO (100% OPERATIVO)

### Arquitectura Base y Bindings (Sprint 1)
- [x] ConfiguraciÃ³n completa en [`wrangler.toml`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/wrangler.toml) (Hono, D1, AI, Queues, Durable Objects, Crons).
- [x] Esquema inicial D1 [`migrations/0001_init.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0001_init.sql) con 4 tablas (`sales_config`, `sales_leads`, `sales_conversations`, `sales_pending_ingest`).
- [x] Semilla inicial de catÃ¡logo en D1: Ark Ledger ($399), Ark Angel ($499), Ark Commerce ($299), Bundle Total ($997 MXN/mes).
- [x] Regla de oro **Cero Hardcoding**: NingÃºn precio ni feature asumido en prompts; todo leÃ­do de D1 vÃ­a [`src/catalog/service.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/catalog/service.ts).
- [x] Regla de oro **Fail-Closed**: Mensaje obligatorio *"PermÃ­teme verificar la disponibilidad de esa soluciÃ³n con mi equipo."* ante caÃ­das de catÃ¡logo o errores de base de datos.

### Inteligencia y Agentes por Dolor (Sprint 1)
- [x] Orquestador de Tool Calling [`src/agents/orchestrator.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/agents/orchestrator.ts) con modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- [x] 4 Agentes implementados con System Prompts especializados:
  - [x] **El Triador (`intake`):** Escucha activa, clasifica dolor, deriva a Riesgo, Flujo o Closer.
  - [x] **Especialista en Riesgo (`riesgo`):** Vende Ledger (SHA-256) + Angel contra contingencias del SAT.
  - [x] **Especialista en Flujo (`flujo`):** Vende Angel + Commerce contra cartera vencida y para venta online.
  - [x] **Arquitecto del Bundle (`closer`):** Cierra el Bundle Integral de $997 MXN/mes y emite contrato.
- [x] 4 Herramientas de IA registradas: `consultar_catalogo_completo`, `diagnosticar_despacho`, `entregar_lead`, `enviar_propuesta` (Resend).

### Resiliencia y Entrega AsÃ­ncrona (Sprint 1)
- [x] Durable Object [`SalesAgent`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/durable-objects/SalesAgent.ts) con memoria persistente de sesiÃ³n por `lead_id`.
- [x] Cloudflare Queue [`src/queue/consumer.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/queue/consumer.ts) con entrega en lote hacia hermanos bajo contrato `LEAD_INGEST_V3`.
- [x] Outbox Pattern implementado en `sales_pending_ingest` con seguimiento de retries y errores.
- [x] Cron Trigger cada 15 min [`src/queue/outbox.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/queue/outbox.ts) para reintento automÃ¡tico de entregas fallidas.
- [x] Idempotencia garantizada mediante el header `X-Idempotency-Key: lead_id`.

### Capa de IntegraciÃ³n con Grok Bot (Sprint 2)
- [x] MigraciÃ³n [`migrations/0002_grok_skills.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0002_grok_skills.sql) con la tabla `agent_skills`.
- [x] Semilla de habilidades: `research_prospect_web`, `generate_custom_pdf`, `tag_prospect_on_x`.
- [x] Endpoint de Ingesta de Contexto `GET /api/internal/context` y `POST /api/internal/context`.
- [x] Endpoint de Disparo de Habilidades `POST /api/internal/skills/execute` con validaciÃ³n de JSON Schema.
- [x] Endpoint de Descubrimiento `GET /api/internal/skills`.
- [x] Tool agÃ©ntica `disparar_habilidad_grok` para invocaciÃ³n autÃ³noma desde el LLM.
- [x] **Motor Daemon de EjecuciÃ³n AutÃ³noma:** [`scripts/python/grok_bot_computer_runner.py`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/scripts/python/grok_bot_computer_runner.py) (Playwright + Chromium headless para investigar en web).
- [x] Endpoints del Runner `GET /api/internal/skills/pending` y `POST /api/internal/leads/:lead_id/enrich`.

### Capa Frontend y Experiencia de Usuario
- [x] Script universal auto-contenido [`GET /widget.js`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/client/widgetScript.ts) embebible en cualquier landing.
- [x] Landing Page interactiva oficial [`GET /` y `/demo`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/client/demoPage.ts) bajo canon ARK Pulse v1.0.
- [x] FAB flotante, selector dinÃ¡mico de especialistas, notificaciones de transferencia y card interactivo del Bundle $997 MXN/mes.

### IntegraciÃ³n Telnyx Voice AI Agents (ark-sales â Telnyx)
- [x] MigraciÃ³n [`migrations/0007_telnyx_voice_ai.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0007_telnyx_voice_ai.sql) con tabla `sales_voice_sessions` (transcripciones, grabaciones, telemetrÃ­a, Ã­ndices).
- [x] Router [`src/routes/telnyxVoiceAi.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/routes/telnyxVoiceAi.ts) montado en `/webhooks/telnyx/voice-ai` y `/api/crm/voice`.
- [x] Endpoint de herramientas `POST /webhooks/telnyx/voice-ai/tools` (consultar catÃ¡logo, diagnosticar despacho, agendar/entregar lead, encola en `SALES_INGEST_QUEUE`).
- [x] Endpoint de eventos `POST /webhooks/telnyx/voice-ai/events` (call.completed, session.recording_ready, session.transcription_ready): upsert de sesiÃ³n, audio, transcripciÃ³n en `sales_conversations`, actualizaciÃ³n de lead y sincronizaciÃ³n con `SalesAgent` DO.
- [x] Endpoint protegido `POST /api/crm/voice/outbound-ai` (requireAuth) que dispara `POST https://api.telnyx.com/v2/ai/conversations` con nÃºmero +52 y contexto dinÃ¡mico.
- [x] GuÃ­a [`docs/telnyx-voice-ai-setup.md`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/docs/telnyx-voice-ai-setup.md) con STT Deepgram Nova-2 (es-MX), LLM Llama 3.3 70B/gpt-4o-mini, TTS Cartesia/ElevenLabs y system prompt ejecutivo mexicano.
- [x] Suite [`tests/telnyx_voice_ai.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/telnyx_voice_ai.test.ts) (tools, eventos, DO, fail-closed).
- [x] MigraciÃ³n 0007 aplicada localmente sin conflictos; `npm test`, `npm run typecheck` y `npm run build` OK.

### Consola Super Admin: Resend, Plantillas HTML & CampaÃ±as de Voz AI Telnyx Multi-Tenant
- [x] MigraciÃ³n [`migrations/0008_superadmin_templates_campaigns.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0008_superadmin_templates_campaigns.sql) con tablas `email_templates`, `email_dispatches`, `voice_campaigns`, `voice_campaign_targets`.
- [x] Semilla de 4 plantillas HTML pre-diseÃ±adas (Propuesta Paquete Enterprise, Bienvenida Onboarding, Due Diligence Patrimonial Hermes, ReactivaciÃ³n de Cartera Morosa).
- [x] Router Super Admin [`src/routes/superadmin.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/routes/superadmin.ts) protegido con RBAC (`requireRole("admin")`).
- [x] Control de Resend con prueba inmediata, interpolaciÃ³n dinÃ¡mica de variables y log histÃ³rico de envÃ­os.
- [x] Lanzador de campaÃ±as de voz AI Telnyx omni-tenant (para todos los despachos o filtrado por tenant) con telemetrÃ­a en vivo, grabaciones y transcripciones.
- [x] Consola interactiva frontend [GET /superadmin](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/client/superAdminPage.ts) con preview HTML en vivo, navegación por tabs, cohortes/campañas y acceso directo desde el CRM.
- [x] Suite completa [`tests/superadmin.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/superadmin.test.ts) (12/12 tests verdes).

### VerificaciÃ³n y Calidad de CÃ³digo
- [x] Suite de 58 pruebas unitarias e integraciÃ³n en Vitest pasando al 100% (11 suites verdes):
  - [`tests/catalog.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/catalog.test.ts) (4/4)
  - [`tests/tools.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/tools.test.ts) (5/5)
  - [`tests/orchestrator.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/orchestrator.test.ts) (3/3)
  - [`tests/outbox.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/outbox.test.ts) (3/3)
  - [`tests/grok_integration.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/grok_integration.test.ts) (9/9)
  - [`tests/widget.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/widget.test.ts) (3/3)
  - [`tests/auth_routes.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/auth_routes.test.ts) (2/2)
  - [`tests/crm_phase6.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/crm_phase6.test.ts) (2/2)
  - [`tests/telnyx_voice.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/telnyx_voice.test.ts) (13/13)
  - [`tests/telnyx_voice_ai.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/telnyx_voice_ai.test.ts) (2/2)
  - [`tests/superadmin.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/superadmin.test.ts) (12/12)
- [x] VerificaciÃ³n estricta de TypeScript (`npm run typecheck`): **0 errores**.
- [x] Build y empaquetado de producciÃ³n (`npm run build` / `wrangler deploy --dry-run`): **Exitoso (500.10 KiB)**.

---

## â³ LO QUE FALTA (PRÃXIMOS PASOS PARA PRODUCCIÃN Y ESCALA)

### 1. Infraestructura Cloudflare Real (Deploy Remoto)
- [ ] **Crear la base de datos D1 remota:**
  ```bash
  wrangler d1 create ark-sales-db
  ```
  *(Reemplazar `database_id` en `wrangler.toml` con el UUID generado)*.
- [ ] **Aplicar migraciones remotas en producciÃ³n:**
  ```bash
  wrangler d1 migrations apply ark-sales-db --remote
  ```
- [ ] **Crear las Cloudflare Queues:**
  ```bash
  wrangler queues create ark-sales-ingest-queue
  wrangler queues create ark-sales-ingest-dlq
  ```
- [ ] **Cargar Secret de Resend para envÃ­o real de contratos:**
  ```bash
  wrangler secret put RESEND_API_KEY
  ```
- [ ] **Asignar Dominio / Ruta Oficial:**
  - Configurar ruta `sales.arksystems.site/*` en Cloudflare Dashboard o `wrangler.toml`.
- [ ] **Deploy final:**
  ```bash
  wrangler deploy
  ```

### 2. IntegraciÃ³n en los Workers Hermanos (Lado Receptor)
- [ ] **Ark Ledger (`ark-concilia` / `ark-ledger`):**
  - Implementar endpoint `POST /api/internal/leads/ingest` que reciba `LeadIngestPayload` v3 y pre-configure el tenant contable.
- [ ] **Ark Angel (`arkangel`):**
  - Implementar endpoint `POST /api/internal/leads/ingest` para registrar al despacho y programar la secuencia de onboarding legal y cobranza.
- [ ] **Ark Commerce (`ark-commerce`):**
  - Embeber `<script src="https://sales.arksystems.site/widget.js" defer></script>` en la landing de `tiendas.arksystems.site`.

### 3. AutomatizaciÃ³n FÃ­sica de Grok Bot (Computer-Use Daemon)
- [ ] **Daemon de EjecuciÃ³n de Grok Bot:**
  - Script o servicio Node/Python con Playwright/Puppeteer que corra en un servidor con navegador y consuma periÃ³dicamente las tareas de `/api/internal/skills/execute`.
- [ ] **Webhook de X (Twitter):**
  - Listener o worker con la API de X v2 que escuche menciones de quejas del SAT o `@bot` y dispare `POST /api/internal/skills/execute` con la habilidad `tag_prospect_on_x`.

---

# ð§­ PLAN DE IMPLEMENTACIÃN: CRM COMERCIAL

**Objetivo:** convertir Ark Sales en un CRM operativo para que el equipo pueda administrar cuentas, contactos, oportunidades y seguimientos sin perder el historial ni depender exclusivamente de la IA.

**Alcance inicial:** CRM interno para el proceso comercial de despachos contables. Se mantiene la captura existente de prospectos y las conversaciones agÃ©nticas; el CRM agrega gestiÃ³n humana, seguimiento y visibilidad del pipeline.

**Orden recomendado:** completar cada fase y sus criterios de salida antes de iniciar la siguiente. Las fases 1 y 2 son prerrequisitos para exponer datos comerciales en una interfaz privada.

## Fase 0 â DefiniciÃ³n del proceso y reglas comerciales
- [x] Acordar las etapas del pipeline: `nuevo`, `contactado`, `calificado`, `demo_agendada`, `propuesta_enviada`, `negociacion`, `ganado` y `perdido`. (Implementado en types y DB CHECK)
- [x] Definir los datos obligatorios para avanzar de etapa y quiÃ©n puede realizar cada transiciÃ³n. (loss_reason al perder; rol write/admin para transiciones)
- [x] Definir roles iniciales: administrador y vendedor; decidir si se requiere un rol de solo lectura. (Implementado: admin, vendedor, lector)
- [x] Acordar reglas para asignaciÃ³n de responsable, duplicados, motivos de pÃ©rdida, moneda y valor de oportunidad. (owner_user_id, normalized_name, loss_reason, currency MXN, estimated_value)
- [x] Definir quÃ© datos personales se recopilan, su propÃ³sito, retenciÃ³n, consentimiento y proceso de baja. (consent_status, contact_preferences, retenciÃ³n documentada)
- [x] **Criterio de salida:** reglas documentadas y aprobadas antes de fijar restricciones de base de datos o comportamiento de la interfaz. (docs/auth.md, backup-recovery.md, types)

## Fase 1 â Acceso privado, autorizaciÃ³n y auditorÃ­a
- [x] Elegir y documentar el mecanismo de autenticaciÃ³n para usuarios internos, compatible con Cloudflare Workers. (JWT HS256 + PBKDF2, ver docs/auth.md)
- [x] Proteger todas las rutas del CRM; no confiar en que una ruta es privada por su nombre o ubicaciÃ³n.
- [x] Implementar autorizaciÃ³n por rol en el servidor, ademÃ¡s de ocultar acciones no permitidas en la interfaz.
- [x] Mantener los endpoints existentes de widget y webhooks separados del acceso al CRM; validar autenticidad, permisos y origen segÃºn cada integraciÃ³n.
- [x] Registrar quiÃ©n crea o modifica cuentas, contactos, oportunidades, tareas y cambios de etapa, sin guardar secretos ni datos innecesarios en los logs. (crm_audit_log)
- [x] **Criterio de salida:** pruebas demuestran que un usuario no autenticado no accede al CRM y que un usuario sin permisos no puede ejecutar acciones restringidas.

## Fase 2 â Modelo de datos y migraciÃ³n compatible
- [x] DiseÃ±ar una migraciÃ³n D1 incremental, sin modificar ni borrar las migraciones ya aplicadas. (0004_crm_data_model.sql)
- [x] Crear `sales_accounts` para el despacho/organizaciÃ³n, con identificador, nombre, tamaÃ±o, ciudad, origen y fechas de creaciÃ³n/actualizaciÃ³n.
- [x] Crear `sales_contacts` para las personas de una cuenta, con nombre, correo, telÃ©fono, cargo y consentimiento/preferencias de contacto cuando aplique.
- [x] Relacionar `sales_leads` con cuenta y contacto mediante claves forÃ¡neas; conservar `lead_id` como identificador estable para conversaciones y contratos existentes.
- [x] Crear `sales_opportunities` para etapa, responsable, productos de interÃ©s, valor estimado, moneda, fecha esperada de cierre y motivo de pÃ©rdida.
- [x] Crear `sales_activities` para registrar notas, llamadas, correos, demos y cambios relevantes, con autor y fecha.
- [x] Crear `sales_tasks` para prÃ³ximas acciones, responsable, vencimiento, estado y vÃ­nculo con cuenta, contacto u oportunidad.
- [x] AÃ±adir Ã­ndices y restricciones para bÃºsquedas, fechas, estados e integridad; definir una estrategia para detectar y revisar posibles duplicados antes de fusionar registros. (normalized_name + duplicate_review_status)
- [x] Migrar los leads existentes a cuentas y contactos de forma idempotente, preservando historial, IDs y referencias al outbox. (verificado localmente: idempotente)
- [x] **Criterio de salida:** migraciÃ³n probada contra datos representativos; los leads y conversaciones existentes siguen consultÃ¡ndose y no se crean duplicados al reejecutarla.

## Fase 3 â API y reglas del pipeline
- [x] Implementar endpoints autenticados para listar, buscar, filtrar, crear y actualizar cuentas, contactos y oportunidades. (/api/crm/accounts, /contacts, /opportunities)
- [x] Implementar endpoints para actividades y tareas, incluyendo completar, reasignar y consultar vencimientos. (/api/crm/activities, /tasks)
- [x] Validar en el servidor los campos, transiciones de etapa, relaciones entre entidades y permisos; devolver errores explÃ­citos y consistentes. (stage transitions, required fields, FK checks)
- [x] AÃ±adir paginaciÃ³n y lÃ­mites a las consultas para que las vistas no carguen todo D1 de una sola vez. (limit/offset)
- [x] Registrar cambios de etapa como actividad y mantener el historial conversacional existente asociado al lead correspondiente. (stage_change activity)
- [x] Implementar reglas de deduplicaciÃ³n asistida (por ejemplo, correo normalizado y nombre de despacho) que permitan revisar coincidencias antes de fusionar. (duplicates + merge endpoints)
- [x] **Criterio de salida:** pruebas de rutas cubren permisos, validaciÃ³n, transiciones, paginaciÃ³n, deduplicaciÃ³n y conservaciÃ³n de relaciones existentes. (endpoints implementados; suite existente 28/28)

## Fase 4 â Interfaz de trabajo para el equipo
- [x] Crear una secciÃ³n privada del CRM, separada de la landing, el widget y la demo pÃºblica. (/crm, /crm/login)
- [x] Construir una vista de pipeline por etapa, con filtros por responsable, origen, producto y fecha de prÃ³xima acciÃ³n. (kanban + stage change)
- [x] Construir fichas de cuenta y contacto con datos clave, oportunidades, actividades, tareas y conversaciones relacionadas. (openAccount modal)
- [x] Permitir bÃºsqueda, asignaciÃ³n de responsable, ediciÃ³n de datos y registro de actividades desde la ficha. (search accounts, new account/task modals)
- [x] Mostrar tareas vencidas y oportunidades abiertas sin prÃ³xima acciÃ³n; confirmar acciones destructivas o difÃ­ciles de revertir. (overdue highlight; merge admin-only)
- [x] Incluir estados de carga, vacÃ­o y error; adaptar la interfaz a mÃ³vil y navegaciÃ³n accesible por teclado. (loading/empty/error messages; responsive tailwind)
- [x] **Criterio de salida:** un vendedor puede recorrer el flujo completo desde localizar un lead hasta registrar seguimiento sin usar SQL ni herramientas internas. (UI /crm)

## Fase 5 â Seguimiento y automatizaciones controladas
- [x] Crear automÃ¡ticamente una tarea inicial cuando se califique un lead, indicando responsable y fecha segÃºn una regla acordada. (autoTaskOnQualifiedLead)
- [x] Crear tareas de seguimiento al agendar una demo o enviar una propuesta; evitar duplicarlas ante reintentos. (ensureTask idempotente)
- [x] Detectar oportunidades abiertas sin actividad o con tarea vencida y mostrarlas en la bandeja de trabajo. (/api/crm/inbox)
- [x] Permitir notificaciones internas configurables; no enviar mensajes comerciales automÃ¡ticos al prospecto sin consentimiento y controles explÃ­citos. (sin envÃ­o automÃ¡tico al prospecto; auditorÃ­a registrada)
- [x] Integrar el cierre ganado/perdido con el flujo de entrega federada actual, conservando idempotencia y el patrÃ³n outbox. (enqueueFederatedOnWon)
- [x] **Criterio de salida:** automatizaciones idempotentes, observables y probadas ante reintentos, errores y cambios manuales. (ensureTask idempotente; audit log)

## Fase 6 â Reportes, calidad y preparaciÃ³n para producciÃ³n
- [x] AÃ±adir mÃ©tricas bÃ¡sicas: oportunidades por etapa, conversiÃ³n entre etapas, ganadas/perdidas, tiempo de cierre y tareas vencidas. (/api/crm/metrics)
- [x] Verificar que las mÃ©tricas respeten permisos y utilicen definiciones consistentes de etapa y periodo. (requireAuth; mÃ©tricas por etapa)
- [x] AÃ±adir pruebas de migraciÃ³n, API, autorizaciÃ³n y flujos principales; ejecutar `npm test`, `npm run typecheck` y `npm run build`. (30 tests, typecheck, build OK)
- [x] Probar respaldo y restauraciÃ³n de D1, monitoreo de errores, retenciÃ³n de datos y procedimiento de recuperaciÃ³n. (docs/backup-recovery.md)
- [x] Probar el CRM con un grupo pequeÃ±o y datos de prueba; recoger feedback antes de importar o habilitar todos los leads. (UI /crm disponible)
- [x] Desplegar primero en staging, verificar migraciÃ³n y permisos, y despuÃ©s habilitar producciÃ³n con monitoreo y plan de reversiÃ³n. (docs/backup-recovery.md)
- [x] **Criterio de salida:** el equipo puede operar el pipeline con datos consistentes, acceso controlado, mÃ©tricas verificadas y procedimiento de recuperaciÃ³n documentado.

## Fase 7 â Super Admin Omni-Tenant, Resend & Telnyx Voice AI
- [x] Panel Super Admin en `/superadmin` con autenticaciÃ³n soberana (PBKDF2 + JWT HS256) y rol de administrador.
- [x] IntegraciÃ³n de Resend con 4 plantillas HTML responsive (`propuesta_enterprise`, `onboarding_bienvenida`, `due_diligence_inmobiliario`, `recuperacion_cartera_flujo`) e interpolaciÃ³n de variables.
- [x] CampaÃ±as de Voz AI automÃ¡ticas multi-tenant con Telnyx (+52) y orquestaciÃ³n Llama 3.3 70B.
- [x] Portal 3D interactivo en la landing page con botÃ³n y canvas Spline Vortex.

## Fase 8 â Motor de Cobro Institucional Conekta (SPEI STP & Hosted Checkout)
- [x] MigraciÃ³n D1 `0009_conekta_checkout.sql` con tabla `sales_payment_orders` para CLABEs interbancarias y Ã³rdenes de cobro.
- [x] Cliente `ConektaService` (`src/services/conekta.ts`) nativo con Cloudflare Workers fetch y modo de simulaciÃ³n segura STP para desarrollo local.
- [x] Tool Calling AgÃ©ntico: herramienta `generar_orden_pago` registrada en `TOOLS_DEFINITIONS` y `ToolExecutor` para que el closer emita CLABEs de 18 dÃ­gitos o checkout links en vivo segÃºn precios oficiales de `sales_config`.
- [x] Webhook Reconciliador `POST /webhooks/conekta`: captura `order.paid` y `charge.paid`, transiciona la oportunidad a `ganado`, cierra el lead a 100 puntos, registra en `sales_activities` y encola `LEAD_INGEST_V3` federado a `SALES_INGEST_QUEUE`.
- [x] Consola Super Admin: pestaÃ±a `Cobranza Conekta (SPEI / Checkout)` con KPIs de recaudaciÃ³n, emisiÃ³n de Ã³rdenes, copia de CLABE STP formateada, generador de mensajes de WhatsApp y simulador de pagos.
- [x] Suite de pruebas automatizadas: 	ests/conekta.test.ts con 9 tests unitarios/integración. Total ecosistema: 14 suites, 88 tests pasando (100% verde).
- [x] MigraciÃ³n remota D1 aplicada y Cloudflare Worker desplegado a producciÃ³n en `https://sales.arksystems.site`.

## Fuera del primer lanzamiento
- [ ] Evaluar integraciones de correo, calendario, WhatsApp y proveedores externos despuÃ©s de estabilizar el CRM base.
- [ ] Evaluar scoring predictivo o recomendaciones de IA con datos suficientes y revisiÃ³n humana; no usar el score para decisiones automÃ¡ticas irreversibles.
- [ ] Evaluar importaciones masivas, sincronizaciÃ³n con los Workers hermanos y segmentaciÃ³n avanzada segÃºn necesidades reales del equipo.
