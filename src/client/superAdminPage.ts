export function renderSuperAdminHtml(): string {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARK Systems · Consola Super Admin</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
body { font-family: 'Inter', sans-serif; background-color: #020617; color: #f8fafc; }
.font-mono { font-family: 'JetBrains Mono', monospace; }
.glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(14px); border: 1px solid rgba(51, 65, 85, 0.4); }
.glass-card { background: rgba(30, 41, 59, 0.4); backdrop-filter: blur(8px); border: 1px solid rgba(71, 85, 105, 0.3); }
.grid-bg { background-image: linear-gradient(rgba(51,65,85,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(51,65,85,0.08) 1px, transparent 1px); background-size: 32px 32px; }
.preview-iframe { width: 100%; height: 520px; border: none; border-radius: 8px; background: #020617; }
</style>
</head>
<body class="grid-bg min-h-screen">
  <!-- Topbar -->
  <nav class="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-gradient-to-tr from-blue-700 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
          <i data-lucide="shield-alert" class="text-white w-5 h-5"></i>
        </div>
        <div>
          <span class="font-extrabold text-base tracking-tight">ARK <span class="text-blue-400">SUPER ADMIN</span></span>
          <span class="text-[10px] uppercase font-mono px-2 py-0.5 ml-2 bg-blue-900/60 text-blue-300 rounded border border-blue-700/50">Multi-Tenant Core</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <a href="/crm" class="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Volver al CRM
        </a>
        <div id="adminBadge" class="font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-md border border-slate-800">
          admin@arksystems.site
        </div>
        <button id="logoutBtn" class="text-rose-400 hover:text-rose-300 font-medium">Salir</button>
      </div>
    </div>
  </nav>

  <!-- Navigation Tabs -->
  <div class="max-w-7xl mx-auto px-4 pt-6 pb-2">
    <div class="flex border-b border-slate-800 gap-2">
      <button data-tab="resend" class="tab-btn px-4 py-2.5 text-sm font-semibold border-b-2 border-blue-500 text-blue-400 flex items-center gap-2">
        <i data-lucide="mail" class="w-4 h-4"></i> Resend & Plantillas HTML
      </button>
      <button data-tab="voice" class="tab-btn px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        <i data-lucide="phone-call" class="w-4 h-4"></i> Campañas de Voz AI Telnyx
      </button>
      <button data-tab="tenants" class="tab-btn px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        <i data-lucide="building-2" class="w-4 h-4"></i> Vista Multi-Tenant
      </button>
      <button data-tab="status" class="tab-btn px-4 py-2.5 text-sm font-semibold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2">
        <i data-lucide="activity" class="w-4 h-4"></i> Estado del Ecosistema
      </button>
    </div>
  </div>

  <!-- Main Container -->
  <div class="max-w-7xl mx-auto px-4 py-6">

    <!-- TAB 1: RESEND & PLANTILLAS HTML -->
    <div id="tab-resend" class="tab-content space-y-6">
      <!-- Status & Quick Test Bar -->
      <div class="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div id="resendStatusDot" class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <div class="text-sm font-semibold flex items-center gap-2">
              <span>Motor de Correo Resend</span>
              <span id="resendModeBadge" class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Conectado</span>
            </div>
            <div id="resendFromDisplay" class="text-xs text-slate-400 font-mono">Remitente: ventas@arksystems.site</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input id="testEmailInput" type="email" placeholder="correo@ejemplo.com" class="bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500">
          <button id="sendTestEmailBtn" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5">
            <i data-lucide="send" class="w-3.5 h-3.5"></i> Enviar Prueba Inmediata
          </button>
        </div>
      </div>

      <!-- Templates Layout: Sidebar list + Live Preview/Editor -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Columna Izquierda: Lista de Plantillas y Filtro por Tenant -->
        <div class="lg:col-span-4 space-y-4">
          <div class="glass-panel rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-300">Plantillas Oficiales</h2>
              <button id="newTemplateBtn" class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nueva
              </button>
            </div>
            <div class="mb-3">
              <label class="text-[11px] text-slate-400 uppercase font-mono block mb-1">Filtrar por Despacho (Tenant)</label>
              <select id="tenantFilterSelect" class="w-full bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300">
                <option value="">Todos los Despachos (Globales)</option>
              </select>
            </div>
            <div id="templatesList" class="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              <!-- Rendered via JS -->
              <div class="text-slate-500 text-xs py-4 text-center">Cargando plantillas...</div>
            </div>
          </div>
        </div>

        <!-- Columna Derecha: Editor y Live Preview -->
        <div class="lg:col-span-8 space-y-4">
          <div class="glass-panel rounded-xl p-5">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 id="currentTemplateTitle" class="text-base font-bold text-white">Seleccione una plantilla</h3>
                <p id="currentTemplateSlug" class="text-xs font-mono text-slate-400">slug: —</p>
              </div>
              <div class="flex items-center gap-2">
                <button id="toggleEditBtn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Editar Código
                </button>
                <button id="openSendModalBtn" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20">
                  <i data-lucide="send" class="w-3.5 h-3.5"></i> Despachar Correo
                </button>
              </div>
            </div>

            <!-- Editor View (Hidden by default) -->
            <div id="templateEditContainer" class="hidden space-y-3 mb-4">
              <div>
                <label class="text-xs text-slate-400 block mb-1">Asunto (Subject)</label>
                <input id="editSubjectInput" class="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              </div>
              <div>
                <label class="text-xs text-slate-400 block mb-1">Código HTML</label>
                <textarea id="editHtmlTextarea" rows="12" class="w-full bg-slate-950 font-mono text-xs border border-slate-700 rounded-md p-3 text-emerald-400 focus:outline-none focus:border-blue-500"></textarea>
              </div>
              <div class="flex justify-end gap-2">
                <button id="cancelEditBtn" class="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancelar</button>
                <button id="saveTemplateBtn" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-xs font-semibold">Guardar Cambios</button>
              </div>
            </div>

            <!-- Preview Container -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                  <i data-lucide="eye" class="w-3.5 h-3.5 text-blue-400"></i> Vista Previa en Vivo (Rendered HTML)
                </span>
                <span class="text-[11px] text-slate-500 font-mono">Variables dinámicas: {{despacho_nombre}}, {{contacto_nombre}}, {{precio_mxn}}</span>
              </div>
              <div class="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <iframe id="previewIframe" class="preview-iframe"></iframe>
              </div>
            </div>
          </div>

          <!-- Historial de Envíos de Correo -->
          <div class="glass-panel rounded-xl p-5">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
              <i data-lucide="history" class="w-4 h-4 text-indigo-400"></i> Bitácora de Envíos Resend (Últimos Despachos)
            </h3>
            <div id="dispatchesTableContainer" class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-300">
                <thead class="bg-slate-900/80 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th class="py-2.5 px-3">Fecha</th>
                    <th class="py-2.5 px-3">Destinatario</th>
                    <th class="py-2.5 px-3">Asunto</th>
                    <th class="py-2.5 px-3">Plantilla</th>
                    <th class="py-2.5 px-3">Estado</th>
                    <th class="py-2.5 px-3">Resend ID</th>
                  </tr>
                </thead>
                <tbody id="dispatchesTableBody" class="divide-y divide-slate-800/60 font-mono text-[11px]">
                  <tr><td colspan="6" class="py-4 text-center text-slate-500">Cargando bitácora de correos...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: CAMPAÑAS DE VOZ AI TELNYX -->
    <div id="tab-voice" class="tab-content hidden space-y-6">
      <!-- Telnyx Status Bar -->
      <div class="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <div class="text-sm font-semibold flex items-center gap-2">
              <span>Telnyx Voice AI Assistants & Marcación PSTN</span>
              <span id="voiceModeBadge" class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">Edge Phone Active</span>
            </div>
            <div id="voiceDetailsDisplay" class="text-xs text-slate-400 font-mono">Troncal +52 (México) &middot; Latencia &lt;800ms &middot; AMD & Call Bridging</div>
          </div>
        </div>
        <div>
          <button id="openNewVoiceCampaignModalBtn" class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <i data-lucide="plus-circle" class="w-4 h-4"></i> Crear Nueva Campaña de Voz
          </button>
        </div>
      </div>

      <!-- Campañas Activas Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Lista de Campañas -->
        <div class="lg:col-span-1 glass-panel rounded-xl p-4">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <i data-lucide="list-ordered" class="w-4 h-4 text-blue-400"></i> Campañas Registradas
          </h3>
          <div id="voiceCampaignsList" class="space-y-2 max-h-[500px] overflow-y-auto">
            <!-- Rendered via JS -->
            <div class="text-slate-500 text-xs py-4 text-center">Cargando campañas...</div>
          </div>
        </div>

        <!-- Detalle de Campaña Seleccionada y Disparador -->
        <div class="lg:col-span-2 glass-panel rounded-xl p-5 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 id="selectedCampaignTitle" class="text-base font-bold text-white">Seleccione una campaña</h3>
              <p id="selectedCampaignMeta" class="text-xs font-mono text-slate-400">Targets: 0 &middot; Estado: —</p>
            </div>
            <div class="flex items-center gap-2">
              <button id="autoPopulateTargetsBtn" class="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5">
                <i data-lucide="users" class="w-3.5 h-3.5"></i> Poblar Contactos
              </button>
              <button id="dispatchVoiceCampaignBtn" class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20">
                <i data-lucide="phone-outgoing" class="w-3.5 h-3.5"></i> Disparar Campaña Ahora
              </button>
            </div>
          </div>

          <!-- Tabla de Targets de la Campaña -->
          <div>
            <div class="text-xs font-semibold text-slate-400 uppercase mb-2">Destinatarios de la Llamada (Targets)</div>
            <div class="max-h-[300px] overflow-y-auto border border-slate-800 rounded-lg">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-900/80 text-slate-400 font-mono text-[10px] uppercase sticky top-0">
                  <tr>
                    <th class="py-2 px-3">Despacho</th>
                    <th class="py-2 px-3">Teléfono</th>
                    <th class="py-2 px-3">Estado</th>
                    <th class="py-2 px-3">Call Control ID</th>
                  </tr>
                </thead>
                <tbody id="targetsTableBody" class="divide-y divide-slate-800/60 font-mono text-[11px]">
                  <tr><td colspan="4" class="py-4 text-center text-slate-500">Sin targets cargados.</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Consola en Vivo de Sesiones de Voz AI (Grabaciones y Transcripciones) -->
          <div class="pt-3 border-t border-slate-800">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-2">
              <i data-lucide="mic" class="w-3.5 h-3.5 text-emerald-400"></i> Telemetría de Llamadas Recientes (Transcripciones & Grabaciones)
            </h4>
            <div id="voiceSessionsFeed" class="space-y-2 max-h-[220px] overflow-y-auto">
              <!-- Rendered via JS -->
              <div class="text-slate-500 text-xs py-3 text-center">Cargando sesiones...</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: VISTA MULTI-TENANT -->
    <div id="tab-tenants" class="tab-content hidden space-y-6">
      <div class="glass-panel rounded-xl p-5">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div>
            <h3 class="text-base font-bold text-white flex items-center gap-2">
              <i data-lucide="building" class="w-5 h-5 text-blue-400"></i> Despachos y Tenants en la Red ARK
            </h3>
            <p class="text-xs text-slate-400">Control unificado de contactos, oportunidades, campañas de correo y voz por tenant.</p>
          </div>
          <button id="refreshTenantsBtn" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Actualizar
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/80 text-slate-400 font-mono text-[10px] uppercase">
              <tr>
                <th class="py-3 px-3">Despacho (Tenant)</th>
                <th class="py-3 px-3">Tamaño</th>
                <th class="py-3 px-3">Ciudad / Origen</th>
                <th class="py-3 px-3 text-center">Contactos</th>
                <th class="py-3 px-3 text-center">Opps</th>
                <th class="py-3 px-3 text-center">Emails Enviados</th>
                <th class="py-3 px-3 text-center">Llamadas Voz AI</th>
                <th class="py-3 px-3 text-right">Acción Rápida</th>
              </tr>
            </thead>
            <tbody id="tenantsOverviewBody" class="divide-y divide-slate-800/60">
              <tr><td colspan="8" class="py-6 text-center text-slate-500">Cargando métricas de tenants...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: ESTADO DEL ECOSISTEMA -->
    <div id="tab-status" class="tab-content hidden space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="glass-panel rounded-xl p-4 border-l-4 border-l-blue-500">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase text-slate-400">Resend Email Gateway</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div class="text-lg font-bold text-white mb-1">HTTP API v1</div>
          <div class="text-xs text-slate-400 font-mono">Envío formal de contratos y plantillas HTML</div>
        </div>

        <div class="glass-panel rounded-xl p-4 border-l-4 border-l-emerald-500">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase text-slate-400">Telnyx Voice AI</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div class="text-lg font-bold text-white mb-1">PSTN +52 / Assistants</div>
          <div class="text-xs text-slate-400 font-mono">Voz en español neutro, Llama 3.3 70B & AMD</div>
        </div>

        <div class="glass-panel rounded-xl p-4 border-l-4 border-l-purple-500">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase text-slate-400">Cloudflare D1 Database</span>
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div class="text-lg font-bold text-white mb-1">ark-sales-db</div>
          <div class="text-xs text-slate-400 font-mono">8 Migraciones aplicadas &middot; Esquema Multi-Tenant</div>
        </div>
      </div>
    </div>

  </div>

  <!-- MODAL: Despachar Correo con Plantilla -->
  <div id="sendEmailModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 hidden items-center justify-center p-4">
    <div class="glass-panel rounded-2xl w-full max-w-lg p-6 space-y-4 border border-slate-700 shadow-2xl">
      <div class="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="send" class="w-4 h-4 text-emerald-400"></i> Despachar Correo con Plantilla
        </h3>
        <button id="closeSendModalBtn" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="sendEmailForm" class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Correo Electrónico Destino *</label>
          <input id="modalToEmail" type="email" required placeholder="contacto@despacho.com" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Nombre del Destinatario</label>
          <input id="modalRecipientName" placeholder="Lic. Juan Pérez" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-slate-400 block mb-1">Despacho / Tenant</label>
            <input id="modalDespachoNombre" placeholder="Despacho Contable Morales" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          </div>
          <div>
            <label class="text-xs text-slate-400 block mb-1">Precio / Inversión</label>
            <input id="modalPrecioMxn" placeholder="$10,000 MXN/mes" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          </div>
        </div>
        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-md text-sm transition-all shadow-lg shadow-emerald-600/20">
          Disparar Envío vía Resend
        </button>
      </form>
    </div>
  </div>

  <!-- MODAL: Crear Campaña de Voz -->
  <div id="newVoiceCampaignModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 hidden items-center justify-center p-4">
    <div class="glass-panel rounded-2xl w-full max-w-lg p-6 space-y-4 border border-slate-700 shadow-2xl">
      <div class="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="phone-call" class="w-4 h-4 text-blue-400"></i> Nueva Campaña de Voz AI Telnyx
        </h3>
        <button id="closeNewVoiceModalBtn" class="text-slate-400 hover:text-white">✕</button>
      </div>
      <form id="newVoiceCampaignForm" class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Nombre de la Campaña *</label>
          <input id="vcampName" required placeholder="Outbound Fiscal Q4 - Despachos CDMX" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Despacho / Tenant Destino</label>
          <select id="vcampTenantSelect" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-300">
            <option value="">Todos los Despachos (Omni-Tenant)</option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-400 block mb-1">Dolor Principal a Tratar (Inteligencia de Pitch)</label>
          <select id="vcampDolorSelect" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-300">
            <option value="sat_fiscal_calculo">SAT, Multas y Sello Criptográfico SHA-256 (Ark Ledger)</option>
            <option value="cobranza_morosos">Cartera Vencida y Cobranza Morosa con IA (Ark Angel)</option>
            <option value="due_diligence_us">Due Diligence Inmobiliario & UBO en EE.UU. (Hermes)</option>
            <option value="integral_general">Bundle Total ARK (Solución Integral)</option>
          </select>
        </div>
        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-md text-sm transition-all shadow-lg shadow-blue-600/20">
          Guardar y Configurar Destinatarios
        </button>
      </form>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs hidden flex items-center gap-2"></div>

<script>
const TOKEN = localStorage.getItem('ark_crm_token');
if (!TOKEN) { window.location.href = '/crm/login'; }

const API = (url, opts = {}) => fetch(url, {
  ...opts,
  headers: {
    'Authorization': 'Bearer ' + TOKEN,
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  }
}).then(async r => {
  if (r.status === 401 || r.status === 403) {
    if (r.status === 403) { alert('Acceso restringido: Se requiere rol de Administrador.'); window.location.href = '/crm'; }
  }
  return r.json();
});

function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.innerHTML = isErr ? '<span class="text-rose-400">✖</span> ' + msg : '<span class="text-emerald-400">✔</span> ' + msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// Tabs switching
document.querySelectorAll('.tab-btn').forEach(b => {
  b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('border-blue-500', active);
      btn.classList.toggle('text-blue-400', active);
      btn.classList.toggle('border-transparent', !active);
      btn.classList.toggle('text-slate-400', !active);
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 'tab-' + tab));
    if (tab === 'voice') loadVoiceCampaigns();
    if (tab === 'tenants') loadTenantsOverview();
  });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('ark_crm_token');
  window.location.href = '/crm/login';
});

// Global state
let templates = [];
let currentTemplate = null;
let voiceCampaigns = [];
let currentVoiceCampaign = null;
let allTenants = [];

// Init Resend Status
async function initResendStatus() {
  try {
    const st = await API('/api/superadmin/resend/status');
    const badge = document.getElementById('resendModeBadge');
    if (st.has_api_key) {
      badge.textContent = 'API Conectada (' + st.masked_key + ')';
      badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800';
    } else {
      badge.textContent = 'Modo Simulado';
      badge.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800';
    }
    document.getElementById('resendFromDisplay').textContent = 'Remitente: ' + st.from_email + ' · Despachos: ' + (st.stats?.total || 0) + ' (' + (st.stats?.sent || 0) + ' exitosos)';
  } catch (e) {}
}

// Quick Test Email
document.getElementById('sendTestEmailBtn').addEventListener('click', async () => {
  const email = document.getElementById('testEmailInput').value.trim();
  if (!email) { toast('Ingrese un correo destino', true); return; }
  toast('Enviando prueba vía Resend...');
  const res = await API('/api/superadmin/resend/test', {
    method: 'POST',
    body: JSON.stringify({ to: email })
  });
  if (res.success) {
    toast(res.message);
    loadEmailDispatches();
  } else {
    toast('Error: ' + (res.details || res.error), true);
  }
});

// Load Templates
async function loadTemplates(tenantId = '') {
  let url = '/api/superadmin/templates';
  if (tenantId) url += '?tenant_id=' + encodeURIComponent(tenantId);
  const data = await API(url);
  templates = data.templates || [];
  const container = document.getElementById('templatesList');
  if (!templates.length) {
    container.innerHTML = '<div class="text-slate-500 text-xs py-4 text-center">Sin plantillas.</div>';
    return;
  }
  container.innerHTML = templates.map(t => \`
    <div class="glass-card rounded-lg p-3 cursor-pointer hover:border-blue-500/50 transition-all \${currentTemplate?.id === t.id ? 'border-blue-500 bg-blue-950/20' : ''}" onclick="selectTemplate('\${t.id}')">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">\${t.category}</span>
        \${t.tenant_id ? '<span class="text-[9px] font-mono text-amber-400">Custom Tenant</span>' : '<span class="text-[9px] font-mono text-blue-400">Global</span>'}
      </div>
      <div class="text-xs font-semibold text-white">\${t.name}</div>
      <div class="text-[11px] text-slate-400 truncate mt-0.5">\${t.subject}</div>
    </div>
  \`).join('');

  if (!currentTemplate && templates.length > 0) {
    selectTemplate(templates[0].id);
  }
}

window.selectTemplate = async function(id) {
  currentTemplate = templates.find(t => t.id === id);
  if (!currentTemplate) return;

  document.getElementById('currentTemplateTitle').textContent = currentTemplate.name;
  document.getElementById('currentTemplateSlug').textContent = 'slug: ' + currentTemplate.slug + (currentTemplate.tenant_id ? ' · Tenant: ' + currentTemplate.tenant_id : ' · Global');
  document.getElementById('editSubjectInput').value = currentTemplate.subject;
  document.getElementById('editHtmlTextarea').value = currentTemplate.html_content;

  // Render preview
  const prev = await API('/api/superadmin/templates/' + currentTemplate.id + '/preview', { method: 'POST' });
  if (prev.success) {
    const iframe = document.getElementById('previewIframe');
    iframe.srcdoc = prev.html;
  }
  loadTemplates(document.getElementById('tenantFilterSelect').value);
};

// Edit template toggle
const editContainer = document.getElementById('templateEditContainer');
document.getElementById('toggleEditBtn').addEventListener('click', () => {
  editContainer.classList.toggle('hidden');
});
document.getElementById('cancelEditBtn').addEventListener('click', () => {
  editContainer.classList.add('hidden');
});
document.getElementById('saveTemplateBtn').addEventListener('click', async () => {
  if (!currentTemplate) return;
  const subj = document.getElementById('editSubjectInput').value;
  const html = document.getElementById('editHtmlTextarea').value;
  const res = await API('/api/superadmin/templates/' + currentTemplate.id, {
    method: 'PUT',
    body: JSON.stringify({ subject: subj, html_content: html })
  });
  if (res.success) {
    toast('Plantilla actualizada');
    editContainer.classList.add('hidden');
    currentTemplate.subject = subj;
    currentTemplate.html_content = html;
    selectTemplate(currentTemplate.id);
  } else {
    toast('Error actualizando', true);
  }
});

// Send Modal
document.getElementById('openSendModalBtn').addEventListener('click', () => {
  if (!currentTemplate) { toast('Seleccione una plantilla primero', true); return; }
  document.getElementById('sendEmailModal').classList.remove('hidden');
  document.getElementById('sendEmailModal').classList.add('flex');
});
document.getElementById('closeSendModalBtn').addEventListener('click', () => {
  document.getElementById('sendEmailModal').classList.add('hidden');
  document.getElementById('sendEmailModal').classList.remove('flex');
});
document.getElementById('sendEmailForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const to = document.getElementById('modalToEmail').value;
  const name = document.getElementById('modalRecipientName').value;
  const despacho = document.getElementById('modalDespachoNombre').value || 'Despacho Colega';
  const precio = document.getElementById('modalPrecioMxn').value || '$10,000 MXN/mes';

  toast('Despachando correo con Resend...');
  const res = await API('/api/superadmin/templates/' + currentTemplate.id + '/send', {
    method: 'POST',
    body: JSON.stringify({
      to,
      recipient_name: name,
      variables: {
        despacho_nombre: despacho,
        contacto_nombre: name || despacho,
        precio_mxn: precio,
        cta_url: 'https://sales.arksystems.site/onboarding',
        portal_url: 'https://sales.arksystems.site/crm',
        admin_email: to,
        demo_url: 'https://hermes.arksystems.site/demo',
        agenda_url: 'https://sales.arksystems.site/agenda',
        vigencia_dias: '15'
      }
    })
  });

  if (res.success) {
    toast('Correo despachado (' + res.status + ')');
    document.getElementById('sendEmailModal').classList.add('hidden');
    document.getElementById('sendEmailModal').classList.remove('flex');
    loadEmailDispatches();
  } else {
    toast('Fallo al despachar: ' + (res.error || 'Error'), true);
  }
});

// Email Dispatches Table
async function loadEmailDispatches() {
  const data = await API('/api/superadmin/email/dispatches?limit=20');
  const tbody = document.getElementById('dispatchesTableBody');
  const items = data.dispatches || [];
  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-500">Sin envíos registrados.</td></tr>';
    return;
  }
  tbody.innerHTML = items.map(d => \`
    <tr class="hover:bg-slate-900/40">
      <td class="py-2.5 px-3 text-slate-400">\${d.created_at?.slice(0,16) || '—'}</td>
      <td class="py-2.5 px-3 font-semibold text-white">\${d.recipient_email}</td>
      <td class="py-2.5 px-3 text-slate-300 max-w-[200px] truncate">\${d.subject}</td>
      <td class="py-2.5 px-3 text-blue-400">\${d.template_slug || '—'}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-mono \${d.status==='sent'?'bg-emerald-950 text-emerald-400 border border-emerald-800':(d.status==='simulated'?'bg-amber-950 text-amber-400 border border-amber-800':'bg-rose-950 text-rose-400 border border-rose-800')}">\${d.status}</span>
      </td>
      <td class="py-2.5 px-3 text-slate-500 font-mono">\${d.resend_id || '—'}</td>
    </tr>
  \`).join('');
}

// -------------------------------------------------------------
// VOICE CAMPAIGNS (TELNYX)
// -------------------------------------------------------------
async function loadVoiceCampaigns() {
  const data = await API('/api/superadmin/voice/campaigns');
  voiceCampaigns = data.campaigns || [];
  const list = document.getElementById('voiceCampaignsList');
  if (!voiceCampaigns.length) {
    list.innerHTML = '<div class="text-slate-500 text-xs py-4 text-center">Sin campañas creadas.</div>';
    return;
  }
  list.innerHTML = voiceCampaigns.map(c => \`
    <div class="glass-card rounded-lg p-3 cursor-pointer hover:border-blue-500/50 transition-all \${currentVoiceCampaign?.id === c.id ? 'border-blue-500 bg-blue-950/20' : ''}" onclick="selectVoiceCampaign('\${c.id}')">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">\${c.status}</span>
        <span class="text-[10px] font-mono text-emerald-400">\${c.completed_calls || 0} / \${c.total_targets || 0} llamadas</span>
      </div>
      <div class="text-xs font-semibold text-white">\${c.name}</div>
      <div class="text-[10px] text-slate-400 truncate mt-0.5">Dolor: \${c.dolor_principal || 'general'}</div>
    </div>
  \`).join('');

  if (!currentVoiceCampaign && voiceCampaigns.length > 0) {
    selectVoiceCampaign(voiceCampaigns[0].id);
  }
  loadVoiceSessions();
}

window.selectVoiceCampaign = async function(id) {
  const data = await API('/api/superadmin/voice/campaigns/' + id);
  currentVoiceCampaign = data.campaign;
  if (!currentVoiceCampaign) return;

  document.getElementById('selectedCampaignTitle').textContent = currentVoiceCampaign.name;
  document.getElementById('selectedCampaignMeta').textContent = 'Targets: ' + data.targets_count + ' · Estado: ' + currentVoiceCampaign.status + ' · Dolor: ' + (currentVoiceCampaign.dolor_principal || 'sat_fiscal_calculo');

  const targets = data.targets || [];
  const tbody = document.getElementById('targetsTableBody');
  if (!targets.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">Sin targets cargados. Use "+ Poblar Contactos".</td></tr>';
  } else {
    tbody.innerHTML = targets.map(t => \`
      <tr class="hover:bg-slate-900/40">
        <td class="py-2 px-3 text-white font-medium">\${t.despacho_nombre || 'Despacho'}</td>
        <td class="py-2 px-3 text-blue-400 font-mono">\${t.to_phone}</td>
        <td class="py-2 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] \${t.status==='completed'?'bg-emerald-950 text-emerald-400':(t.status==='initiated'?'bg-blue-950 text-blue-400':'bg-slate-800 text-slate-400')}">\${t.status}</span>
        </td>
        <td class="py-2 px-3 text-slate-500 font-mono truncate max-w-[140px]">\${t.call_control_id || '—'}</td>
      </tr>
    \`).join('');
  }
};

// Dispatch Voice Campaign
document.getElementById('dispatchVoiceCampaignBtn').addEventListener('click', async () => {
  if (!currentVoiceCampaign) { toast('Seleccione una campaña', true); return; }
  if (!confirm('¿Confirma disparar la campaña de llamadas de voz con IA Telnyx para todos los targets pendientes?')) return;

  toast('Disparando llamadas salientes con Telnyx Voice AI...');
  const res = await API('/api/superadmin/voice/campaigns/' + currentVoiceCampaign.id + '/dispatch', { method: 'POST' });
  if (res.success) {
    toast('Campaña disparada: ' + res.initiated + ' iniciadas');
    selectVoiceCampaign(currentVoiceCampaign.id);
    loadVoiceCampaigns();
  } else {
    toast('Error: ' + (res.error || 'Fallo en llamada'), true);
  }
});

// Auto-populate targets
document.getElementById('autoPopulateTargetsBtn').addEventListener('click', async () => {
  if (!currentVoiceCampaign) return;
  toast('Poblando contactos desde CRM...');
  const res = await API('/api/superadmin/voice/campaigns/' + currentVoiceCampaign.id + '/targets', {
    method: 'POST',
    body: JSON.stringify({ auto_populate_tenant_id: currentVoiceCampaign.tenant_id || 'all' })
  });
  if (res.success) {
    toast('Targets agregados: ' + res.targets_added);
    selectVoiceCampaign(currentVoiceCampaign.id);
  }
});

// Voice Sessions Feed
async function loadVoiceSessions() {
  const data = await API('/api/superadmin/voice/sessions?limit=15');
  const feed = document.getElementById('voiceSessionsFeed');
  const sessions = data.sessions || [];
  if (!sessions.length) {
    feed.innerHTML = '<div class="text-slate-500 text-xs py-3 text-center">Sin sesiones de voz registradas.</div>';
    return;
  }
  feed.innerHTML = sessions.map(s => \`
    <div class="glass-card rounded-lg p-2.5 text-xs">
      <div class="flex items-center justify-between mb-1">
        <span class="font-mono text-blue-400">\${s.to_number} &middot; \${s.duration_seconds || 0}s</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">\${s.outcome || s.detected_intent || 'registrada'}</span>
      </div>
      <div class="text-slate-300 italic mb-1 max-h-12 overflow-hidden text-[11px]">"\${s.full_transcript || s.summary || 'Llamada completada.'}"</div>
      \${s.recording_url ? '<a href="' + s.recording_url + '" target="_blank" class="text-emerald-400 hover:underline text-[10px] flex items-center gap-1 font-mono">▶ Reproducir Grabación Estéreo</a>' : ''}
    </div>
  \`).join('');
}

// Modal Voice Campaign
document.getElementById('openNewVoiceCampaignModalBtn').addEventListener('click', () => {
  document.getElementById('newVoiceCampaignModal').classList.remove('hidden');
  document.getElementById('newVoiceCampaignModal').classList.add('flex');
});
document.getElementById('closeNewVoiceModalBtn').addEventListener('click', () => {
  document.getElementById('newVoiceCampaignModal').classList.add('hidden');
  document.getElementById('newVoiceCampaignModal').classList.remove('flex');
});
document.getElementById('newVoiceCampaignForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('vcampName').value;
  const tenant_id = document.getElementById('vcampTenantSelect').value || null;
  const dolor_principal = document.getElementById('vcampDolorSelect').value;

  const res = await API('/api/superadmin/voice/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name, tenant_id, dolor_principal })
  });
  if (res.success) {
    toast('Campaña creada');
    document.getElementById('newVoiceCampaignModal').classList.add('hidden');
    document.getElementById('newVoiceCampaignModal').classList.remove('flex');
    loadVoiceCampaigns();
  }
});

// -------------------------------------------------------------
// TENANTS OVERVIEW
// -------------------------------------------------------------
async function loadTenantsOverview() {
  const data = await API('/api/superadmin/tenants/overview');
  allTenants = data.tenants || [];

  // Update tenant selectors
  const filterSelect = document.getElementById('tenantFilterSelect');
  const vcampSelect = document.getElementById('vcampTenantSelect');
  const opts = '<option value="">Todos los Despachos (Global)</option>' + allTenants.map(t => '<option value="' + t.id + '">' + t.name + ' (' + (t.city || 'MX') + ')</option>').join('');
  filterSelect.innerHTML = opts;
  vcampSelect.innerHTML = opts;

  const tbody = document.getElementById('tenantsOverviewBody');
  if (!allTenants.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-slate-500">Sin tenants registrados en D1.</td></tr>';
    return;
  }
  tbody.innerHTML = allTenants.map(t => \`
    <tr class="hover:bg-slate-900/40">
      <td class="py-3 px-3">
        <div class="font-bold text-white">\${t.name}</div>
        <div class="text-[10px] font-mono text-slate-500">ID: \${t.id}</div>
      </td>
      <td class="py-3 px-3 text-slate-300">\${t.size || '1-5'}</td>
      <td class="py-3 px-3 text-slate-400">\${t.city || '—'} &middot; \${t.origin || 'lead'}</td>
      <td class="py-3 px-3 text-center font-mono text-blue-400 font-semibold">\${t.total_contacts || 0}</td>
      <td class="py-3 px-3 text-center font-mono text-amber-400 font-semibold">\${t.total_opportunities || 0}</td>
      <td class="py-3 px-3 text-center font-mono text-emerald-400 font-semibold">\${t.total_emails_sent || 0}</td>
      <td class="py-3 px-3 text-center font-mono text-indigo-400 font-semibold">\${t.total_voice_sessions || 0}</td>
      <td class="py-3 px-3 text-right">
        <button class="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded text-[11px]" onclick="openTenantCampaign('\${t.id}', '\${t.name}')">Llamar con IA</button>
      </td>
    </tr>
  \`).join('');
}

window.openTenantCampaign = function(tenantId, tenantName) {
  document.querySelector('[data-tab="voice"]').click();
  document.getElementById('openNewVoiceCampaignModalBtn').click();
  document.getElementById('vcampName').value = 'Campaña Express · ' + tenantName;
  document.getElementById('vcampTenantSelect').value = tenantId;
};

document.getElementById('refreshTenantsBtn').addEventListener('click', loadTenantsOverview);
document.getElementById('tenantFilterSelect').addEventListener('change', (e) => {
  loadTemplates(e.target.value);
});

// Boot
lucide.createIcons();
initResendStatus();
loadTenantsOverview().then(() => loadTemplates());
loadEmailDispatches();
</script>
</body>
</html>`;
}
