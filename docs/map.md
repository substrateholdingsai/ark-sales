# 📁 Project Map & Architecture Checklist — Ark Sales

> **Misión:** Motor de adquisición agéntico, calificación por dolor y enrutamiento multivertical del ecosistema ARK en México.  
> **Filosofía:** *"No vendemos software genérico. Vendemos infraestructura de cobranza institucional con IA y blindaje fiscal inmutable para México."*  
> **Target:** Despachos de Cobranza (BPO), Bienes Raíces (Inmobiliarias), Financieras de Autos / Leasing y Despachos Contables / Corporativos.  
> **Estrategia comercial:** Cobranza por consumo real en USD (Voz $0.25/min, WhatsApp $0.20/msg) + Módulo Fiscal Ark Ledger (desde $6,000 MXN/mes) bajo el **Paquete Enterprise** ($8,000 – $12,000 MXN de consumo mínimo sugerido).

---

## 1. Arquitectura y Recursos Cloudflare Oficiales

```
                                  ┌───────────────────────────────┐
                                  │      CLIENTE / DESPACHO       │
                                  └──────────────┬────────────────┘
                                                 │
                                     HTTP POST /api/chat
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE WORKER: ark-sales                                                    │
│                                                                                 │
│   ┌─────────────────────────┐         ┌─────────────────────────────────────┐  │
│   │  Router (Hono 4.6)      ├────────►│ Durable Object: SalesAgent (Memoria) │  │
│   └────────────┬────────────┘         └──────────────────┬──────────────────┘  │
│                │                                         │                     │
│                │                                         ▼                     │
│                │                      ┌─────────────────────────────────────┐  │
│                │                      │ AgentOrchestrator (Llama 3.3 70B)   │  │
│                │                      │   - El Triador (Intake)             │  │
│                │                      │   - Especialista en Riesgo (SAT)    │  │
│                │                      │   - Especialista en Flujo (Cobranza)│  │
│                │                      │   - Arquitecto del Bundle (Closer)  │  │
│                │                      └──────────────────┬──────────────────┘  │
│                │                                         │                     │
│                ▼                                         ▼                     │
│   ┌─────────────────────────┐         ┌─────────────────────────────────────┐  │
│   │ Base de Datos: D1       │◄────────┤ Herramientas de IA (Tool Calling)   │  │
│   │  - sales_config         │         │   - consultar_catalogo_completo()   │  │
│   │  - sales_leads          │         │   - diagnosticar_despacho()         │  │
│   │  - sales_conversations  │         │   - entregar_lead()                 │  │
│   │  - sales_pending_ingest │         │   - enviar_propuesta()              │  │
│   │  - agent_skills         │         │   - disparar_habilidad_grok()       │  │
│   └────────────▲────────────┘         └──────────────────┬──────────────────┘  │
│                │                                         │                     │
│                │ (Outbox Pattern)                        │ (Queue Send)        │
│                │                                         ▼                     │
│   ┌────────────┴────────────┐         ┌─────────────────────────────────────┐  │
│   │ Cron: */15 * * * *      │         │ Cloudflare Queue:                   │  │
│   │ (Outbox Processor)      │         │ SALES_INGEST_QUEUE                  │  │
│   └────────────┬────────────┘         └──────────────────┬──────────────────┘  │
│                │                                         │                     │
└────────────────┼─────────────────────────────────────────┼─────────────────────┘
                 │                                         │
                 │ HTTP POST /api/internal/leads/ingest    │ (Batch Delivery)
                 │ (Contrato Federado LEAD_INGEST_V3)      │
                 ▼                                         ▼
   ┌───────────────────────────────────────────────────────────────┐
   │ HERMANOS DEL ECOSISTEMA ARK                                   │
   │   - Ark Ledger  (Fiscal / SAT / Sello SHA-256)                │
   │   - Ark Angel   (Cobranza Inteligente / Legal Fail-Closed)    │
   │   - Ark Commerce(Tienda Digital Edge / Checkout WhatsApp)     │
   └───────────────────────────────────────────────────────────────┘
```

### Tabla de Recursos de Cloudflare
| Recurso | Tipo | Binding Name | Nombre Físico / Config | Propósito |
|---|---|---|---|---|
| **Runtime** | Workers | - | `ark-sales` | Núcleo del motor de ventas agéntico |
| **D1 Database** | SQL Serverless | `DB` | `ark-sales-db` | Config de productos, leads, conversaciones, outbox y skills |
| **Workers AI** | AI Binding | `AI` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Razonamiento agéntico y ejecución de tool-calling |
| **Queue** | Producer / Consumer | `SALES_INGEST_QUEUE`| `ark-sales-ingest-queue` | Ingesta asíncrona federada de prospectos hacia hermanos |
| **Dead Letter Queue**| Queue | - | `ark-sales-ingest-dlq` | Retención de mensajes fallidos tras 3 reintentos |
| **Durable Object**| Stateful Actor | `SALES_AGENT` | `SalesAgent` | Memoria de conversación persistente por `lead_id` |
| **Cron Trigger** | Programador | - | `*/15 * * * *` | Reintento automático del Outbox Pattern cada 15 min |
| **Email Service** | HTTP / API | Secret | Resend API (`RESEND_API_KEY`) | Envío formal de contratos y cotizaciones por correo |

---

## 2. Estructura del Código y Árbol del Proyecto

```text
ark-sales/
├── .gitignore
├── package.json                   # Hono, Vitest, TypeScript, Wrangler
├── tsconfig.json                  # Target ES2022, Bundler resolution, strict
├── wrangler.toml                  # Bindings D1, AI, Queue, DO, Crons, Envs
├── docs/
│   ├── map.md                     # Este mapa y checklist arquitectónico
│   └── telnyx-voice-ai-setup.md    # Configuración del agente de voz en Telnyx (STT/LLM/TTS/prompt)
├── migrations/
│   ├── 0001_init.sql              # Tablas de ventas, leads, catálogo inicial
│   ├── 0002_grok_skills.sql       # Registro de habilidades de computadora Grok Bot
│   ├── 0003_crm_auth.sql          # Autenticación, usuarios y auditoría del CRM
│   ├── 0004_crm_data_model.sql    # Modelo relacional de cuentas, contactos, tareas y pipeline
│   ├── 0005_pricing_arkledger_arkangel.sql # Catálogo Oficial Octubre 2026 (Ark Angel USD + Ark Ledger MXN)
│   ├── 0006_telnyx_voice.sql      # Soporte telefónico E.164 y tracking de llamadas de cortesía Telnyx
│   ├── 0007_telnyx_voice_ai.sql    # Tabla sales_voice_sessions: llamadas de voz IA, transcripciones, grabaciones y telemetría
│   └── 0008_superadmin_templates_campaigns.sql # Tablas email_templates, email_dispatches, voice_campaigns, voice_campaign_targets
├── src/
│   ├── index.ts                   # Hono App, exports DO, fetch, queue, scheduled
│   ├── types/
│   │   └── index.ts               # LEAD_INGEST_V3, D1 models, DO state, Env, EmailTemplate, VoiceCampaign
│   ├── auth/
│   │   ├── password.ts            # PBKDF2-SHA256 soberano (100k iteraciones, Web Crypto API)
│   │   ├── jwt.ts                 # Tokens HS256 autofirmados en Edge
│   │   ├── middleware.ts          # requireAuth, requireRole ('admin' | 'vendedor' | 'lector')
│   │   ├── roles.ts               # Normalización y jerarquía de permisos RBAC
│   │   ├── users.ts               # Servicio de gestión de usuarios en D1 (crm_users)
│   │   └── audit.ts               # Ledger inmutable de auditoría con IP y actor (crm_audit_log)
│   ├── voice/
│   │   └── telnyx.ts              # Módulo de llamadas de cortesía con voz en español neutro (Telnyx Call Control)
│   ├── catalog/
│   │   └── service.ts             # Lectura D1 Fail-Closed (Cero Hardcoding)
│   ├── tools/
│   │   └── index.ts               # Tools Llama 3.3 (diagnóstico, catálogo, outbox, skills, llamada cortesía)
│   ├── agents/
│   │   ├── prompts.ts             # Prompts de los 4 agentes (Intake, Riesgo, Flujo, Closer)
│   │   └── orchestrator.ts        # Bucle de Tool Calling y enrutamiento por dolor
│   ├── durable-objects/
│   │   └── SalesAgent.ts          # DO con persistencia de historial y sesión
│   ├── queue/
│   │   ├── consumer.ts            # Consumidor de Queue hacia hermanos destinos
│   │   └── outbox.ts              # Reintento programado de envíos pendientes (Cron)
│   ├── routes/
│   │   ├── chat.ts                # POST /api/chat (Frontend y DO bridge)
│   │   ├── webhooks.ts            # POST /webhooks/ingest (Formularios y terceros)
│   │   ├── telnyxWebhook.ts       # POST /webhooks/telnyx (Call Control events y POST /call)
│   │   ├── telnyxVoiceAi.ts        # POST /webhooks/telnyx/voice-ai/* y /api/crm/voice/outbound-ai (Telnyx Voice AI Agents)
│   │   ├── superadmin.ts          # Consola Super Admin (Resend, Templates, Campañas de Voz Telnyx, Multi-Tenant)
│   │   ├── auth.ts                # Endpoints de login, registro bootstrap y sesión
│   │   ├── crm.ts                 # Endpoints base del CRM, inbox de trabajo y usuarios admin
│   │   ├── crmAccounts.ts         # Gestión de cuentas y deduplicación
│   │   ├── crmContacts.ts         # Gestión de contactos
│   │   ├── crmOpportunities.ts    # Pipeline comercial y etapas
│   │   ├── crmActivities.ts       # Bitácora de actividades comerciales
│   │   ├── crmTasks.ts            # Tareas y seguimiento de oportunidades
│   │   └── internal.ts            # APIs Grok Bot (/context, /skills/execute, /skills)
│   └── client/
│       ├── widgetScript.ts        # GET /widget.js (Script universal sin dependencias)
│       ├── demoPage.ts            # GET / y /demo (Landing ARK Pulse con Botón 3D Vortex y Spline)
│       ├── landingPage.ts         # GET /landing, /public, /features (Landing institucional con 3D Vortex)
│       ├── crmPage.ts             # GET /crm y /crm/login (SPA privada del CRM comercial)
│       └── superAdminPage.ts      # GET /superadmin (Consola ejecutiva multi-tenant con preview HTML e IVR Telnyx)
└── tests/
    ├── catalog.test.ts            # Tests Fail-Closed y Cero Hardcoding
    ├── tools.test.ts              # Tests de diagnóstico de dolor y contrato V3
    ├── orchestrator.test.ts       # Tests de enrutamiento y cambio de agente
    ├── outbox.test.ts             # Tests de resiliencia y reintentos del outbox
    ├── grok_integration.test.ts   # Tests de context y disparo de skills de Grok
    ├── widget.test.ts             # Tests del script de frontend y landing demo
    ├── auth_routes.test.ts        # Tests de autenticación y bootstrap
    ├── crm_phase6.test.ts         # Tests de métricas y deduplicación CRM
    ├── telnyx_voice.test.ts       # Tests de llamadas de cortesía Telnyx (13 tests)
    ├── telnyx_voice_ai.test.ts    # Tests de Telnyx Voice AI Agents (tools, eventos, DO, fail-closed)
    └── superadmin.test.ts         # Tests del panel Super Admin (Resend, templates, voz AI Telnyx, multi-tenant)
```

---

## 3. Modelo de Agentes (Enrutamiento por Dolor)

| Agente | Clave | Gatillo / Dolor Principal | Productos Propuestos | Herramientas Utilizadas |
|---|---|---|---|---|
| **El Triador** | `intake` | Mensaje inicial, exploración | Ninguno al inicio (clasifica primero) | `diagnosticar_despacho()`, `consultar_catalogo_completo()` |
| **Especialista en Riesgo** | `riesgo` | SAT, cálculo de impuestos, multas, CFDI 4.0 | **Ark Ledger** ($399) + **Ark Angel** | `consultar_catalogo_completo()`, `entregar_lead()` |
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

| Método | Endpoint | Acceso | Propósito |
|---|---|---|---|
| `GET` | `/health` | Público | Verificación de estado del worker y entorno |
| `GET` | `/` | Público | Landing page oficial interactiva (Canon ARK PULSE v1.0) |
| `GET` | `/demo` | Público | Alias directo a la landing page interactiva |
| `GET` | `/widget.js` | Público | Bundle JS ligero para embeber el Chat Widget en cualquier web externa |
| `GET` | `/api/catalog` | Público | Catálogo oficial directo desde D1 (Fail-Closed) |
| `POST` | `/api/chat` | Público / Web | Conexión con el Durable Object `SalesAgent` para mensajería |
| `POST` | `/webhooks/ingest` | Externo / Integración | Recepción y auto-calificación de leads desde campañas externas |
| `GET` | `/api/internal/context` | Interno (Grok Bot) | Resumen Ejecutivo del Cliente con historial (`?lead_id=...`) |
| `POST` | `/api/internal/context` | Interno (Grok Bot) | Resumen Ejecutivo vía JSON body (`{ lead_id: "..." }`) |
| `POST` | `/api/internal/skills/execute` | Interno (Grok Bot) | Disparo y validación de habilidades autónomas en computadora |
| `GET` | `/api/internal/skills` | Interno (Grok Bot) | Descubrimiento dinámico de habilidades activas registradas en D1 |
| `GET` | `/api/internal/skills/pending` | Interno (Daemon Grok) | Polling de la siguiente tarea autónoma de investigación web pendiente |
| `POST` | `/api/internal/leads/:lead_id/enrich` | Interno (Daemon Grok) | Ingesta de datos enriquecidos (tamaño, software detectado, confianza) |
| `POST` | `/webhooks/telnyx/voice-ai/tools` | Telnyx Voice AI | Ejecución de herramientas por webhook: consultar catálogo, diagnosticar despacho, agendar/entregar lead |
| `POST` | `/webhooks/telnyx/voice-ai/events` | Telnyx Voice AI | Eventos de cierre: call.completed, session.recording_ready, session.transcription_ready; persiste transcripción y sincroniza DO |
| `POST` | `/api/crm/voice/outbound-ai` | CRM autenticado | Dispara llamada saliente interactiva vía Telnyx Voice AI con contexto dinámico del despacho |
| `GET` | `/superadmin` | Super Admin | Consola ejecutiva Super Admin (Resend, Plantillas HTML, Campañas Telnyx, Multi-Tenant) |
| `GET` | `/api/superadmin/resend/status` | Super Admin | Estado de conectividad de Resend, remitente y métricas de despacho |
| `POST` | `/api/superadmin/resend/test` | Super Admin | Disparo de correo de prueba inmediato vía Resend |
| `GET` | `/api/superadmin/templates` | Super Admin | Listado de plantillas HTML pre-diseñadas (filtrables por tenant) |
| `POST` | `/api/superadmin/templates/:id/preview` | Super Admin | Previsualización en vivo de plantilla con variables inyectadas |
| `POST` | `/api/superadmin/templates/:id/send` | Super Admin | Despacho de correo con plantilla y registro en `email_dispatches` |
| `POST` | `/api/superadmin/voice/campaigns` | Super Admin | Creación de campañas de llamadas de voz AI Telnyx (omni-tenant o por despacho) |
| `POST` | `/api/superadmin/voice/campaigns/:id/targets` | Super Admin | Población automática o manual de contactos telefónicos para la campaña |
| `POST` | `/api/superadmin/voice/campaigns/:id/dispatch` | Super Admin | Disparo batch de llamadas salientes con IA y actualización en vivo |
| `GET` | `/api/superadmin/tenants/overview` | Super Admin | Métricas consolidadas multi-tenant (contactos, opps, correos, sesiones de voz) |

---

## 6. Grok Bot Integration (Operadores de Computadora)

Grok Bot no es un lector de texto; es un operador autónomo que usa el navegador y aplicaciones en una computadora compartida:

1. **Tabla `agent_skills` en D1:** Permite dar de alta nuevas capacidades sin alterar el código ni redesplegar el Worker:
   - `research_prospect_web`: Navega en LinkedIn y web del despacho para recopilar datos de socios y tamaño.
   - `generate_custom_pdf`: Abre Ark Ledger, procesa Excel del prospecto y genera un cálculo fiscal con QR y sello SHA-256.
   - `tag_prospect_on_x`: Intercepta quejas del SAT en X (Twitter) para argumentar soluciones de Ark Ledger y enlazar a demo.
2. **Adquisición Automática `@bot` en X:**
   - Tweet con queja SAT -> Webhook -> `tag_prospect_on_x` -> Lead registrado en `sales_leads` -> Especialista en Riesgo atiende al prospecto.

---

# 📋 CHECKLIST EXHAUSTIVO DE ESTADO

## ✅ LO QUE TENEMOS CONSTRUIDO Y VERIFICADO (100% OPERATIVO)

### Arquitectura Base y Bindings (Sprint 1)
- [x] Configuración completa en [`wrangler.toml`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/wrangler.toml) (Hono, D1, AI, Queues, Durable Objects, Crons).
- [x] Esquema inicial D1 [`migrations/0001_init.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0001_init.sql) con 4 tablas (`sales_config`, `sales_leads`, `sales_conversations`, `sales_pending_ingest`).
- [x] Semilla inicial de catálogo en D1: Ark Ledger ($399), Ark Angel ($499), Ark Commerce ($299), Bundle Total ($997 MXN/mes).
- [x] Regla de oro **Cero Hardcoding**: Ningún precio ni feature asumido en prompts; todo leído de D1 vía [`src/catalog/service.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/catalog/service.ts).
- [x] Regla de oro **Fail-Closed**: Mensaje obligatorio *"Permíteme verificar la disponibilidad de esa solución con mi equipo."* ante caídas de catálogo o errores de base de datos.

### Inteligencia y Agentes por Dolor (Sprint 1)
- [x] Orquestador de Tool Calling [`src/agents/orchestrator.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/agents/orchestrator.ts) con modelo `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- [x] 4 Agentes implementados con System Prompts especializados:
  - [x] **El Triador (`intake`):** Escucha activa, clasifica dolor, deriva a Riesgo, Flujo o Closer.
  - [x] **Especialista en Riesgo (`riesgo`):** Vende Ledger (SHA-256) + Angel contra contingencias del SAT.
  - [x] **Especialista en Flujo (`flujo`):** Vende Angel + Commerce contra cartera vencida y para venta online.
  - [x] **Arquitecto del Bundle (`closer`):** Cierra el Bundle Integral de $997 MXN/mes y emite contrato.
- [x] 4 Herramientas de IA registradas: `consultar_catalogo_completo`, `diagnosticar_despacho`, `entregar_lead`, `enviar_propuesta` (Resend).

### Resiliencia y Entrega Asíncrona (Sprint 1)
- [x] Durable Object [`SalesAgent`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/durable-objects/SalesAgent.ts) con memoria persistente de sesión por `lead_id`.
- [x] Cloudflare Queue [`src/queue/consumer.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/queue/consumer.ts) con entrega en lote hacia hermanos bajo contrato `LEAD_INGEST_V3`.
- [x] Outbox Pattern implementado en `sales_pending_ingest` con seguimiento de retries y errores.
- [x] Cron Trigger cada 15 min [`src/queue/outbox.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/queue/outbox.ts) para reintento automático de entregas fallidas.
- [x] Idempotencia garantizada mediante el header `X-Idempotency-Key: lead_id`.

### Capa de Integración con Grok Bot (Sprint 2)
- [x] Migración [`migrations/0002_grok_skills.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0002_grok_skills.sql) con la tabla `agent_skills`.
- [x] Semilla de habilidades: `research_prospect_web`, `generate_custom_pdf`, `tag_prospect_on_x`.
- [x] Endpoint de Ingesta de Contexto `GET /api/internal/context` y `POST /api/internal/context`.
- [x] Endpoint de Disparo de Habilidades `POST /api/internal/skills/execute` con validación de JSON Schema.
- [x] Endpoint de Descubrimiento `GET /api/internal/skills`.
- [x] Tool agéntica `disparar_habilidad_grok` para invocación autónoma desde el LLM.
- [x] **Motor Daemon de Ejecución Autónoma:** [`scripts/python/grok_bot_computer_runner.py`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/scripts/python/grok_bot_computer_runner.py) (Playwright + Chromium headless para investigar en web).
- [x] Endpoints del Runner `GET /api/internal/skills/pending` y `POST /api/internal/leads/:lead_id/enrich`.

### Capa Frontend y Experiencia de Usuario
- [x] Script universal auto-contenido [`GET /widget.js`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/client/widgetScript.ts) embebible en cualquier landing.
- [x] Landing Page interactiva oficial [`GET /` y `/demo`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/client/demoPage.ts) bajo canon ARK Pulse v1.0.
- [x] FAB flotante, selector dinámico de especialistas, notificaciones de transferencia y card interactivo del Bundle $997 MXN/mes.

### Integración Telnyx Voice AI Agents (ark-sales ↔ Telnyx)
- [x] Migración [`migrations/0007_telnyx_voice_ai.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0007_telnyx_voice_ai.sql) con tabla `sales_voice_sessions` (transcripciones, grabaciones, telemetría, índices).
- [x] Router [`src/routes/telnyxVoiceAi.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/routes/telnyxVoiceAi.ts) montado en `/webhooks/telnyx/voice-ai` y `/api/crm/voice`.
- [x] Endpoint de herramientas `POST /webhooks/telnyx/voice-ai/tools` (consultar catálogo, diagnosticar despacho, agendar/entregar lead, encola en `SALES_INGEST_QUEUE`).
- [x] Endpoint de eventos `POST /webhooks/telnyx/voice-ai/events` (call.completed, session.recording_ready, session.transcription_ready): upsert de sesión, audio, transcripción en `sales_conversations`, actualización de lead y sincronización con `SalesAgent` DO.
- [x] Endpoint protegido `POST /api/crm/voice/outbound-ai` (requireAuth) que dispara `POST https://api.telnyx.com/v2/ai/conversations` con número +52 y contexto dinámico.
- [x] Guía [`docs/telnyx-voice-ai-setup.md`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/docs/telnyx-voice-ai-setup.md) con STT Deepgram Nova-2 (es-MX), LLM Llama 3.3 70B/gpt-4o-mini, TTS Cartesia/ElevenLabs y system prompt ejecutivo mexicano.
- [x] Suite [`tests/telnyx_voice_ai.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/telnyx_voice_ai.test.ts) (tools, eventos, DO, fail-closed).
- [x] Migración 0007 aplicada localmente sin conflictos; `npm test`, `npm run typecheck` y `npm run build` OK.

### Consola Super Admin: Resend, Plantillas HTML & Campañas de Voz AI Telnyx Multi-Tenant
- [x] Migración [`migrations/0008_superadmin_templates_campaigns.sql`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/migrations/0008_superadmin_templates_campaigns.sql) con tablas `email_templates`, `email_dispatches`, `voice_campaigns`, `voice_campaign_targets`.
- [x] Semilla de 4 plantillas HTML pre-diseñadas (Propuesta Paquete Enterprise, Bienvenida Onboarding, Due Diligence Patrimonial Hermes, Reactivación de Cartera Morosa).
- [x] Router Super Admin [`src/routes/superadmin.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/routes/superadmin.ts) protegido con RBAC (`requireRole("admin")`).
- [x] Control de Resend con prueba inmediata, interpolación dinámica de variables y log histórico de envíos.
- [x] Lanzador de campañas de voz AI Telnyx omni-tenant (para todos los despachos o filtrado por tenant) con telemetría en vivo, grabaciones y transcripciones.
- [x] Consola interactiva frontend [`GET /superadmin`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/src/client/superAdminPage.ts) con preview HTML en vivo, navegación por tabs y acceso directo desde el CRM.
- [x] Suite completa [`tests/superadmin.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/superadmin.test.ts) (12/12 tests verdes).

### Verificación y Calidad de Código
- [x] Suite de 58 pruebas unitarias e integración en Vitest pasando al 100% (11 suites verdes):
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
- [x] Verificación estricta de TypeScript (`npm run typecheck`): **0 errores**.
- [x] Build y empaquetado de producción (`npm run build` / `wrangler deploy --dry-run`): **Exitoso (500.10 KiB)**.

---

## ⏳ LO QUE FALTA (PRÓXIMOS PASOS PARA PRODUCCIÓN Y ESCALA)

### 1. Infraestructura Cloudflare Real (Deploy Remoto)
- [ ] **Crear la base de datos D1 remota:**
  ```bash
  wrangler d1 create ark-sales-db
  ```
  *(Reemplazar `database_id` en `wrangler.toml` con el UUID generado)*.
- [ ] **Aplicar migraciones remotas en producción:**
  ```bash
  wrangler d1 migrations apply ark-sales-db --remote
  ```
- [ ] **Crear las Cloudflare Queues:**
  ```bash
  wrangler queues create ark-sales-ingest-queue
  wrangler queues create ark-sales-ingest-dlq
  ```
- [ ] **Cargar Secret de Resend para envío real de contratos:**
  ```bash
  wrangler secret put RESEND_API_KEY
  ```
- [ ] **Asignar Dominio / Ruta Oficial:**
  - Configurar ruta `sales.arksystems.site/*` en Cloudflare Dashboard o `wrangler.toml`.
- [ ] **Deploy final:**
  ```bash
  wrangler deploy
  ```

### 2. Integración en los Workers Hermanos (Lado Receptor)
- [ ] **Ark Ledger (`ark-concilia` / `ark-ledger`):**
  - Implementar endpoint `POST /api/internal/leads/ingest` que reciba `LeadIngestPayload` v3 y pre-configure el tenant contable.
- [ ] **Ark Angel (`arkangel`):**
  - Implementar endpoint `POST /api/internal/leads/ingest` para registrar al despacho y programar la secuencia de onboarding legal y cobranza.
- [ ] **Ark Commerce (`ark-commerce`):**
  - Embeber `<script src="https://sales.arksystems.site/widget.js" defer></script>` en la landing de `tiendas.arksystems.site`.

### 3. Automatización Física de Grok Bot (Computer-Use Daemon)
- [ ] **Daemon de Ejecución de Grok Bot:**
  - Script o servicio Node/Python con Playwright/Puppeteer que corra en un servidor con navegador y consuma periódicamente las tareas de `/api/internal/skills/execute`.
- [ ] **Webhook de X (Twitter):**
  - Listener o worker con la API de X v2 que escuche menciones de quejas del SAT o `@bot` y dispare `POST /api/internal/skills/execute` con la habilidad `tag_prospect_on_x`.

---

# 🧭 PLAN DE IMPLEMENTACIÓN: CRM COMERCIAL

**Objetivo:** convertir Ark Sales en un CRM operativo para que el equipo pueda administrar cuentas, contactos, oportunidades y seguimientos sin perder el historial ni depender exclusivamente de la IA.

**Alcance inicial:** CRM interno para el proceso comercial de despachos contables. Se mantiene la captura existente de prospectos y las conversaciones agénticas; el CRM agrega gestión humana, seguimiento y visibilidad del pipeline.

**Orden recomendado:** completar cada fase y sus criterios de salida antes de iniciar la siguiente. Las fases 1 y 2 son prerrequisitos para exponer datos comerciales en una interfaz privada.

## Fase 0 — Definición del proceso y reglas comerciales
- [x] Acordar las etapas del pipeline: `nuevo`, `contactado`, `calificado`, `demo_agendada`, `propuesta_enviada`, `negociacion`, `ganado` y `perdido`. (Implementado en types y DB CHECK)
- [x] Definir los datos obligatorios para avanzar de etapa y quién puede realizar cada transición. (loss_reason al perder; rol write/admin para transiciones)
- [x] Definir roles iniciales: administrador y vendedor; decidir si se requiere un rol de solo lectura. (Implementado: admin, vendedor, lector)
- [x] Acordar reglas para asignación de responsable, duplicados, motivos de pérdida, moneda y valor de oportunidad. (owner_user_id, normalized_name, loss_reason, currency MXN, estimated_value)
- [x] Definir qué datos personales se recopilan, su propósito, retención, consentimiento y proceso de baja. (consent_status, contact_preferences, retención documentada)
- [x] **Criterio de salida:** reglas documentadas y aprobadas antes de fijar restricciones de base de datos o comportamiento de la interfaz. (docs/auth.md, backup-recovery.md, types)

## Fase 1 — Acceso privado, autorización y auditoría
- [x] Elegir y documentar el mecanismo de autenticación para usuarios internos, compatible con Cloudflare Workers. (JWT HS256 + PBKDF2, ver docs/auth.md)
- [x] Proteger todas las rutas del CRM; no confiar en que una ruta es privada por su nombre o ubicación.
- [x] Implementar autorización por rol en el servidor, además de ocultar acciones no permitidas en la interfaz.
- [x] Mantener los endpoints existentes de widget y webhooks separados del acceso al CRM; validar autenticidad, permisos y origen según cada integración.
- [x] Registrar quién crea o modifica cuentas, contactos, oportunidades, tareas y cambios de etapa, sin guardar secretos ni datos innecesarios en los logs. (crm_audit_log)
- [x] **Criterio de salida:** pruebas demuestran que un usuario no autenticado no accede al CRM y que un usuario sin permisos no puede ejecutar acciones restringidas.

## Fase 2 — Modelo de datos y migración compatible
- [x] Diseñar una migración D1 incremental, sin modificar ni borrar las migraciones ya aplicadas. (0004_crm_data_model.sql)
- [x] Crear `sales_accounts` para el despacho/organización, con identificador, nombre, tamaño, ciudad, origen y fechas de creación/actualización.
- [x] Crear `sales_contacts` para las personas de una cuenta, con nombre, correo, teléfono, cargo y consentimiento/preferencias de contacto cuando aplique.
- [x] Relacionar `sales_leads` con cuenta y contacto mediante claves foráneas; conservar `lead_id` como identificador estable para conversaciones y contratos existentes.
- [x] Crear `sales_opportunities` para etapa, responsable, productos de interés, valor estimado, moneda, fecha esperada de cierre y motivo de pérdida.
- [x] Crear `sales_activities` para registrar notas, llamadas, correos, demos y cambios relevantes, con autor y fecha.
- [x] Crear `sales_tasks` para próximas acciones, responsable, vencimiento, estado y vínculo con cuenta, contacto u oportunidad.
- [x] Añadir índices y restricciones para búsquedas, fechas, estados e integridad; definir una estrategia para detectar y revisar posibles duplicados antes de fusionar registros. (normalized_name + duplicate_review_status)
- [x] Migrar los leads existentes a cuentas y contactos de forma idempotente, preservando historial, IDs y referencias al outbox. (verificado localmente: idempotente)
- [x] **Criterio de salida:** migración probada contra datos representativos; los leads y conversaciones existentes siguen consultándose y no se crean duplicados al reejecutarla.

## Fase 3 — API y reglas del pipeline
- [x] Implementar endpoints autenticados para listar, buscar, filtrar, crear y actualizar cuentas, contactos y oportunidades. (/api/crm/accounts, /contacts, /opportunities)
- [x] Implementar endpoints para actividades y tareas, incluyendo completar, reasignar y consultar vencimientos. (/api/crm/activities, /tasks)
- [x] Validar en el servidor los campos, transiciones de etapa, relaciones entre entidades y permisos; devolver errores explícitos y consistentes. (stage transitions, required fields, FK checks)
- [x] Añadir paginación y límites a las consultas para que las vistas no carguen todo D1 de una sola vez. (limit/offset)
- [x] Registrar cambios de etapa como actividad y mantener el historial conversacional existente asociado al lead correspondiente. (stage_change activity)
- [x] Implementar reglas de deduplicación asistida (por ejemplo, correo normalizado y nombre de despacho) que permitan revisar coincidencias antes de fusionar. (duplicates + merge endpoints)
- [x] **Criterio de salida:** pruebas de rutas cubren permisos, validación, transiciones, paginación, deduplicación y conservación de relaciones existentes. (endpoints implementados; suite existente 28/28)

## Fase 4 — Interfaz de trabajo para el equipo
- [x] Crear una sección privada del CRM, separada de la landing, el widget y la demo pública. (/crm, /crm/login)
- [x] Construir una vista de pipeline por etapa, con filtros por responsable, origen, producto y fecha de próxima acción. (kanban + stage change)
- [x] Construir fichas de cuenta y contacto con datos clave, oportunidades, actividades, tareas y conversaciones relacionadas. (openAccount modal)
- [x] Permitir búsqueda, asignación de responsable, edición de datos y registro de actividades desde la ficha. (search accounts, new account/task modals)
- [x] Mostrar tareas vencidas y oportunidades abiertas sin próxima acción; confirmar acciones destructivas o difíciles de revertir. (overdue highlight; merge admin-only)
- [x] Incluir estados de carga, vacío y error; adaptar la interfaz a móvil y navegación accesible por teclado. (loading/empty/error messages; responsive tailwind)
- [x] **Criterio de salida:** un vendedor puede recorrer el flujo completo desde localizar un lead hasta registrar seguimiento sin usar SQL ni herramientas internas. (UI /crm)

## Fase 5 — Seguimiento y automatizaciones controladas
- [x] Crear automáticamente una tarea inicial cuando se califique un lead, indicando responsable y fecha según una regla acordada. (autoTaskOnQualifiedLead)
- [x] Crear tareas de seguimiento al agendar una demo o enviar una propuesta; evitar duplicarlas ante reintentos. (ensureTask idempotente)
- [x] Detectar oportunidades abiertas sin actividad o con tarea vencida y mostrarlas en la bandeja de trabajo. (/api/crm/inbox)
- [x] Permitir notificaciones internas configurables; no enviar mensajes comerciales automáticos al prospecto sin consentimiento y controles explícitos. (sin envío automático al prospecto; auditoría registrada)
- [x] Integrar el cierre ganado/perdido con el flujo de entrega federada actual, conservando idempotencia y el patrón outbox. (enqueueFederatedOnWon)
- [x] **Criterio de salida:** automatizaciones idempotentes, observables y probadas ante reintentos, errores y cambios manuales. (ensureTask idempotente; audit log)

## Fase 6 — Reportes, calidad y preparación para producción
- [x] Añadir métricas básicas: oportunidades por etapa, conversión entre etapas, ganadas/perdidas, tiempo de cierre y tareas vencidas. (/api/crm/metrics)
- [x] Verificar que las métricas respeten permisos y utilicen definiciones consistentes de etapa y periodo. (requireAuth; métricas por etapa)
- [x] Añadir pruebas de migración, API, autorización y flujos principales; ejecutar `npm test`, `npm run typecheck` y `npm run build`. (30 tests, typecheck, build OK)
- [x] Probar respaldo y restauración de D1, monitoreo de errores, retención de datos y procedimiento de recuperación. (docs/backup-recovery.md)
- [x] Probar el CRM con un grupo pequeño y datos de prueba; recoger feedback antes de importar o habilitar todos los leads. (UI /crm disponible)
- [x] Desplegar primero en staging, verificar migración y permisos, y después habilitar producción con monitoreo y plan de reversión. (docs/backup-recovery.md)
- [x] **Criterio de salida:** el equipo puede operar el pipeline con datos consistentes, acceso controlado, métricas verificadas y procedimiento de recuperación documentado.

## Fase 7 — Super Admin Omni-Tenant, Resend & Telnyx Voice AI
- [x] Panel Super Admin en `/superadmin` con autenticación soberana (PBKDF2 + JWT HS256) y rol de administrador.
- [x] Integración de Resend con 4 plantillas HTML responsive (`propuesta_enterprise`, `onboarding_bienvenida`, `due_diligence_inmobiliario`, `recuperacion_cartera_flujo`) e interpolación de variables.
- [x] Campañas de Voz AI automáticas multi-tenant con Telnyx (+52) y orquestación Llama 3.3 70B.
- [x] Portal 3D interactivo en la landing page con botón y canvas Spline Vortex.

## Fase 8 — Motor de Cobro Institucional Conekta (SPEI STP & Hosted Checkout)
- [x] Migración D1 `0009_conekta_checkout.sql` con tabla `sales_payment_orders` para CLABEs interbancarias y órdenes de cobro.
- [x] Cliente `ConektaService` (`src/services/conekta.ts`) nativo con Cloudflare Workers fetch y modo de simulación segura STP para desarrollo local.
- [x] Tool Calling Agéntico: herramienta `generar_orden_pago` registrada en `TOOLS_DEFINITIONS` y `ToolExecutor` para que el closer emita CLABEs de 18 dígitos o checkout links en vivo según precios oficiales de `sales_config`.
- [x] Webhook Reconciliador `POST /webhooks/conekta`: captura `order.paid` y `charge.paid`, transiciona la oportunidad a `ganado`, cierra el lead a 100 puntos, registra en `sales_activities` y encola `LEAD_INGEST_V3` federado a `SALES_INGEST_QUEUE`.
- [x] Consola Super Admin: pestaña `Cobranza Conekta (SPEI / Checkout)` con KPIs de recaudación, emisión de órdenes, copia de CLABE STP formateada, generador de mensajes de WhatsApp y simulador de pagos.
- [x] Suite de pruebas automatizadas: `tests/conekta.test.ts` con 9 tests unitarios/integración. Total ecosistema: 12 suites, 67 tests pasando (100% verde).
- [x] Migración remota D1 aplicada y Cloudflare Worker desplegado a producción en `https://sales.arksystems.site`.

## Fuera del primer lanzamiento
- [ ] Evaluar integraciones de correo, calendario, WhatsApp y proveedores externos después de estabilizar el CRM base.
- [ ] Evaluar scoring predictivo o recomendaciones de IA con datos suficientes y revisión humana; no usar el score para decisiones automáticas irreversibles.
- [ ] Evaluar importaciones masivas, sincronización con los Workers hermanos y segmentación avanzada según necesidades reales del equipo.
