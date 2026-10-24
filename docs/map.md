# 📁 Project Map & Architecture Checklist — Ark Sales

> **Misión:** Motor de adquisición agéntico y enrutamiento por dolor del ecosistema ARK.  
> **Filosofía:** *"No vendemos productos aislados. Vendemos la infraestructura operativa de la economía agéntica."*  
> **Target:** Despachos contables en México.  
> **Estrategia comercial:** El **Bundle Total** (Ledger + Angel + Commerce por **$997 MXN/mes**) es la regla, no la excepción.

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
│   └── map.md                     # Este mapa y checklist arquitectónico
├── migrations/
│   ├── 0001_init.sql              # Tablas de ventas, leads, catálogo inicial
│   └── 0002_grok_skills.sql       # Registro de habilidades de computadora Grok Bot
├── src/
│   ├── index.ts                   # Hono App, exports DO, fetch, queue, scheduled
│   ├── types/
│   │   └── index.ts               # LEAD_INGEST_V3, D1 models, DO state, Env
│   ├── catalog/
│   │   └── service.ts             # Lectura D1 Fail-Closed (Cero Hardcoding)
│   ├── tools/
│   │   └── index.ts               # Tools Llama 3.3 (diagnóstico, catálogo, outbox, skills)
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
│   │   └── internal.ts            # APIs Grok Bot (/context, /skills/execute, /skills)
│   └── client/
│       ├── widgetScript.ts        # GET /widget.js (Script universal sin dependencias)
│       └── demoPage.ts            # GET / y /demo (Landing ARK Pulse v1.0)
└── tests/
    ├── catalog.test.ts            # Tests Fail-Closed y Cero Hardcoding
    ├── tools.test.ts              # Tests de diagnóstico de dolor y contrato V3
    ├── orchestrator.test.ts       # Tests de enrutamiento y cambio de agente
    ├── outbox.test.ts             # Tests de resiliencia y reintentos del outbox
    ├── grok_integration.test.ts   # Tests de context y disparo de skills de Grok
    └── widget.test.ts             # Tests del script de frontend y landing demo
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

### Verificación y Calidad de Código
- [x] Suite de 24 pruebas unitarias e integración en Vitest pasando al 100%:
  - [`tests/catalog.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/catalog.test.ts) (3/3)
  - [`tests/tools.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/tools.test.ts) (5/5)
  - [`tests/orchestrator.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/orchestrator.test.ts) (3/3)
  - [`tests/outbox.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/outbox.test.ts) (3/3)
  - [`tests/grok_integration.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/grok_integration.test.ts) (7/7)
  - [`tests/widget.test.ts`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/tests/widget.test.ts) (3/3)
- [x] Verificación estricta de TypeScript (`npm run typecheck`): **0 errores**.
- [x] Build y empaquetado de producción (`npm run build` / `wrangler deploy --dry-run`): **Exitoso (156.28 KiB)**.

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
- [ ] Acordar las etapas del pipeline: `nuevo`, `contactado`, `calificado`, `demo_agendada`, `propuesta_enviada`, `negociacion`, `ganado` y `perdido`.
- [ ] Definir los datos obligatorios para avanzar de etapa y quién puede realizar cada transición.
- [ ] Definir roles iniciales: administrador y vendedor; decidir si se requiere un rol de solo lectura.
- [ ] Acordar reglas para asignación de responsable, duplicados, motivos de pérdida, moneda y valor de oportunidad.
- [ ] Definir qué datos personales se recopilan, su propósito, retención, consentimiento y proceso de baja.
- [ ] **Criterio de salida:** reglas documentadas y aprobadas antes de fijar restricciones de base de datos o comportamiento de la interfaz.

## Fase 1 — Acceso privado, autorización y auditoría
- [ ] Elegir y documentar el mecanismo de autenticación para usuarios internos, compatible con Cloudflare Workers.
- [ ] Proteger todas las rutas del CRM; no confiar en que una ruta es privada por su nombre o ubicación.
- [ ] Implementar autorización por rol en el servidor, además de ocultar acciones no permitidas en la interfaz.
- [ ] Mantener los endpoints existentes de widget y webhooks separados del acceso al CRM; validar autenticidad, permisos y origen según cada integración.
- [ ] Registrar quién crea o modifica cuentas, contactos, oportunidades, tareas y cambios de etapa, sin guardar secretos ni datos innecesarios en los logs.
- [ ] **Criterio de salida:** pruebas demuestran que un usuario no autenticado no accede al CRM y que un usuario sin permisos no puede ejecutar acciones restringidas.

## Fase 2 — Modelo de datos y migración compatible
- [ ] Diseñar una migración D1 incremental, sin modificar ni borrar las migraciones ya aplicadas.
- [ ] Crear `sales_accounts` para el despacho/organización, con identificador, nombre, tamaño, ciudad, origen y fechas de creación/actualización.
- [ ] Crear `sales_contacts` para las personas de una cuenta, con nombre, correo, teléfono, cargo y consentimiento/preferencias de contacto cuando aplique.
- [ ] Relacionar `sales_leads` con cuenta y contacto mediante claves foráneas; conservar `lead_id` como identificador estable para conversaciones y contratos existentes.
- [ ] Crear `sales_opportunities` para etapa, responsable, productos de interés, valor estimado, moneda, fecha esperada de cierre y motivo de pérdida.
- [ ] Crear `sales_activities` para registrar notas, llamadas, correos, demos y cambios relevantes, con autor y fecha.
- [ ] Crear `sales_tasks` para próximas acciones, responsable, vencimiento, estado y vínculo con cuenta, contacto u oportunidad.
- [ ] Añadir índices y restricciones para búsquedas, fechas, estados e integridad; definir una estrategia para detectar y revisar posibles duplicados antes de fusionar registros.
- [ ] Migrar los leads existentes a cuentas y contactos de forma idempotente, preservando historial, IDs y referencias al outbox.
- [ ] **Criterio de salida:** migración probada contra datos representativos; los leads y conversaciones existentes siguen consultándose y no se crean duplicados al reejecutarla.

## Fase 3 — API y reglas del pipeline
- [ ] Implementar endpoints autenticados para listar, buscar, filtrar, crear y actualizar cuentas, contactos y oportunidades.
- [ ] Implementar endpoints para actividades y tareas, incluyendo completar, reasignar y consultar vencimientos.
- [ ] Validar en el servidor los campos, transiciones de etapa, relaciones entre entidades y permisos; devolver errores explícitos y consistentes.
- [ ] Añadir paginación y límites a las consultas para que las vistas no carguen todo D1 de una sola vez.
- [ ] Registrar cambios de etapa como actividad y mantener el historial conversacional existente asociado al lead correspondiente.
- [ ] Implementar reglas de deduplicación asistida (por ejemplo, correo normalizado y nombre de despacho) que permitan revisar coincidencias antes de fusionar.
- [ ] **Criterio de salida:** pruebas de rutas cubren permisos, validación, transiciones, paginación, deduplicación y conservación de relaciones existentes.

## Fase 4 — Interfaz de trabajo para el equipo
- [ ] Crear una sección privada del CRM, separada de la landing, el widget y la demo pública.
- [ ] Construir una vista de pipeline por etapa, con filtros por responsable, origen, producto y fecha de próxima acción.
- [ ] Construir fichas de cuenta y contacto con datos clave, oportunidades, actividades, tareas y conversaciones relacionadas.
- [ ] Permitir búsqueda, asignación de responsable, edición de datos y registro de actividades desde la ficha.
- [ ] Mostrar tareas vencidas y oportunidades abiertas sin próxima acción; confirmar acciones destructivas o difíciles de revertir.
- [ ] Incluir estados de carga, vacío y error; adaptar la interfaz a móvil y navegación accesible por teclado.
- [ ] **Criterio de salida:** un vendedor puede recorrer el flujo completo desde localizar un lead hasta registrar seguimiento sin usar SQL ni herramientas internas.

## Fase 5 — Seguimiento y automatizaciones controladas
- [ ] Crear automáticamente una tarea inicial cuando se califique un lead, indicando responsable y fecha según una regla acordada.
- [ ] Crear tareas de seguimiento al agendar una demo o enviar una propuesta; evitar duplicarlas ante reintentos.
- [ ] Detectar oportunidades abiertas sin actividad o con tarea vencida y mostrarlas en la bandeja de trabajo.
- [ ] Permitir notificaciones internas configurables; no enviar mensajes comerciales automáticos al prospecto sin consentimiento y controles explícitos.
- [ ] Integrar el cierre ganado/perdido con el flujo de entrega federada actual, conservando idempotencia y el patrón outbox.
- [ ] **Criterio de salida:** automatizaciones idempotentes, observables y probadas ante reintentos, errores y cambios manuales.

## Fase 6 — Reportes, calidad y preparación para producción
- [ ] Añadir métricas básicas: oportunidades por etapa, conversión entre etapas, ganadas/perdidas, tiempo de cierre y tareas vencidas.
- [ ] Verificar que las métricas respeten permisos y utilicen definiciones consistentes de etapa y periodo.
- [ ] Añadir pruebas de migración, API, autorización y flujos principales; ejecutar `npm test`, `npm run typecheck` y `npm run build`.
- [ ] Probar respaldo y restauración de D1, monitoreo de errores, retención de datos y procedimiento de recuperación.
- [ ] Probar el CRM con un grupo pequeño y datos de prueba; recoger feedback antes de importar o habilitar todos los leads.
- [ ] Desplegar primero en staging, verificar migración y permisos, y después habilitar producción con monitoreo y plan de reversión.
- [ ] **Criterio de salida:** el equipo puede operar el pipeline con datos consistentes, acceso controlado, métricas verificadas y procedimiento de recuperación documentado.

## Fuera del primer lanzamiento
- [ ] Evaluar integraciones de correo, calendario, WhatsApp y proveedores externos después de estabilizar el CRM base.
- [ ] Evaluar scoring predictivo o recomendaciones de IA con datos suficientes y revisión humana; no usar el score para decisiones automáticas irreversibles.
- [ ] Evaluar importaciones masivas, sincronización con los Workers hermanos y segmentación avanzada según necesidades reales del equipo.
