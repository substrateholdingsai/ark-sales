import { Env } from "../types";
import { verifyJwt } from "../auth/jwt";
import { normalizeRole } from "../auth/roles";
import { getJwtSecret } from "../auth/middleware";

export function hasValidToken(cookieOrToken: string | null, env: Env): boolean {
  if (!cookieOrToken) return false;
  const secret = getJwtSecret(env);
  if (!secret) return false;
  return true;
}

export async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
  let token: string | null = null;
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)ark_sales_token=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }
  if (!token) return false;
  const secret = getJwtSecret(env);
  if (!secret) return false;
  const payload = await verifyJwt(token, secret);
  if (!payload) return false;
  return !!normalizeRole(payload.role);
}

export async function isAdminAuthenticated(request: Request, env: Env): Promise<{ authenticated: boolean; isAdmin: boolean }> {
  let token: string | null = null;
  const auth = request.headers.get("authorization");
  if (auth && /^Bearer\s+/i.test(auth)) token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(/(?:^|;\s*)ark_sales_token=([^;]+)/);
    if (m) token = decodeURIComponent(m[1]);
  }
  if (!token) return { authenticated: false, isAdmin: false };
  const secret = getJwtSecret(env);
  if (!secret) return { authenticated: false, isAdmin: false };
  const payload = await verifyJwt(token, secret);
  if (!payload) return { authenticated: false, isAdmin: false };
  const role = normalizeRole(payload.role);
  if (!role) return { authenticated: false, isAdmin: false };
  return { authenticated: true, isAdmin: role === "admin" };
}

export function renderCrmLoginHtml(): string {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARK CRM · Acceso</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
body{font-family:'Inter',sans-serif;background-color:#020617;color:#f8fafc}
.font-mono{font-family:'JetBrains Mono',monospace}
.glass-panel{background:rgba(15,23,42,0.6);backdrop-filter:blur(12px);border:1px solid rgba(51,65,85,0.5)}
.grid-bg{background-image:linear-gradient(rgba(51,65,85,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(51,65,85,0.1) 1px,transparent 1px);background-size:40px 40px}
</style>
</head>
<body class="grid-bg min-h-screen flex items-center justify-center p-4">
  <div class="glass-panel rounded-2xl p-8 w-full max-w-md">
    <div class="flex items-center gap-2 mb-6">
      <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center"><i data-lucide="hexagon" class="text-white w-5 h-5"></i></div>
      <span class="font-bold text-lg tracking-tight">ARK <span class="text-slate-400 font-normal">CRM</span></span>
    </div>
    <h1 class="text-xl font-semibold mb-2">Acceso privado</h1>
    <p class="text-slate-400 text-sm mb-6">Solo personal autorizado del equipo comercial.</p>
    <form id="loginForm" class="space-y-4">
      <div>
        <label class="text-xs text-slate-400 mb-1 block">Correo</label>
        <input name="email" type="email" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="usuario@arksystems.site">
      </div>
      <div>
        <label class="text-xs text-slate-400 mb-1 block">Contraseña</label>
        <input name="password" type="password" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
      </div>
      <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-md text-sm transition-colors">Entrar</button>
      <div class="flex items-center justify-between text-xs">
        <button type="button" id="forgotBtn" class="text-blue-400 hover:text-blue-300">Olvidé mi contraseña</button>
      </div>
      <p id="err" class="text-rose-400 text-xs hidden"></p>
      <div id="forgotBox" class="hidden space-y-2">
        <input id="forgotEmail" type="email" placeholder="Tu correo" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">
        <button id="forgotSubmit" class="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs py-2 rounded-md">Enviar enlace</button>
        <p id="forgotMsg" class="text-xs text-slate-400"></p>
      </div>
      <div id="resetBox" class="hidden space-y-2">
        <input id="resetPassword" type="password" placeholder="Nueva contraseña" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">
        <button id="resetSubmit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-md">Restablecer</button>
        <p id="resetMsg" class="text-xs text-slate-400"></p>
      </div>
    </form>
  </div>
   <script>
     lucide.createIcons();
     const params = new URLSearchParams(window.location.search);
     const resetToken = params.get('reset');
     if (resetToken) {
       document.getElementById('resetBox').classList.remove('hidden');
       document.getElementById('loginForm').classList.add('hidden');
     }
     document.getElementById('loginForm').addEventListener('submit', async (e) => {
       e.preventDefault();
       const fd = new FormData(e.target);
       const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
       const data = await res.json();
       if (!res.ok) { document.getElementById('err').textContent = data.error || 'Error'; document.getElementById('err').classList.remove('hidden'); return; }
       localStorage.setItem('ark_crm_token', data.token || data.access_token);
       window.location.href = '/crm';
     });
     document.getElementById('forgotBtn').addEventListener('click', () => {
       document.getElementById('forgotBox').classList.toggle('hidden');
     });
     document.getElementById('forgotSubmit').addEventListener('click', async () => {
       const email = document.getElementById('forgotEmail').value;
       const res = await fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
       const data = await res.json();
       document.getElementById('forgotMsg').textContent = data.message || 'Enviado';
       if (data.reset_token) document.getElementById('forgotMsg').textContent += ' (dev token: ' + data.reset_token + ')';
     });
     document.getElementById('resetSubmit').addEventListener('click', async () => {
       const password = document.getElementById('resetPassword').value;
       const res = await fetch('/api/auth/reset-password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ token: resetToken, password }) });
       const data = await res.json();
       if (!res.ok) { document.getElementById('resetMsg').textContent = data.error || 'Error'; return; }
       document.getElementById('resetMsg').textContent = 'Contraseña actualizada. Redirigiendo…';
       setTimeout(() => { window.location.href = '/crm/login'; }, 1500);
     });
   </script>
</body>
</html>`;
}

export function renderCrmHtml(): string {
  return `<!DOCTYPE html>
<html lang="es-MX" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARK CRM · Sales Operations & Governance</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23020617'/%3E%3Cg transform='translate(32 30)'%3E%3Cpath d='M0,-14 L12,-7 L12,7 L0,14 L-12,7 L-12,-7 Z' fill='none' stroke='%2360a5fa' stroke-width='2.5'/%3E%3Ccircle r='3' fill='%23fbbf24'/%3E%3C/g%3E%3C/svg%3E">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: { 950: '#020617', 900: '#0f172a', 850: '#111827', 800: '#1e293b', 700: '#334155', 600: '#475569', 500: '#64748b', 400: '#94a3b8', 300: '#cbd5e1', 200: '#e2e8f0' },
        ark: { blue: '#2563eb', blue_hi: '#60a5fa', amber: '#d97706', amber_hi: '#fbbf24', emerald: '#059669', emerald_hi: '#34d399', rose: '#e11d48', rose_hi: '#fb7185', indigo: '#4f46e5', indigo_hi: '#a78bfa' }
      },
      fontFamily: { body: ['Inter','system-ui','sans-serif'], mono: ['"JetBrains Mono"','monospace'] },
    }
  }
}
</script>
<script src="https://unpkg.com/lucide@latest"></script>

<style>
  * { scrollbar-width: thin; scrollbar-color: #334155 #0f172a; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #0f172a; }
  ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  body { font-family: 'Inter', sans-serif; }
  .font-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
  .glass { background: rgba(15,23,42,0.7); backdrop-filter: blur(12px); border: 1px solid rgba(51,65,85,0.5); }
  .badge { display:inline-flex; align-items:center; gap:4px; padding:2px 10px; border-radius:999px; font-size:0.7rem; font-weight:600; letter-spacing:0.02em; }
  .badge-azul { background:rgba(37,99,235,0.15); color:#60a5fa; border:1px solid rgba(37,99,235,0.3); }
  .badge-ambar { background:rgba(217,119,6,0.15); color:#fbbf24; border:1px solid rgba(217,119,6,0.3); }
  .badge-esmeralda { background:rgba(5,150,105,0.15); color:#34d399; border:1px solid rgba(5,150,105,0.3); }
  .badge-rojo { background:rgba(225,29,72,0.15); color:#fb7185; border:1px solid rgba(225,29,72,0.3); }
  .badge-indigo { background:rgba(79,70,229,0.15); color:#a78bfa; border:1px solid rgba(79,70,229,0.3); }
  .kanban-col { min-width: 280px; max-width: 320px; }
  .kanban-card { cursor: grab; transition: transform 0.15s, box-shadow 0.15s; }
  .kanban-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
  .kanban-card.dragging { opacity: 0.5; transform: rotate(2deg); }
  .kanban-col.drag-over { background: rgba(37,99,235,0.06); border-color: #2563eb; }
  .nav-item { transition: all 0.15s; }
  .nav-item.active { background: rgba(37,99,235,0.12); color: #60a5fa; border-right: 2px solid #2563eb; }
  .nav-item:hover:not(.active) { background: rgba(51,65,85,0.3); }
  @keyframes toastIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .toast-in { animation: toastIn 0.25s ease; }
  .modal-backdrop { transition: opacity 0.2s; }
  .modal-content { animation: toastIn 0.2s ease; }
</style>
</head>

<body class="bg-slate-950 text-slate-200 h-screen flex overflow-hidden">

<!-- ═══════════════ SIDEBAR ═══════════════ -->
<aside class="w-[240px] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 hidden lg:flex">
  <div class="p-5 border-b border-slate-800">
    <div class="flex items-center gap-3">
      <svg width="32" height="32" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="14" fill="#020617"/>
        <g transform="translate(32 30)">
          <path d="M0,-14 L12,-7 L12,7 L0,14 L-12,7 L-12,-7 Z" fill="none" stroke="#60a5fa" stroke-width="2.5"/>
          <path d="M0,-14 L0,0 M0,0 L12,7 M0,0 L-12,7" stroke="#60a5fa" stroke-width="1.5" opacity="0.5"/>
          <circle r="3" fill="#fbbf24"/>
        </g>
      </svg>
      <div>
        <span class="font-body font-800 text-lg text-white">ARK</span><span class="font-body font-300 text-lg text-ark-blue_hi ml-1">CRM</span>
        <div class="font-mono text-[9px] text-slate-500 tracking-widest">SALES OPS</div>
      </div>
    </div>
  </div>

  <nav class="flex-1 py-4 space-y-1 px-3" id="sidebarNav">
    <a href="#/dashboard" class="nav-item active flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300">
      <i data-lucide="layout-dashboard" class="w-4 h-4"></i> Dashboard
    </a>
    <a href="#/pipeline" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300">
      <i data-lucide="kanban" class="w-4 h-4"></i> Pipeline
    </a>
    <a href="#/cuentas" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300">
      <i data-lucide="building-2" class="w-4 h-4"></i> Cuentas
    </a>
    <a href="#/contactos" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300">
      <i data-lucide="users" class="w-4 h-4"></i> Contactos
    </a>
    <a href="#/tareas" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300">
      <i data-lucide="check-square" class="w-4 h-4"></i> Tareas
      <span id="tareasBadge" class="ml-auto badge badge-rojo">0</span>
    </a>
    <div id="sidebarSuperAdminDiv" class="pt-4 mt-4 border-t border-slate-800 hidden">
      <a id="sidebarSuperAdminNav" href="#/superadmin" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300">
        <i data-lucide="shield" class="w-4 h-4 text-ark-indigo_hi"></i> Super Admin
      </a>
    </div>
  </nav>

  <div class="p-4 border-t border-slate-800">
    <div class="flex items-center gap-3">
      <div id="userAvatarSidebar" class="w-8 h-8 rounded-full bg-ark-blue flex items-center justify-center text-white text-xs font-bold">OP</div>
      <div class="flex-1 min-w-0">
        <div id="userEmailSidebar" class="text-sm font-medium text-white truncate">cargando...</div>
        <div id="userRoleSidebar" class="text-xs text-slate-500">Comercial</div>
      </div>
      <button onclick="logout()" class="p-1.5 rounded hover:bg-slate-800 text-slate-400" title="Cerrar sesión"><i data-lucide="log-out" class="w-4 h-4"></i></button>
    </div>
  </div>
</aside>

<!-- ═══════════════ MAIN ═══════════════ -->
<div class="flex-1 flex flex-col overflow-hidden">

  <!-- TOP BAR -->
  <header class="glass h-14 flex items-center px-4 gap-4 shrink-0 z-30">
    <div class="relative flex-1 max-w-md">
      <i data-lucide="search" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
      <input id="buscadorGlobal" type="text" placeholder="Buscar cuentas, contactos, oportunidades…"
        class="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-ark-blue font-body">
      <div id="searchResults" class="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden hidden z-50 max-h-80 overflow-y-auto"></div>
    </div>

    <div class="flex-1"></div>

    <button id="topBarSuperAdminBtn" onclick="location.hash='#/superadmin'" class="hidden flex items-center gap-2 px-3 py-1.5 rounded-full bg-ark-indigo/15 text-ark-indigo_hi border border-ark-indigo/30 text-xs font-semibold hover:bg-ark-indigo/25 transition-colors">
      <i data-lucide="shield" class="w-3.5 h-3.5"></i> Super Admin
    </button>

    <div class="flex items-center gap-2">
      <div id="userAvatarTop" class="w-8 h-8 rounded-full bg-ark-blue flex items-center justify-center text-white text-xs font-bold">OP</div>
      <button onclick="logout()" class="p-1.5 rounded hover:bg-slate-800 text-slate-400 lg:hidden" title="Salir"><i data-lucide="log-out" class="w-4 h-4"></i></button>
    </div>
  </header>

  <!-- CONTENIDO PRINCIPAL -->
  <main class="flex-1 overflow-y-auto" id="mainContent">

    <!-- ═══════ VISTA: DASHBOARD ═══════ -->
    <section id="vista-dashboard" class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-white">Dashboard General</h1>
          <p class="text-xs text-slate-400">Rendimiento comercial y acciones prioritarias</p>
        </div>
        <button onclick="refreshData()" class="flex items-center gap-2 text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Actualizar
        </button>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" id="kpiGrid"></div>

      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 class="font-semibold text-white flex items-center gap-2">
            <i data-lucide="inbox" class="w-4 h-4 text-ark-rose_hi"></i> Bandeja de Trabajo Urgente
          </h2>
          <span class="badge badge-rojo" id="inboxCount">0 pendientes</span>
        </div>
        <div id="inboxList" class="divide-y divide-slate-800/50"></div>
      </div>
    </section>

    <!-- ═══════ VISTA: PIPELINE KANBAN ═══════ -->
    <section id="vista-pipeline" class="p-6 h-full flex flex-col hidden">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-xl font-bold text-white">Pipeline Comercial</h1>
          <p class="text-xs text-slate-400">Arrastra tarjetas entre columnas o haz clic en la flecha para avanzar</p>
        </div>
        <button onclick="abrirModalNuevaOportunidad()" class="flex items-center gap-2 bg-ark-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-ark-blue/80 transition-colors shadow-lg shadow-ark-blue/20">
          <i data-lucide="plus" class="w-4 h-4"></i> Nueva oportunidad
        </button>
      </div>
      <div class="flex-1 overflow-x-auto pb-4">
        <div id="kanbanBoard" class="flex gap-4 h-full min-w-max"></div>
      </div>
    </section>

    <!-- ═══════ VISTA: CUENTAS ═══════ -->
    <section id="vista-cuentas" class="p-6 space-y-4 hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-white">Cuentas y Despachos</h1>
          <p id="cuentasSub" class="text-xs text-slate-400">Directorio de prospectos y clientes calificados</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="abrirModalNuevaCuenta()" class="flex items-center gap-2 bg-ark-amber text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ark-amber/80 transition-colors">
            <i data-lucide="plus" class="w-4 h-4"></i> Nueva cuenta
          </button>
          <button onclick="exportarCuentasCSV()" class="flex items-center gap-2 border border-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <i data-lucide="download" class="w-4 h-4"></i> CSV
          </button>
          <button onclick="abrirModalImportarSheets()" class="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-sm px-3 py-2 rounded-lg transition-colors font-medium">
            <i data-lucide="sheet" class="w-4 h-4"></i> 📥 Importar Sheets
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2" id="cuentasFiltros">
        <select class="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue" id="filtroTamano" onchange="filtrarCuentas()">
          <option value="">Tamaño (todos)</option>
          <option value="1-5">1-5 empleados</option>
          <option value="6-20">6-20 empleados</option>
          <option value="21-50">21-50 empleados</option>
          <option value="50+">50+ empleados</option>
        </select>
        <select class="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue" id="filtroTenant" onchange="cambiarFiltroTenant(this.value)">
          <option value="">Tenant (todos)</option>
          <option value="acc_ark_ledger">Ark Ledger</option>
          <option value="acc_futura_capital">Futura Capital</option>
        </select>
        <select class="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue font-medium cursor-pointer" id="filtroCiudad" onchange="filtrarCuentas()">
          <option value="">Ciudad (Todas)</option>
        </select>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800 text-left text-slate-400 font-mono text-xs uppercase tracking-wider">
              <th class="px-4 py-3">Razón Social</th>
              <th class="px-4 py-3">SCIAN</th>
              <th class="px-4 py-3">Tamaño</th>
              <th class="px-4 py-3">Fuente</th>
              <th class="px-4 py-3">Tenant</th>
              <th class="px-4 py-3">Ciudad</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody id="cuentasBody" class="divide-y divide-slate-800/50"></tbody>
        </table>
      </div>
    </section>

    <!-- ═══════ VISTA: CONTACTOS ═══════ -->
    <section id="vista-contactos" class="p-6 space-y-4 hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-white">Contactos Clave</h1>
          <p id="contactosSub" class="text-xs text-slate-400">Tomadores de decisión y contactos directos</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button onclick="abrirModalNuevoContacto()" class="flex items-center gap-2 bg-ark-emerald text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ark-emerald/80 transition-colors">
            <i data-lucide="plus" class="w-4 h-4"></i> Nuevo contacto
          </button>
          <button onclick="exportarContactosCSV()" class="flex items-center gap-2 border border-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <i data-lucide="download" class="w-4 h-4"></i> CSV
          </button>
          <button onclick="abrirModalImportarSheets()" class="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-sm px-3 py-2 rounded-lg transition-colors font-medium">
            <i data-lucide="sheet" class="w-4 h-4"></i> 📥 Importar Sheets
          </button>
        </div>
      </div>

      <!-- Barra de Filtros & Búsqueda de Contactos -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div class="flex items-center gap-2 flex-1 max-w-md">
          <div class="relative w-full">
            <i data-lucide="search" class="w-4 h-4 text-slate-500 absolute left-3 top-2.5"></i>
            <input type="text" id="filtroContactosInput" oninput="buscarContactosEnTabla(event)" placeholder="Buscar por médico, consultorio, ciudad, teléfono o WhatsApp..." class="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-ark-blue">
          </div>
        </div>
        <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select id="filtroContactosTenant" onchange="cambiarFiltroTenantContactos(event)" class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-ark-blue font-medium cursor-pointer">
            <option value="">🏢 Tenant (Todos)</option>
            <option value="acc_ark_ledger">Ark Ledger</option>
            <option value="acc_futura_capital">Futura Capital</option>
          </select>
          <select id="filtroContactosCiudad" onchange="cambiarFiltroCiudadContactos(event)" class="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-ark-blue font-medium cursor-pointer">
            <option value="">📍 Ciudad (Todas)</option>
          </select>
          <button data-ct-tab="todos" onclick="cambiarTabContactos('todos')" class="ct-tab-btn active text-xs font-semibold px-3 py-1.5 rounded-full bg-ark-blue/15 text-ark-blue_hi border border-ark-blue/30">Todos</button>
          <button data-ct-tab="con_whatsapp" onclick="cambiarTabContactos('con_whatsapp')" class="ct-tab-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 hover:text-emerald-400">🟢 Con WhatsApp</button>
          <button data-ct-tab="pendientes" onclick="cambiarTabContactos('pendientes')" class="ct-tab-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-300">Pendientes</button>
          <button onclick="alternarOrdenContactos('name')" class="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors ml-1" title="Ordenar A-Z / Z-A">
            <i data-lucide="arrow-down-a-z" class="w-3.5 h-3.5"></i> <span id="lblOrdenContactos">A-Z</span>
          </button>
          <div class="flex items-center gap-1 bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/80 ml-1">
            <button type="button" onclick="scrollTablaContactos(-280)" class="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors" title="Desplazar tabla a la izquierda (◀)">
              <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            </button>
            <span class="text-[10px] text-slate-400 font-mono px-1 select-none">Scroll</span>
            <button type="button" onclick="scrollTablaContactos(280)" class="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors" title="Desplazar tabla a la derecha (▶)">
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Barra Flotante de Acciones Masivas (Estilo Gmail) -->
      <div id="bulkContactosToolbar" class="hidden items-center justify-between bg-slate-800/95 border border-ark-blue/40 rounded-xl px-4 py-2.5 text-xs text-white shadow-lg backdrop-blur-sm transition-all mb-1">
        <div class="flex items-center gap-3">
          <span class="font-bold text-ark-blue_hi flex items-center gap-1.5">
            <i data-lucide="check-square" class="w-4 h-4 text-ark-blue"></i>
            <span id="bulkContactosCount">0</span> seleccionados
          </span>
          <span class="text-slate-600">|</span>
          <button type="button" onclick="seleccionarTodosContactosVisibles()" class="text-slate-300 hover:text-white underline text-[11px]">
            Seleccionar todos los visibles (<span id="bulkTotalVisibleCount">0</span>)
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="ejecutarBulkDeleteContactos()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold transition-colors" title="Eliminar los contactos seleccionados">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            <span>Eliminar seleccionados</span>
          </button>
          <button type="button" onclick="deseleccionarTodosContactos()" class="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Cancelar selección">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg relative">
        <div id="contactosTableScrollContainer" class="overflow-x-auto w-full scroll-smooth">
          <table class="w-full text-sm min-w-[1240px]">
            <thead>
              <tr class="border-b border-slate-800 text-left text-slate-400 font-mono text-xs uppercase tracking-wider select-none bg-slate-900/90">
                <th class="px-3 py-3 w-10 text-center select-none sticky left-0 bg-slate-900/95 backdrop-blur-sm z-10 border-r border-slate-800/80">
                  <input type="checkbox" id="selectAllContactosCheckbox" onchange="toggleSelectAllContactos(event)" class="rounded border-slate-700 bg-slate-800 text-ark-blue focus:ring-0 cursor-pointer" title="Seleccionar todos">
                </th>
                <th class="px-4 py-3 cursor-pointer hover:text-white transition-colors min-w-[190px]" onclick="alternarOrdenContactos('name')">
                  <div class="flex items-center gap-1.5">
                    <span>Nombre</span>
                    <span id="sortIconName" class="text-ark-blue_hi font-bold">▲</span>
                  </div>
                </th>
                <th class="px-4 py-3 cursor-pointer hover:text-white transition-colors min-w-[210px]" onclick="alternarOrdenContactos('account_name')">
                  <div class="flex items-center gap-1.5">
                    <span>Cuenta / Empresa</span>
                    <span id="sortIconAccount" class="text-slate-600">⇅</span>
                  </div>
                </th>
                <th class="px-4 py-3 cursor-pointer hover:text-white transition-colors min-w-[150px]" onclick="alternarOrdenContactos('city')">
                  <div class="flex items-center gap-1.5">
                    <span>Ciudad / Plaza</span>
                    <span id="sortIconCity" class="text-slate-600">⇅</span>
                  </div>
                </th>
                <th class="px-4 py-3 min-w-[180px]">Email</th>
                <th class="px-4 py-3 min-w-[120px]">Teléfono</th>
                <th class="px-4 py-3 cursor-pointer hover:text-white transition-colors min-w-[140px]" onclick="alternarOrdenContactos('whatsapp')">
                  <div class="flex items-center gap-1.5">
                    <span>WhatsApp</span>
                    <span id="sortIconWhatsapp" class="text-slate-600">⇅</span>
                  </div>
                </th>
                <th class="px-4 py-3 cursor-pointer hover:text-white transition-colors min-w-[170px]" onclick="alternarOrdenContactos('title')">
                  <div class="flex items-center gap-1.5">
                    <span>Especialidad / Cargo</span>
                    <span id="sortIconTitle" class="text-slate-600">⇅</span>
                  </div>
                </th>
                <th class="px-4 py-3 text-right sticky right-0 bg-slate-900/95 backdrop-blur-sm border-l border-slate-800/80 shadow-[-8px_0_12px_rgba(0,0,0,0.5)] z-10 min-w-[200px]">Acciones</th>
              </tr>
            </thead>
            <tbody id="contactosBody" class="divide-y divide-slate-800/50"></tbody>
          </table>
        </div>
      </div>

      <!-- Controles de Paginación (50 por página) -->
      <div id="contactosPagination" class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
        <div class="flex items-center gap-2">
          <span>Mostrando <span id="pagStart" class="text-white font-mono font-medium">1</span> - <span id="pagEnd" class="text-white font-mono font-medium">50</span> de <span id="pagTotal" class="text-white font-mono font-medium">0</span> contactos</span>
          <span class="text-slate-600">|</span>
          <span>Página <span id="pagActual" class="text-ark-blue_hi font-bold">1</span> de <span id="pagTotalPags" class="text-slate-300">1</span></span>
        </div>
        <div class="flex items-center gap-1.5">
          <button type="button" onclick="irPrimeraPaginaContactos()" id="btnPagPrimera" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors" title="Primera página">
            <i data-lucide="chevrons-left" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="cambiarPaginaContactos(-1)" id="btnPagAnterior" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors" title="Página anterior">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
            <span class="hidden sm:inline">Anterior</span>
          </button>
          <div id="pagNumerosContainer" class="flex items-center gap-1"></div>
          <button type="button" onclick="cambiarPaginaContactos(1)" id="btnPagSiguiente" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors" title="Página siguiente">
            <span class="hidden sm:inline">Siguiente</span>
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
          <button type="button" onclick="irUltimaPaginaContactos()" id="btnPagUltima" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors" title="Última página">
            <i data-lucide="chevrons-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </section>

    <!-- ═══════ VISTA: TAREAS ═══════ -->
    <section id="vista-tareas" class="p-6 space-y-4 hidden">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 class="text-xl font-bold text-white">Tareas de Seguimiento</h1>
        <div class="flex items-center gap-3">
          <div class="flex gap-2" id="tareasFiltros">
            <button data-tf="todas" class="tf-btn active text-xs font-semibold px-3 py-1.5 rounded-full bg-ark-blue/15 text-ark-blue_hi border border-ark-blue/30">Todas</button>
            <button data-tf="vencidas" class="tf-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Vencidas</button>
            <button data-tf="hoy" class="tf-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Hoy</button>
            <button data-tf="semana" class="tf-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Esta semana</button>
          </div>
          <button onclick="abrirModalNuevaTarea()" class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nueva tarea
          </button>
        </div>
      </div>
      <div id="tareasList" class="space-y-2"></div>
    </section>

    <!-- ═══════ VISTA: SUPER ADMIN (EXCLUSIVA ADMIN) ═══════ -->
    <section id="vista-superadmin" class="p-6 space-y-6 hidden">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-ark-indigo/15 border border-ark-indigo/30 flex items-center justify-center">
            <i data-lucide="shield" class="w-5 h-5 text-ark-indigo_hi"></i>
          </div>
          <div>
            <h1 class="text-xl font-bold text-white">Consola de Gobernanza & Super Admin</h1>
            <p class="text-xs text-slate-400">Control institucional exclusivo: Colaboradores, Multi-tenant, Correo Masivo & Voz AI</p>
          </div>
        </div>
        <button onclick="abrirModalInvitarUsuario()" class="flex items-center gap-2 bg-ark-indigo hover:bg-ark-indigo/80 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-lg shadow-ark-indigo/20">
          <i data-lucide="user-plus" class="w-4 h-4"></i> + Invitar Colaborador Comercial
        </button>
      </div>

      <!-- Sección 1: Equipo y Colaboradores Comerciales -->
      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="users" class="w-4 h-4 text-ark-blue_hi"></i>
            <h3 class="font-semibold text-white text-sm">Equipo Comercial y Accesos</h3>
          </div>
          <span class="text-xs font-mono text-slate-500" id="usersCountBadge">Cargando…</span>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800 text-left text-slate-400 font-mono text-xs uppercase tracking-wider">
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Correo</th>
              <th class="px-4 py-3">Rol</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Fecha Alta</th>
            </tr>
          </thead>
          <tbody id="usuariosAdminBody" class="divide-y divide-slate-800/50">
            <tr><td colspan="5" class="p-4 text-center text-xs text-slate-500">Cargando colaboradores…</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Sección 2: Central de Comunicaciones Unificada (Softphone Telnyx + Mailing Resend) -->
      <div class="grid lg:grid-cols-12 gap-6">
        
        <!-- Panel Izquierdo: Softphone Telnyx Voice AI (5 Cols) -->
        <div class="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <h3 class="font-bold text-white text-sm flex items-center gap-2">
                <i data-lucide="phone-call" class="w-4 h-4 text-ark-blue_hi"></i> Softphone Telnyx Voice AI
              </h3>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              Troncal +52 MX
            </span>
          </div>

          <div class="p-5 space-y-4 flex-1 flex flex-col justify-between">
            <!-- Pantalla Display -->
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center relative">
              <div id="softphoneStatusText" class="text-[11px] font-mono text-slate-400 mb-1 flex items-center justify-center gap-1.5">
                <span id="softphoneDot" class="inline-block w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                <span id="softphoneStatusLabel">Listo para marcar</span>
              </div>
              <input id="softphonePhoneInput" type="text" placeholder="+52 55..." 
                class="w-full bg-transparent text-center font-mono text-xl text-white font-bold tracking-wider focus:outline-none placeholder-slate-700">
              <button onclick="softphoneClear()" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1">
                <i data-lucide="delete" class="w-4 h-4"></i>
              </button>
            </div>

            <!-- Selector de Script / Modo de Disparo -->
            <div class="space-y-1.5">
              <label class="block text-xs font-mono text-slate-400">Speech de IA (Voz Natural)</label>
              <select id="softphoneSpeechMode" onchange="onSoftphoneSpeechChange()" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-ark-blue">
                <option value="demo_60s">📞 Demo en Vivo (Ark Angel · 60s pitch)</option>
                <option value="gancho_30dias">🚀 Gancho 30 Días Gratis (Ark Commerce)</option>
                <option value="fiscal_despachos">⚖️ Cierre Fiscal & SAT (Ark Ledger)</option>
                <option value="custom">✍️ Guion Personalizado (Texto a Voz)</option>
              </select>
              <div id="softphoneCustomTextBox" class="hidden mt-2">
                <textarea id="softphoneCustomText" rows="2" placeholder="Escribe el mensaje exacto que la voz de IA dirá en la llamada..." class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-ark-blue"></textarea>
              </div>
            </div>

            <!-- Keypad Numérico -->
            <div class="grid grid-cols-3 gap-2 max-w-[260px] mx-auto w-full my-2">
              <button onclick="softphonePress('1')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">1</button>
              <button onclick="softphonePress('2')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">2</button>
              <button onclick="softphonePress('3')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">3</button>
              <button onclick="softphonePress('4')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">4</button>
              <button onclick="softphonePress('5')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">5</button>
              <button onclick="softphonePress('6')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">6</button>
              <button onclick="softphonePress('7')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">7</button>
              <button onclick="softphonePress('8')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">8</button>
              <button onclick="softphonePress('9')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">9</button>
              <button onclick="softphonePress('*')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">*</button>
              <button onclick="softphonePress('0')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">0</button>
              <button onclick="softphonePress('#')" class="h-10 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-white font-mono font-bold text-base transition-colors">#</button>
            </div>

            <!-- Botones de Acción -->
            <div class="flex gap-2 pt-2">
              <button id="softphoneCallBtn" onclick="iniciarLlamadaSoftphone()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-600/20 transition-all">
                <i data-lucide="phone" class="w-4 h-4"></i> Iniciar Llamada IA
              </button>
              <button id="softphoneHangupBtn" onclick="colgarSoftphone()" class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-1.5 text-sm transition-all border border-rose-600/30">
                <i data-lucide="phone-off" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Panel Derecho: Consola de Disparo de Correos Resend (7 Cols) -->
        <div class="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div class="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div class="flex items-center gap-2">
              <div class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
              <h3 class="font-bold text-white text-sm flex items-center gap-2">
                <i data-lucide="mail" class="w-4 h-4 text-ark-blue_hi"></i> Consola de Disparo de Correo (Resend)
              </h3>
            </div>
            <span class="text-[10px] font-mono text-slate-400">ventas@mail.arksystems.site</span>
          </div>

          <div class="p-5 space-y-4 flex-1 flex flex-col">
            <!-- Selector de Plantilla y Modo -->
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-mono text-slate-400">Plantilla de Campaña</label>
                  <button type="button" onclick="borrarPlantillaSeleccionada()" class="text-[11px] font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-900/40 flex items-center gap-1 transition-all" title="Eliminar la plantilla seleccionada">
                    <i data-lucide="trash-2" class="w-3 h-3"></i> Borrar
                  </button>
                </div>
                <select id="emailConsoleTemplateSelect" onchange="onTemplateSelectChange()" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-ark-blue">
                  <option value="gancho_landing_30dias">🚀 Ark Commerce · Gancho 30 Días Gratis</option>
                  <option value="tmpl_ark_ledger_invitacion_despachos">⚖️ Ark Ledger · Despachos Contables</option>
                  <option value="canaco_siem_invitacion">🏛️ CANACO · Convenio SIEM</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-mono text-slate-400 mb-1">Modo de Disparo</label>
                <div class="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
                  <button id="emailModeSingleBtn" onclick="setEmailDispatchMode('single')" class="flex-1 py-1.5 text-xs font-medium rounded-md bg-ark-blue text-white transition-all">Individual / Test</button>
                  <button id="emailModeCohortBtn" onclick="setEmailDispatchMode('cohort')" class="flex-1 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-all">Por Cohorte</button>
                </div>
              </div>
            </div>

            <!-- Formulario Individual -->
            <div id="emailFormSingle" class="grid sm:grid-cols-3 gap-2">
              <input id="emailTargetName" type="text" placeholder="Nombre contacto" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-ark-blue">
              <input id="emailTargetCompany" type="text" placeholder="Empresa / Despacho" class="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-ark-blue">
              <div class="flex gap-2">
                <input id="emailTargetAddress" type="email" placeholder="correo@ejemplo.com" class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-ark-blue">
                <button onclick="dispararCorreoIndividual()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-lg shadow-blue-600/20">
                  <i data-lucide="send" class="w-3.5 h-3.5"></i> Disparar
                </button>
              </div>
            </div>

            <!-- Formulario Cohorte (Oculto por defecto) -->
            <div id="emailFormCohort" class="hidden flex gap-2 items-center">
              <div class="flex-1">
                <select id="emailCohortSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-ark-blue">
                  <option value="ark_ledger_despachos">ark_ledger_despachos (73 Cuentas D1)</option>
                  <option value="canaco_siem_1200">canaco_siem_1200 (1,200 Agremiados CANACO)</option>
                  <option value="futura_us_investors">futura_us_investors (Inversionistas Futura Capital)</option>
                </select>
              </div>
              <button onclick="dispararCampañaCohorte()" class="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-lg shadow-purple-600/20">
                <i data-lucide="rocket" class="w-3.5 h-3.5"></i> Disparar Lote Masivo
              </button>
            </div>

            <!-- Previsualizador HTML en Vivo -->
            <div class="flex-1 flex flex-col border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <div class="px-3 py-1.5 border-b border-slate-800 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                <span>PREVIEW EN VIVO DEL CORREO</span>
                <span id="emailPreviewSubject" class="text-slate-400 truncate max-w-xs">Asunto cargando...</span>
              </div>
              <div class="flex-1 min-h-[220px] max-h-[280px] overflow-y-auto bg-slate-950 p-2">
                <iframe id="emailPreviewFrame" class="w-full h-[360px] border-0 rounded bg-white"></iframe>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Sección 3: Multi-Tenant & Cohortes -->
      <div class="grid md:grid-cols-2 gap-4">
        <!-- Multi-Tenant -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 class="font-semibold text-white mb-3 flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4 text-ark-amber_hi"></i> Tenants Activos</h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div>
                <span class="text-sm font-medium text-white block">Ark Ledger</span>
                <span class="text-xs font-mono text-slate-400">acc_ark_ledger</span>
              </div>
              <span class="badge badge-esmeralda">Producción</span>
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div>
                <span class="text-sm font-medium text-white block">Futura Capital</span>
                <span class="text-xs font-mono text-slate-400">acc_futura_capital</span>
              </div>
              <span class="badge badge-esmeralda">Producción</span>
            </div>
          </div>
        </div>

        <!-- Cohortes DENUE -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 class="font-semibold text-white mb-3 flex items-center gap-2"><i data-lucide="database" class="w-4 h-4 text-ark-blue_hi"></i> Cohortes DENUE</h3>
          <p class="text-xs text-slate-400 mb-3">Cohorte <code class="text-ark-blue_hi font-mono">ark_ledger_despachos</code> con leads de despachos contables cosechados.</p>
          <div class="flex gap-2">
            <button onclick="exportarCohorteCSV()" class="flex-1 bg-slate-800 border border-slate-700 text-sm py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> CSV
            </button>
            <button onclick="exportarCohortePDF()" class="flex-1 bg-slate-800 border border-slate-700 text-sm py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
              <i data-lucide="printer" class="w-3.5 h-3.5"></i> Imprimir
            </button>
          </div>
        </div>
      </div>
    </section>

  </main>
</div>

<!-- ═══════════════ MODAL CUENTA (DRAWER) ═══════════════ -->
<div id="modalCuenta" class="fixed inset-0 z-50 hidden">
  <div class="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="cerrarModalCuenta()"></div>
  <div class="modal-content absolute right-0 top-0 h-full w-full max-w-lg bg-slate-900 border-l border-slate-800 overflow-y-auto">
    <div class="p-6" id="modalCuentaContent"></div>
  </div>
</div>

<!-- ═══════════════ MODAL NUEVA OPORTUNIDAD ═══════════════ -->
<div id="modalNuevaOportunidad" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalNuevaOportunidad()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold text-white">Nueva Oportunidad</h3>
      <button onclick="cerrarModalNuevaOportunidad()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="formNuevaOportunidad" onsubmit="guardarNuevaOportunidad(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Cuenta / Despacho</label>
        <select id="oppAccountSelect" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue"></select>
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Nombre de la oportunidad</label>
        <input type="text" id="oppNombreInput" placeholder="Ej. Implementación Ark Ledger Contable" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Monto Estimado (MXN)</label>
          <input type="number" id="oppMontoInput" value="399" min="0" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Etapa Inicial</label>
          <select id="oppEtapaSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
            <option value="nuevo">Nuevo</option>
            <option value="contactado">Contactado</option>
            <option value="calificado">Calificado</option>
            <option value="demo_agendada">Demo Agendada</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Fecha estimada de cierre</label>
        <input type="date" id="oppFechaCierreInput" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="cerrarModalNuevaOportunidad()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-blue text-white text-xs font-semibold hover:bg-ark-blue/80">Crear oportunidad</button>
      </div>
    </form>
  </div>
</div>

<!-- ═══════════════ MODAL NUEVA CUENTA ═══════════════ -->
<div id="modalNuevaCuenta" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalNuevaCuenta()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold text-white">Nueva Cuenta / Razón Social</h3>
      <button onclick="cerrarModalNuevaCuenta()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="formNuevaCuenta" onsubmit="guardarNuevaCuenta(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Razón Social</label>
        <input type="text" id="accNombreInput" placeholder="Ej. Soluciones Fiscales Península SC" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Ciudad</label>
          <input type="text" id="accCiudadInput" placeholder="Mérida" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Tamaño</label>
          <select id="accTamanoSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
            <option value="1-5">1-5 empleados</option>
            <option value="6-20">6-20 empleados</option>
            <option value="21-50">21-50 empleados</option>
            <option value="50+">50+ empleados</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Tenant Asignado</label>
        <select id="accTenantSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
          <option value="acc_ark_ledger">Ark Ledger (Contable / Fiscal)</option>
          <option value="acc_futura_capital">Futura Capital</option>
        </select>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="cerrarModalNuevaCuenta()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-amber text-white text-xs font-semibold hover:bg-ark-amber/80">Guardar cuenta</button>
      </div>
    </form>
  </div>
</div>

<!-- ═══════════════ MODAL NUEVO CONTACTO ═══════════════ -->
<div id="modalNuevoContacto" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalNuevoContacto()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold text-white">Nuevo Contacto</h3>
      <button onclick="cerrarModalNuevoContacto()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="formNuevoContacto" onsubmit="guardarNuevoContacto(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Cuenta</label>
        <select id="ctAccountSelect" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue"></select>
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Nombre Completo</label>
        <input type="text" id="ctNombreInput" placeholder="Lic. Roberto Herrera" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Email</label>
          <input type="email" id="ctEmailInput" placeholder="roberto@despacho.mx" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Teléfono Consultorio</label>
          <input type="text" id="ctTelInput" placeholder="+52 999 123 4567" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
      </div>
      <div>
        <label class="block text-xs font-mono text-emerald-400 mb-1 flex items-center gap-1"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i> WhatsApp / Móvil Directo</label>
        <input type="text" id="ctWhatsAppInput" placeholder="+52 999 987 6543" class="w-full bg-slate-950 border border-emerald-500/40 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-white">
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="cerrarModalNuevoContacto()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-emerald text-white text-xs font-semibold hover:bg-ark-emerald/80">Guardar contacto</button>
      </div>
    </form>
  </div>
</div>

<!-- ═══════════════ MODAL EDITAR CONTACTO ═══════════════ -->
<div id="modalEditarContacto" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalEditarContacto()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-ark-blue/15 border border-ark-blue/30 flex items-center justify-center">
          <i data-lucide="user-check" class="w-4 h-4 text-ark-blue_hi"></i>
        </div>
        <div>
          <h3 class="text-base font-bold text-white">Editar Contacto</h3>
          <p id="editCtCuentaNombre" class="text-xs text-slate-400 font-medium"></p>
        </div>
      </div>
      <button onclick="cerrarModalEditarContacto()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="formEditarContacto" onsubmit="guardarEditarContacto(event)" class="space-y-4">
      <input type="hidden" id="editCtId">
      <input type="hidden" id="editCtModalAccountId">
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Nombre Completo / Decisor</label>
        <input type="text" id="editCtNombreInput" placeholder="Ej. Dr. Yair Benjamín Baas Cabrera" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Cargo / Especialidad</label>
        <input type="text" id="editCtCargoInput" placeholder="Ej. Director Médico / Titular" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Email Real</label>
          <input type="email" id="editCtEmailInput" placeholder="contacto@doctor.com" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
        <div>
          <label class="block text-xs font-mono text-slate-400 mb-1">Teléfono Consultorio</label>
          <input type="text" id="editCtTelInput" placeholder="+52 999 123 4567" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
      </div>
      <div>
        <label class="block text-xs font-mono text-emerald-400 mb-1 flex items-center gap-1"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i> WhatsApp / Móvil Directo (Alto Valor)</label>
        <input type="text" id="editCtWhatsAppInput" placeholder="+52 999 987 6543" class="w-full bg-slate-950 border border-emerald-500/40 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm text-white">
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Estatus Consentimiento (LFPDPPP)</label>
        <select id="editCtConsentSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
          <option value="opt_in">Opt-in (Verificado / Prospección permitida)</option>
          <option value="pendiente">Pendiente de confirmación</option>
          <option value="opt_out">Opt-out (No contactar)</option>
        </select>
      </div>
      <section class="space-y-3 border-t border-slate-800 pt-4" aria-labelledby="editCtNotesHeading">
        <div class="flex items-center justify-between">
          <div>
            <h4 id="editCtNotesHeading" class="text-sm font-semibold text-white">Notas del contacto</h4>
            <p class="text-[11px] text-slate-500">El historial se guarda por separado de los datos del contacto.</p>
          </div>
        </div>
        <div id="editCtNotesList" class="max-h-40 space-y-2 overflow-y-auto" aria-live="polite">
          <p class="text-xs text-slate-500">Cargando notas…</p>
        </div>
        <div class="space-y-2">
          <label for="editCtNoteInput" class="block text-xs font-mono text-slate-400">Agregar una nota</label>
          <textarea id="editCtNoteInput" maxlength="10000" rows="2" placeholder="Escribe contexto o detalles de seguimiento…" class="w-full resize-y rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-ark-blue"></textarea>
          <div class="flex justify-end">
            <button type="button" id="editCtNoteSaveButton" onclick="guardarNotaContacto()" class="rounded-lg border border-ark-blue/30 bg-ark-blue/10 px-3 py-1.5 text-xs font-semibold text-ark-blue_hi hover:bg-ark-blue/20">
              Guardar nota
            </button>
          </div>
        </div>
      </section>
      <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
        <button type="button" onclick="cerrarModalEditarContacto()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-blue hover:bg-ark-blue/80 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
          <i data-lucide="check" class="w-3.5 h-3.5"></i> Guardar cambios
        </button>
      </div>
    </form>
  </div>
</div>

<!-- ═══════════════ MODAL NUEVA TAREA ═══════════════ -->
<div id="modalNuevaTarea" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalNuevaTarea()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold text-white">Nueva Tarea</h3>
      <button onclick="cerrarModalNuevaTarea()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="formNuevaTarea" onsubmit="guardarNuevaTarea(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Título de la tarea</label>
        <input type="text" id="taskTituloInput" placeholder="Llamar a despacho para agendar demo" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Fecha de vencimiento</label>
        <input type="date" id="taskFechaInput" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="cerrarModalNuevaTarea()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-blue text-white text-xs font-semibold hover:bg-ark-blue/80">Guardar tarea</button>
      </div>
    </form>
  </div>
</div>

<!-- ═══════════════ MODAL INVITAR COLABORADOR COMERCIAL (SUPER ADMIN) ═══════════════ -->
<div id="modalInvitarUsuario" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalInvitarUsuario()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <i data-lucide="user-plus" class="w-5 h-5 text-ark-indigo_hi"></i>
        <h3 class="text-lg font-bold text-white">Alta de Colaborador Comercial</h3>
      </div>
      <button onclick="cerrarModalInvitarUsuario()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <form id="formInvitarUsuario" onsubmit="guardarNuevoUsuario(event)" class="space-y-4">
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Nombre Completo</label>
        <input type="text" id="usrNombreInput" placeholder="Ej. Carlos Mendoza" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Correo de Acceso</label>
        <input type="email" id="usrEmailInput" placeholder="carlos@arksystems.site" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Contraseña Inicial</label>
        <input type="password" id="usrPasswordInput" minlength="8" placeholder="Mínimo 8 caracteres" required class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
      </div>
      <div>
        <label class="block text-xs font-mono text-slate-400 mb-1">Rol de Permisos</label>
        <select id="usrRolSelect" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
          <option value="vendedor">Vendedor (Pipeline, Cuentas, Contactos y Tareas)</option>
          <option value="lector">Lector (Solo Consulta / Auditor)</option>
          <option value="admin">Super Administrador (Acceso Total y Configuración)</option>
        </select>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="cerrarModalInvitarUsuario()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-indigo text-white text-xs font-semibold hover:bg-ark-indigo/80">Crear Colaborador</button>
      </div>
    </form>
  </div>
</div>

<!-- ═══════════════ MODAL PLANTILLA EMAIL ═══════════════ -->
<div id="modalPlantilla" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalPlantilla()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-lg font-bold text-white">Plantilla: Invitación Despachos Ark Ledger</h3>
        <span class="text-xs font-mono text-ark-indigo_hi">tmpl_ark_ledger_invitacion_despachos</span>
      </div>
      <button onclick="cerrarModalPlantilla()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <div class="space-y-4">
      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm">
        <div class="text-xs text-slate-400 font-mono mb-2">Asunto: Invitación exclusiva: Optimice la carga contable y fiscal de {{despacho_nombre}}</div>
        <div class="text-slate-300 whitespace-pre-wrap leading-relaxed text-xs font-mono bg-slate-900/60 p-3 rounded-lg border border-slate-800">
Estimado equipo de {{despacho_nombre}},

Detectamos en la región de {{ciudad}} una creciente demanda de automatización en conciliación fiscal y SAT para despachos de {{tamano}} integrantes.

Ark Ledger permite integrar la facturación y validación con su stack contable existente, reduciendo tiempos manuales en hasta un 70%.

¿Tendría 10 minutos esta semana para una demostración personalizada?

Atentamente,
Equipo Comercial ARK Systems
        </div>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-400 font-mono">
        <span>Variables dinámicas: {{despacho_nombre}}, {{ciudad}}, {{tamano}}</span>
        <button onclick="toast('Plantilla actualizada');cerrarModalPlantilla()" class="px-4 py-2 bg-ark-indigo text-white font-semibold rounded-lg hover:bg-ark-indigo/80">Guardar cambios</button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════ MODAL IMPORTAR SHEETS / CSV ═══════════════ -->
<div id="modalImportar" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/75 backdrop-blur-sm" onclick="cerrarModalImportarSheets()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl z-10 flex flex-col max-h-[90vh]">
    <div class="flex items-center justify-between pb-3 border-b border-slate-800">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
          <i data-lucide="sheet" class="w-4 h-4"></i>
        </div>
        <div>
          <h3 class="text-base font-bold text-white">Importador desde Google Sheets / CSV</h3>
          <p class="text-xs text-slate-400">Pega directamente celdas copiadas de Google Sheets o Excel para crear Cuentas, Contactos y Pipeline</p>
        </div>
      </div>
      <button onclick="cerrarModalImportarSheets()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>

    <div class="space-y-4 py-4 overflow-y-auto flex-1 pr-1">
      <div class="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-400 space-y-1">
        <div class="font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
          <i data-lucide="info" class="w-3.5 h-3.5"></i> Formato sugerido de columnas:
        </div>
        <p class="font-mono text-[11px] text-slate-300">Despacho | Titular | Email | Teléfono | Ciudad</p>
        <p class="text-[11px] text-slate-500">Detecta tabuladores (<code class="text-slate-400">\t</code>), comas o punto y coma. Se creará la Cuenta (<code class="text-slate-400">acc_ark_ledger</code>), el Contacto (<code class="text-slate-400">Socio / Titular</code>) y la Oportunidad en etapa <code class="text-emerald-400">calificado</code>.</p>
      </div>

      <div>
        <label class="block text-xs font-semibold text-slate-300 mb-1.5">Pega aquí los datos copiados de Google Sheets:</label>
        <textarea id="importarTextarea" rows="6" oninput="actualizarPreviewImportarSheets()" placeholder="Despacho Contable ABC&#9;Lic. Carlos Morales&#9;carlos@morales.com&#9;5512345678&#9;CDMX&#10;Consultores Fiscales Sureste&#9;C.P. Ana Ruiz&#9;ana@ruizfiscal.com&#9;9991234567&#9;Mérida" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:border-ark-blue focus:ring-0 leading-relaxed"></textarea>
      </div>

      <!-- Vista previa en vivo -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <i data-lucide="eye" class="w-3.5 h-3.5 text-ark-blue"></i> Vista Previa (<span id="previewSheetsCount" class="text-ark-blue_hi font-bold">0</span> filas detectadas)
          </span>
          <span id="previewSheetsNotice" class="text-[11px] text-slate-500 font-mono"></span>
        </div>
        <div class="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 max-h-48 overflow-y-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800 sticky top-0">
              <tr>
                <th class="px-3 py-2 w-8">#</th>
                <th class="px-3 py-2">Despacho / Empresa</th>
                <th class="px-3 py-2">Titular</th>
                <th class="px-3 py-2">Email</th>
                <th class="px-3 py-2">Teléfono</th>
                <th class="px-3 py-2">Ciudad</th>
              </tr>
            </thead>
            <tbody id="previewSheetsBody" class="divide-y divide-slate-800/40 text-slate-300">
              <tr>
                <td colspan="6" class="p-4 text-center text-slate-500 italic">Pega contenido en el área superior para ver la previsualización.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between pt-3 border-t border-slate-800">
      <div id="importSheetsStatusMsg" class="text-xs font-mono text-slate-400"></div>
      <div class="flex items-center gap-2">
        <button type="button" onclick="cerrarModalImportarSheets()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors">Cancelar</button>
        <button type="button" id="btnConfirmarImportarSheets" onclick="ejecutarImportarSheets()" disabled class="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors shadow-md">
          <i data-lucide="check" class="w-4 h-4"></i> Confirmar e Importar al CRM
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ═══════════════ MODAL CONFIRMAR ELIMINACIÓN ═══════════════ -->
<div id="modalConfirmar" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalConfirmar()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl z-10 space-y-4">
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <i data-lucide="trash-2" class="w-5 h-5 text-rose-400"></i>
      </div>
      <div>
        <h3 id="modalConfirmarTitulo" class="text-base font-bold text-white">¿Confirmar eliminación?</h3>
        <p id="modalConfirmarMensaje" class="text-xs text-slate-400 mt-1">Esta acción es permanente y no se puede revertir.</p>
      </div>
    </div>
    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
      <button type="button" onclick="cerrarModalConfirmar()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors">Cancelar</button>
      <button type="button" id="btnConfirmarEliminar" class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar definitivamente
      </button>
    </div>
  </div>
</div>

<!-- ═══════════════ TOAST ═══════════════ -->
<div id="toast" class="fixed bottom-5 right-5 z-50 hidden bg-slate-800 border border-slate-700 text-slate-100 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-medium toast-in flex items-center gap-2"></div>

<script>
/* ARK CRM SPA — Unified Sales & Governance */
const TOKEN = localStorage.getItem('ark_crm_token');
if (!TOKEN) {
  window.location.href = '/crm/login';
}

function logout() {
  localStorage.removeItem('ark_crm_token');
  fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
    window.location.href = '/crm/login';
  });
}

// ── FETCH HELPER ──
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin'
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(endpoint, options);
  if (res.status === 401) {
    localStorage.removeItem('ark_crm_token');
    window.location.href = '/crm/login';
    return null;
  }
  return await res.json();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// ── ESTADO LOCAL DE DATOS ──
let state = {
  user: null,
  accounts: [],
  contacts: [],
  opportunities: [],
  tasks: [],
  metrics: null,
  inbox: [],
  users: []
};

const ETAPAS = [
  { key: "nuevo", label: "Nuevo", color: "ark-blue_hi" },
  { key: "contactado", label: "Contactado", color: "ark-blue_hi" },
  { key: "calificado", label: "Calificado", color: "ark-amber_hi" },
  { key: "demo_agendada", label: "Demo Agendada", color: "ark-amber_hi" },
  { key: "propuesta_enviada", label: "Propuesta Enviada", color: "ark-indigo_hi" },
  { key: "negociacion", label: "Negociación", color: "ark-indigo_hi" },
  { key: "ganado", label: "Ganado", color: "ark-emerald_hi" },
  { key: "perdido", label: "Perdido", color: "ark-rose_hi" }
];

// ── INICIALIZAR SESIÓN DE USUARIO Y CONTROL DE ROLES (RBAC) ──
async function initUser() {
  try {
    const data = await apiCall('/api/auth/me');
    if (data && data.user) {
      state.user = data.user;
      const email = data.user.email || 'comercial@ark.mx';
      const initials = (email.split('@')[0] || 'OP').slice(0, 2).toUpperCase();
      const isAdmin = data.user.role === 'admin';
      const roleLabel = isAdmin ? 'Super Admin' : (data.user.role === 'vendedor' ? 'Ventas' : 'Lector');
      
      document.getElementById('userEmailSidebar').textContent = email;
      document.getElementById('userRoleSidebar').textContent = roleLabel;
      document.getElementById('userAvatarSidebar').textContent = initials;
      document.getElementById('userAvatarTop').textContent = initials;

      // Control de visibilidad según rol
      const superAdminDiv = document.getElementById('sidebarSuperAdminDiv');
      const topBarBtn = document.getElementById('topBarSuperAdminBtn');

      if (isAdmin) {
        if (superAdminDiv) superAdminDiv.classList.remove('hidden');
        if (topBarBtn) topBarBtn.classList.remove('hidden');
      } else {
        if (superAdminDiv) superAdminDiv.classList.add('hidden');
        if (topBarBtn) topBarBtn.classList.add('hidden');
      }
    }
  } catch(e) {
    console.warn('Error cargando usuario:', e);
  }
}

// ── ROUTER ──
function router() {
  const hash = location.hash || '#/dashboard';
  const vista = hash.replace('#/', '') || 'dashboard';

  // Si intenta entrar a Super Admin sin rol de admin, redirigir
  if (vista === 'superadmin' && state.user && state.user.role !== 'admin') {
    toast('Acceso restringido: Se requiere rol de Super Administrador');
    location.hash = '#/dashboard';
    return;
  }

  document.querySelectorAll('#mainContent > section').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById('vista-' + vista);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector('.nav-item[href="#/' + vista + '"]');
  if (navEl) navEl.classList.add('active');

  if (vista === 'dashboard') renderDashboard();
  if (vista === 'pipeline') renderKanban();
  if (vista === 'cuentas') renderCuentas();
  if (vista === 'contactos') renderContactos();
  if (vista === 'tareas') renderTareas();
  if (vista === 'superadmin') renderSuperadmin();

  lucide.createIcons();
}

async function refreshData() {
  toast('Actualizando datos de producción…');
  await Promise.all([loadMetrics(), loadAccounts(), loadOpportunities(), loadContacts(), loadTasks()]);
  router();
  toast('Datos actualizados');
}

// ── DATA LOADERS ──
async function loadMetrics() {
  try {
    const m = await apiCall('/api/crm/metrics');
    if (m) state.metrics = m;
    const ib = await apiCall('/api/crm/inbox');
    if (ib && ib.inbox) state.inbox = ib.inbox;
  } catch (e) { console.error('loadMetrics error:', e); }
}

async function loadAccounts(tenant = '') {
  try {
    const tVal = tenant || document.getElementById('filtroTenant')?.value || '';
    const url = tVal 
      ? '/api/crm/accounts?limit=100&offset=0&tenant=' + encodeURIComponent(tVal)
      : '/api/crm/accounts?limit=100&offset=0';
    const data = await apiCall(url);
    state.accounts = (data && data.items) || [];
    state.accountsTotal = data?.total ?? state.accounts.length;
    actualizarOpcionesFiltroCiudades();
  } catch (e) { console.error('loadAccounts error:', e); }
}

async function loadOpportunities() {
  try {
    const data = await apiCall('/api/crm/opportunities?limit=200');
    if (data && data.items) state.opportunities = data.items;
  } catch (e) { console.error('loadOpportunities error:', e); }
}

async function loadContacts(tenant = '') {
  try {
    const tVal = tenant || filtroContactosTenant || '';
    const url = tVal 
      ? '/api/crm/contacts?limit=100&offset=0&tenant=' + encodeURIComponent(tVal)
      : '/api/crm/contacts?limit=100&offset=0';
    const data = await apiCall(url);
    state.contacts = (data && data.items) || [];
    state.contactsTotal = data?.total ?? state.contacts.length;
    actualizarOpcionesFiltroCiudades();
  } catch (e) { console.error('loadContacts error:', e); }
}

async function loadTasks() {
  try {
    const data = await apiCall('/api/crm/tasks?limit=200');
    if (data && data.items) state.tasks = data.items;
  } catch (e) { console.error('loadTasks error:', e); }
}

async function loadUsers() {
  try {
    const data = await apiCall('/api/crm/admin/users');
    if (data && data.users) state.users = data.users;
  } catch(e) { console.warn('loadUsers:', e); }
}

// ── DASHBOARD ──
async function renderDashboard() {
  if (!state.metrics) await loadMetrics();
  const m = state.metrics || {};
  const o = m.opportunities || {};
  const t = m.tasks || {};
  const ent = m.entities || {};

  const totalOpps = o.total !== undefined ? o.total : state.opportunities.length;
  const convRate = o.conversion_rate_percent !== undefined ? o.conversion_rate_percent : 0;
  const avgDays = o.avg_time_to_close_days !== undefined ? o.avg_time_to_close_days : 0;
  const overdueCount = t.overdue !== undefined ? t.overdue : 0;
  const accCount = ent.accounts !== undefined ? ent.accounts : state.accounts.length;
  const contCount = ent.contacts !== undefined ? ent.contacts : state.contacts.length;
  const leadsCount = ent.leads !== undefined ? ent.leads : 0;

  document.getElementById('tareasBadge').textContent = overdueCount;

  const kpis = [
    { label: "Oportunidades Activas", value: totalOpps, sub: (o.won || 0) + " ganadas · " + (o.lost || 0) + " perdidas", icon: "target", color: "text-ark-blue_hi" },
    { label: "Conversión", value: convRate + "%", sub: avgDays + " días promedio de cierre", icon: "trending-up", color: "text-ark-emerald_hi" },
    { label: "Tareas Vencidas", value: overdueCount, sub: overdueCount > 0 ? "Requieren acción hoy" : "Al día", icon: "alert-triangle", color: "text-ark-rose_hi" },
    { label: "Cuentas / Contactos", value: accCount.toLocaleString(), sub: contCount + " contactos · " + leadsCount + " leads DENUE", icon: "users", color: "text-ark-amber_hi" },
  ];

  document.getElementById('kpiGrid').innerHTML = kpis.map(k => \`
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-mono text-slate-500 uppercase tracking-wider">\${k.label}</span>
        <i data-lucide="\${k.icon}" class="w-4 h-4 \${k.color}"></i>
      </div>
      <div class="font-mono text-2xl font-semibold text-white">\${k.value}</div>
      <div class="text-xs text-slate-400 mt-1">\${k.sub}</div>
    </div>\`).join('');

  // Inbox
  const inboxList = state.inbox || [];
  document.getElementById('inboxCount').textContent = \`\${inboxList.length} pendientes\`;
  document.getElementById('inboxList').innerHTML = inboxList.length === 0
    ? '<p class="p-5 text-sm text-slate-500">Sin pendientes urgentes en la bandeja 🎉</p>'
    : inboxList.map(item => {
        const opp = item.opportunity || {};
        const acc = state.accounts.find(a => a.id === opp.account_id) || {};
        const nombre = acc.name || ('Oportunidad ' + (opp.id ? opp.id.slice(0,8) : ''));
        const dias = item.days_since_activity || 0;
        return \`
        <div class="flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/30 transition-colors">
          <div class="flex items-center gap-3">
            <span class="badge \${dias >= 5 ? 'badge-rojo' : 'badge-ambar'}">\${dias}d sin contacto</span>
            <div>
              <div class="text-sm font-medium text-white">\${nombre}</div>
              <div class="text-xs text-slate-400 font-mono">\${opp.stage || 'nuevo'} · $\${opp.estimated_value || 399} MXN</div>
            </div>
          </div>
          <button onclick="actuarInbox('\${opp.id}')" class="text-xs bg-ark-blue/15 text-ark-blue_hi border border-ark-blue/30 px-3 py-1.5 rounded-lg hover:bg-ark-blue/25 transition-colors font-semibold">Actuar</button>
        </div>\`;
      }).join('');

  lucide.createIcons();
}

function actuarInbox(oppId) {
  location.hash = '#/pipeline';
  toast('Abriendo pipeline para oportunidad ' + (oppId ? oppId.slice(0,8) : ''));
}

// ── KANBAN PIPELINE ──
async function renderKanban() {
  if (!state.opportunities.length) await loadOpportunities();
  if (!state.accounts.length) await loadAccounts();

  const opps = state.opportunities || [];
  const accountsMap = new Map(state.accounts.map(a => [a.id, a]));

  const board = document.getElementById('kanbanBoard');
  board.innerHTML = ETAPAS.map(et => {
    const cards = opps.filter(o => o.stage === et.key);
    return \`
    <div class="kanban-col flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl" data-stage="\${et.key}"
         ondragover="event.preventDefault();this.classList.add('drag-over')"
         ondragleave="this.classList.remove('drag-over')"
         ondrop="dropCard(event, '\${et.key}')">
      <div class="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <span class="text-sm font-semibold text-\${et.color}">\${et.label}</span>
        <span class="font-mono text-xs text-slate-500">\${cards.length}</span>
      </div>
      <div class="flex-1 p-3 space-y-2 overflow-y-auto min-h-[140px] max-h-[70vh]">
        \${cards.map(c => {
          const acc = accountsMap.get(c.account_id) || {};
          const accountName = acc.name || 'Sin cuenta';
          const oppTitle = c.name || accountName;
          const owner = c.owner_user_id ? c.owner_user_id.slice(0, 4) : 'OP';
          const value = c.estimated_value ? \`$\${c.estimated_value}\` : '$399';
          return \`
          <div class="kanban-card bg-slate-800 border border-slate-700 rounded-lg p-3.5 shadow-sm" draggable="true"
               ondragstart="dragCard(event, '\${c.id}')" data-opp-id="\${c.id}">
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <span class="text-sm font-semibold text-white leading-tight">\${oppTitle}</span>
              <span class="font-mono text-xs text-ark-emerald_hi shrink-0">\${value}</span>
            </div>
            <div class="text-xs text-slate-400 mb-2 truncate">\${accountName}</div>
            <div class="flex items-center justify-between pt-1 border-t border-slate-700/50">
              <span class="text-[10px] font-mono text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">\${owner}</span>
              <button onclick="moverEtapa('\${c.id}')" title="Avanzar etapa" class="text-xs text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded">
                <i data-lucide="chevrons-right" class="w-3.5 h-3.5 text-ark-blue_hi"></i>
              </button>
            </div>
          </div>\`;
        }).join('')}
      </div>
    </div>\`;
  }).join('');

  lucide.createIcons();
}

function dragCard(e, id) {
  e.dataTransfer.setData('text/plain', id);
  e.target.classList.add('dragging');
}

function dropCard(e, stage) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const id = e.dataTransfer.getData('text/plain');
  if (id) moverEtapaAPi(id, stage);
}

const ALLOWED_NEXT = {
  nuevo: 'contactado',
  contactado: 'calificado',
  calificado: 'demo_agendada',
  demo_agendada: 'propuesta_enviada',
  propuesta_enviada: 'negociacion',
  negociacion: 'ganado',
  ganado: 'ganado',
  perdido: 'nuevo'
};

async function moverEtapa(id) {
  const opp = state.opportunities.find(o => o.id === id);
  if (!opp) return;
  const nextStage = ALLOWED_NEXT[opp.stage] || 'contactado';
  await moverEtapaAPi(id, nextStage);
}

async function moverEtapaAPi(id, stage) {
  const opp = state.opportunities.find(o => o.id === id);
  const oldStage = opp ? opp.stage : 'nuevo';
  if (opp) opp.stage = stage;
  renderKanban();

  try {
    const res = await apiCall(\`/api/crm/opportunities/\${id}/stage\`, 'POST', { stage, loss_reason: null });
    if (res && res.error) {
      toast(\`⚠️ \${res.error}\`);
      if (opp) opp.stage = oldStage;
      renderKanban();
      return;
    }
    const label = ETAPAS.find(e => e.key === stage)?.label || stage;
    toast(\`Oportunidad movida a "\${label}"\`);
    loadMetrics();
  } catch(e) {
    console.error('Error al cambiar etapa:', e);
    toast('Error comunicando con el servidor');
  }
}

// ── CUENTAS Y DESPACHOS ──
async function renderCuentas() {
  if (!state.accounts.length) await loadAccounts();
  filtrarCuentas();
}

async function cambiarFiltroTenant(val) {
  await loadAccounts(val);
  filtrarCuentas();
}

const FUTURA_SCIANS = new Set([
  '531210', '531311', '523920',
  '621111', '621112', '621113', '621211', '621399', '621410', '621420', '621490', '621511', '621990', '622111', '622110', '622210', '622310',
  '484111', '484121', '493111', '488511',
  '721111', '721190', '531110', '551110'
]);

function getAccountTenant(a) {
  if (!a) return 'acc_ark_ledger';
  if (a.tenant_id === 'acc_futura_capital') return 'acc_futura_capital';
  const scian = String(a.scian_code || '').trim();
  if (scian.startsWith('62') || FUTURA_SCIANS.has(scian)) {
    return 'acc_futura_capital';
  }
  if (a.tenant_id && a.tenant_id !== 'acc_ark_ledger') return a.tenant_id;
  const id = String(a.id || '').toLowerCase();
  const name = String(a.name || '').toLowerCase();
  const origin = String(a.origin || '').toLowerCase();
  const source = String(a.harvest_source || '').toLowerCase();

  if (
    id.includes('futura') ||
    name.includes('futura capital') ||
    origin.includes('futura') ||
    origin.includes('proptech') ||
    origin.includes('inmobiliaria') ||
    source.includes('hermes') ||
    source.includes('vektor')
  ) {
    return 'acc_futura_capital';
  }
  return 'acc_ark_ledger';
}

function filtrarCuentas() {
  const tamano = document.getElementById('filtroTamano')?.value || '';
  const tenant = document.getElementById('filtroTenant')?.value || '';
  const ciudad = document.getElementById('filtroCiudad')?.value || '';

  let list = state.accounts || [];
  if (tamano) list = list.filter(a => (a.size || a.employee_count_range || '').includes(tamano));
  if (tenant) list = list.filter(a => getAccountTenant(a) === tenant);
  if (ciudad) {
    list = list.filter(a => {
      const plaza = resolverPlaza(a.city || '', a.phone || '', a.email || '');
      return plaza.key === ciudad;
    });
  }

  const totalNum = state.accountsTotal || state.accounts.length;
  document.getElementById('cuentasSub').textContent = \`\${list.length} mostrados (de \${totalNum} registrados en D1)\`;

  const body = document.getElementById('cuentasBody');
  body.innerHTML = list.length === 0
    ? '<tr><td colspan="7" class="p-6 text-center text-slate-500 text-sm">No se encontraron cuentas con los filtros seleccionados</td></tr>'
    : list.map(a => {
        const tid = getAccountTenant(a);
        const isFutura = tid === 'acc_futura_capital';
        const plaza = resolverPlaza(a.city || '', a.phone || '', a.email || '');
        const cityBadge = plaza.key !== 'sin_ciudad'
          ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ' + plaza.badgeClass + ' border whitespace-nowrap" title="' + (a.city || plaza.label) + '">' + plaza.badgeText + '</span>'
          : '<span class="text-slate-600 font-mono text-xs">-</span>';
        const hasPropuesta = Boolean(
          a.has_proposal_sent ||
          (state.opportunities || []).some(o => o.account_id === a.id && o.stage === 'propuesta_enviada')
        );
        const propuestaBadge = hasPropuesta
          ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap ml-2" title="Propuesta enviada"><i data-lucide="mail-check" class="w-3 h-3"></i> ✉️ Propuesta enviada</span>'
          : '';
        return \`
    <tr class="hover:bg-slate-800/30 cursor-pointer transition-colors" onclick="abrirModalCuenta('\${a.id}')">
      <td class="px-4 py-3 font-medium text-white">
        <div class="flex items-center flex-wrap gap-1">
          <span>\${a.name || '-'}</span>
          \${propuestaBadge}
        </div>
      </td>
      <td class="px-4 py-3 font-mono text-xs text-slate-400">\${a.scian_code || '-'}</td>
      <td class="px-4 py-3"><span class="badge badge-ambar">\${a.size || a.employee_count_range || '1-5'}</span></td>
      <td class="px-4 py-3 font-mono text-xs text-slate-400">\${a.harvest_source || a.origin || 'denue'}</td>
      <td class="px-4 py-3"><span class="badge \${isFutura ? 'badge-indigo' : 'badge-azul'}">\${isFutura ? 'Futura Capital' : 'Ark Ledger'}</span></td>
      <td class="px-4 py-3 text-xs">\${cityBadge}</td>
      <td class="px-4 py-3 text-right" onclick="event.stopPropagation()">
        <div class="flex items-center justify-end gap-1">
          <button onclick="enriquecerCuentaRow(event, '\${a.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors" title="Enriquecer Titular / Despacho">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
          </button>
          <button onclick="eliminarCuentaRow(event, '\${a.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Eliminar cuenta">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
          <button onclick="abrirModalCuenta('\${a.id}')" class="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors" title="Ver detalle">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    </tr>\`;
      }).join('');

  lucide.createIcons();
}

async function abrirModalCuenta(id) {
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;

  const content = document.getElementById('modalCuentaContent');
  content.innerHTML = '<div class="text-sm text-slate-400 p-4">Cargando detalles de cuenta…</div>';
  document.getElementById('modalCuenta').classList.remove('hidden');

  try {
    const detail = await apiCall(\`/api/crm/accounts/\${id}\`);
    const account = detail?.account || acc;
    const contactos = detail?.contacts || [];
    const opps = detail?.opportunities || [];
    const activities = detail?.activities || [];
    const notes = activities.filter(activity => activity.type === 'note');

    content.innerHTML = \`
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 class="text-lg font-bold text-white">\${account.name}</h2>
          <span class="text-xs font-mono text-slate-500">\${account.id}</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="autoEnriquecerModalCuenta('\${account.id}')" id="btnAutoEnriquecerCuenta" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-semibold transition-colors" title="Buscar titular y datos en la web abierta">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Enriquecer Titular
          </button>
          <button onclick="confirmarEliminarCuenta('\${account.id}', '\${(account.name||'').replace(/'/g, '\\\\\\'')}')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors" title="Eliminar cuenta">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Eliminar
          </button>
          <button onclick="cerrarModalCuenta()" class="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
      </div>

      <div class="space-y-5">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div class="text-xs text-slate-500 mb-1">SCIAN</div>
            <div class="font-mono text-sm text-white">\${account.scian_code || '541211 (Contabilidad/Auditoría)'}</div>
          </div>
          <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div class="text-xs text-slate-500 mb-1">Fuente</div>
            <div class="font-mono text-sm text-white">\${account.harvest_source || account.origin || 'DENUE INEGI'}</div>
          </div>
          <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div class="text-xs text-slate-500 mb-1">Tenant Asignado</div>
            <div class="font-mono text-sm text-ark-blue_hi">\${getAccountTenant(account) === 'acc_futura_capital' ? 'Futura Capital Partners' : 'Ark Ledger (Despachos)'}</div>
          </div>
          <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <div class="text-xs text-slate-500 mb-1">Ubicación</div>
            <div class="text-sm text-white">\${account.city || 'Mérida'}\${account.state ? ', ' + account.state : ''}</div>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-white text-sm">Contactos (\${contactos.length})</h3>
            <button onclick="abrirModalNuevoContacto('\${account.id}')" class="text-xs text-ark-emerald_hi hover:underline">+ Agregar</button>
          </div>
          \${contactos.length ? contactos.map(c => \`
            <div class="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 border border-slate-700/50 mb-2">
              <div>
                <div class="text-sm text-white font-medium">\${c.name || 'Sin nombre'}</div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono text-xs text-slate-400">\${c.phone || 'Sin tel'}</span>
                  \${c.whatsapp ? \`<span class="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded"><i data-lucide="message-circle" class="w-3 h-3"></i> \${c.whatsapp}</span>\` : ''}
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-400 font-mono">\${c.email || 'Sin email'}</span>
                \${c.whatsapp ? \`<button onclick="accionWhatsApp('\${c.whatsapp}')" class="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="WhatsApp"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i></button>\` : ''}
                <button onclick="abrirModalEditarContacto('\${c.id}', '\${account.id}')" class="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700/50 transition-colors" title="Editar contacto">
                  <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="eliminarContactoModal(event, '\${c.id}', '\${account.id}')" class="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Eliminar contacto">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>\`).join('') : '<p class="text-xs text-slate-500 bg-slate-800/20 p-3 rounded-lg">Sin contactos directos todavía</p>'}
        </div>

        <div>
          <h3 class="font-semibold text-white text-sm mb-2">Oportunidades Activas (\${opps.length})</h3>
          \${opps.length ? opps.map(o => \`
            <div class="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 border border-slate-700/50 mb-2">
              <div>
                <div class="text-xs font-semibold text-white">\${o.name || ('Oportunidad ' + o.id.slice(0,8))}</div>
                <div class="text-[11px] text-slate-400">Etapa: <span class="text-ark-blue_hi uppercase font-mono">\${o.stage}</span></div>
              </div>
              <span class="text-xs font-mono text-ark-emerald_hi">$\${o.estimated_value || 399} MXN</span>
            </div>\`).join('') : '<p class="text-xs text-slate-500 bg-slate-800/20 p-3 rounded-lg">Sin oportunidades abiertas</p>'}
        </div>

        <section class="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="font-semibold text-white text-sm">Notas del cliente</h3>
                <p class="text-[11px] text-slate-500 mt-0.5">Notas internas disponibles aunque no haya una oportunidad activa.</p>
              </div>
              <span class="text-[11px] font-mono text-slate-500">\${notes.length}</span>
            </div>
            \${state.user && state.user.role !== 'lector' ? \`
              <form onsubmit="guardarNotaCuenta(event, '\${escapeHtml(account.id)}')" class="space-y-2 mb-4">
                <label for="notaCuentaTexto" class="sr-only">Nueva nota</label>
                <textarea id="notaCuentaTexto" maxlength="10000" rows="3" required placeholder="Escribe una nota sobre este cliente…" class="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-ark-blue_hi focus:outline-none"></textarea>
                <div class="grid sm:grid-cols-2 gap-2">
                  <label class="sr-only" for="notaCuentaContacto">Contacto relacionado</label>
                  <select id="notaCuentaContacto" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                    <option value="">Nota general de la cuenta</option>
                    \${contactos.map(contact => \`<option value="\${escapeHtml(contact.id)}">\${escapeHtml(contact.name || contact.email || 'Contacto')}</option>\`).join('')}
                  </select>
                  <label class="sr-only" for="notaCuentaOportunidad">Oportunidad relacionada</label>
                  <select id="notaCuentaOportunidad" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                    <option value="">Sin oportunidad asociada</option>
                    \${opps.map(opportunity => \`<option value="\${escapeHtml(opportunity.id)}">\${escapeHtml(opportunity.name || ('Oportunidad ' + opportunity.id.slice(0, 8)))} · \${escapeHtml(opportunity.stage)}</option>\`).join('')}
                  </select>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[11px] text-slate-500">Máximo 10,000 caracteres</span>
                  <button type="submit" class="inline-flex items-center gap-1.5 rounded-lg bg-ark-blue px-3 py-2 text-xs font-semibold text-white hover:bg-ark-blue/80">
                    <i data-lucide="plus" class="w-3.5 h-3.5"></i> Guardar nota
                  </button>
                </div>
              </form>
            \` : ''}
            <div class="space-y-2" id="notasCuentaLista">
              \${notes.length ? notes.map(note => \`
                <article class="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <p class="text-sm text-slate-200 whitespace-pre-wrap break-words">\${escapeHtml(note.content)}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
                    <span>\${escapeHtml(note.author_name || 'Usuario del CRM')}</span>
                    <span aria-hidden="true">·</span>
                    <time datetime="\${escapeHtml(note.created_at)}">\${escapeHtml(formatearFechaNota(note.created_at))}</time>
                    \${note.contact_id ? '<span class="text-slate-600">· contacto relacionado</span>' : ''}
                    \${note.opportunity_id ? '<span class="text-slate-600">· oportunidad relacionada</span>' : ''}
                  </div>
                  \${state.user && state.user.role !== 'lector' ? \`
                    <button type="button" data-note-id="\${escapeHtml(note.id)}" onclick="mostrarFormularioSeguimiento(this)" class="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-ark-blue/30 bg-ark-blue/10 px-2.5 py-1.5 text-[11px] font-semibold text-ark-blue_hi hover:bg-ark-blue/20">
                      <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> Crear seguimiento
                    </button>
                    <form id="seguimientoNota-\${escapeHtml(note.id)}" data-note-id="\${escapeHtml(note.id)}" data-account-id="\${escapeHtml(account.id)}" data-contact-id="\${escapeHtml(note.contact_id || '')}" data-opportunity-id="\${escapeHtml(note.opportunity_id || '')}" data-note-content="\${escapeHtml(note.content)}" onsubmit="crearSeguimientoDesdeNota(event, this)" class="hidden mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <label class="block text-[11px] text-slate-400" for="seguimientoTitulo-\${escapeHtml(note.id)}">Próxima acción</label>
                      <input id="seguimientoTitulo-\${escapeHtml(note.id)}" type="text" maxlength="200" required value="Dar seguimiento a esta nota" class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-ark-blue_hi focus:outline-none">
                      <div class="grid sm:grid-cols-2 gap-2">
                        <div>
                          <label class="block text-[11px] text-slate-400 mb-1" for="seguimientoFecha-\${escapeHtml(note.id)}">Fecha de vencimiento</label>
                          <input id="seguimientoFecha-\${escapeHtml(note.id)}" type="date" min="\${fechaLocalHoy()}" value="\${fechaLocalManana()}" required class="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-ark-blue_hi focus:outline-none">
                        </div>
                        <div>
                          <span class="block text-[11px] text-slate-400 mb-1">Responsable</span>
                          <div class="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">\${escapeHtml(state.user.name || state.user.email || 'Usuario actual')}</div>
                        </div>
                      </div>
                      <div class="flex justify-end gap-2 pt-1">
                        <button type="button" onclick="this.closest('form').classList.add('hidden')" class="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800">Cancelar</button>
                        <button type="submit" class="rounded-lg bg-ark-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-ark-blue/80">Guardar tarea</button>
                      </div>
                    </form>
                  \` : ''}
                </article>
              \`).join('') : '<p class="rounded-lg bg-slate-800/20 p-3 text-xs text-slate-500">Todavía no hay notas para esta cuenta.</p>'}
            </div>
        </section>

        <h3 class="font-semibold text-white text-sm">Observaciones del Profiler Agéntico</h3>
        <div class="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 space-y-2">
          <div class="flex items-center gap-2">
            <span class="badge badge-rojo">DOLOR_SAT</span>
            <span class="text-xs text-slate-400">Firma contable con carga en declaración y cálculo fiscal</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge badge-ambar">STACK CONTABLE</span>
            <span class="text-xs text-slate-400">Objetivo para integración con CONTPAQi / Aspel</span>
          </div>
        </div>
      </div>\`;
    lucide.createIcons();
  } catch(e) {
    content.innerHTML = '<div class="text-rose-400 text-sm p-4">Error cargando detalles</div>';
  }
}

function formatearFechaNota(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function fechaLocalHoy() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function fechaLocalManana() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function mostrarFormularioSeguimiento(button) {
  const noteId = button.dataset.noteId;
  const form = document.getElementById('seguimientoNota-' + noteId);
  if (!form) {
    toast('No se encontró el formulario de seguimiento.');
    return;
  }
  form.classList.toggle('hidden');
  if (!form.classList.contains('hidden')) {
    form.querySelector('input[type="text"]').focus();
  }
}

async function crearSeguimientoDesdeNota(event, form) {
  event.preventDefault();
  const titleInput = form.querySelector('input[type="text"]');
  const dueDate = form.querySelector('input[type="date"]').value;
  const title = titleInput.value.trim();
  const button = form.querySelector('button[type="submit"]');
  if (!title || !dueDate) {
    toast('Indica la próxima acción y su fecha de vencimiento.');
    return;
  }

  button.disabled = true;
  try {
    const result = await apiCall('/api/crm/tasks', 'POST', {
      title,
      description: 'Seguimiento creado desde una nota del cliente: ' + (form.dataset.noteContent || ''),
      account_id: form.dataset.accountId,
      contact_id: form.dataset.contactId || null,
      opportunity_id: form.dataset.opportunityId || null,
      owner_user_id: state.user.id,
      due_date: dueDate
    });
    if (!result || result.error || !result.task) {
      toast('No se pudo crear el seguimiento: ' + ((result && result.error) || 'respuesta inválida del servidor'));
      return;
    }
    form.classList.add('hidden');
    await loadTasks();
    renderTareas();
    toast('Seguimiento asignado a ' + (state.user.name || state.user.email) + ' para ' + dueDate + '.');
  } catch (error) {
    toast('Error al crear el seguimiento: ' + (error.message || 'Error de red'));
  } finally {
    button.disabled = false;
  }
}

async function guardarNotaCuenta(event, accountId) {
  event.preventDefault();
  const form = event.currentTarget;
  const textarea = form.querySelector('textarea');
  const button = form.querySelector('button[type="submit"]');
  const text = textarea.value.trim();
  if (!text) {
    toast('Escribe una nota antes de guardarla.');
    textarea.focus();
    return;
  }

  button.disabled = true;
  try {
    const contactId = form.querySelector('#notaCuentaContacto').value;
    const opportunityId = form.querySelector('#notaCuentaOportunidad').value;
    const result = await apiCall('/api/crm/activities', 'POST', {
      type: 'note',
      account_id: accountId,
      contact_id: contactId || null,
      opportunity_id: opportunityId || null,
      content: text
    });
    if (!result || result.error || !result.activity) {
      toast('No se pudo guardar la nota: ' + ((result && result.error) || 'respuesta inválida del servidor'));
      return;
    }
    toast('Nota guardada.');
    await abrirModalCuenta(accountId);
  } catch (error) {
    toast('Error al guardar la nota: ' + (error.message || 'Error de red'));
  } finally {
    button.disabled = false;
  }
}

function cerrarModalCuenta() {
  document.getElementById('modalCuenta').classList.add('hidden');
}

// ── NORMALIZADOR DINÁMICO DE PLAZAS Y CIUDADES ──
function resolverPlaza(rawCity = '', phone = '', email = '') {
  const cityLower = (rawCity || '').toLowerCase().trim();
  const phoneLower = (phone || '').toLowerCase();
  const emailLower = (email || '').toLowerCase();

  // 1. Cancún / Q. Roo
  if (
    cityLower.includes('cancún') || cityLower.includes('cancun') || 
    cityLower.includes('benito juárez') || cityLower.includes('benito juarez') ||
    cityLower.includes('isla mujeres') ||
    (cityLower.includes('quintana') && !cityLower.includes('tulum') && !cityLower.includes('playa') && !cityLower.includes('cozumel') && !cityLower.includes('solidaridad')) ||
    phoneLower.includes('998') || emailLower.includes('cancun') || emailLower.includes('caribe')
  ) {
    return {
      key: 'cancun',
      label: '🌴 Cancún / Q. Roo',
      badgeText: '🌴 Cancún, Q.R.',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
    };
  }

  // 2. Riviera Maya / Tulum / Playa del Carmen / Cozumel
  if (
    cityLower.includes('playa') || cityLower.includes('solidaridad') || 
    cityLower.includes('tulum') || cityLower.includes('cozumel') || 
    phoneLower.includes('984') || phoneLower.includes('987')
  ) {
    return {
      key: 'playa',
      label: '🌊 Riviera Maya / Tulum',
      badgeText: '🌊 Riviera Maya',
      badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/25'
    };
  }

  // 3. Mérida / Yucatán
  if (
    cityLower.includes('mérida') || cityLower.includes('merida') || 
    cityLower.includes('progreso') || cityLower.includes('valladolid') || 
    cityLower.includes('yucatán') || cityLower.includes('yucatan') || 
    (phoneLower.includes('999') && !phoneLower.includes('998'))
  ) {
    return {
      key: 'merida',
      label: '🏛️ Mérida / Yucatán',
      badgeText: '🏛️ Mérida, Yuc.',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
    };
  }

  // 4. Campeche & Ciudad del Carmen
  if (
    cityLower.includes('campeche') || cityLower.includes('carmen') || 
    phoneLower.includes('981') || phoneLower.includes('938')
  ) {
    return {
      key: 'campeche',
      label: '🏰 Campeche & Cd. Carmen',
      badgeText: '🏰 Campeche',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
    };
  }

  // 5. CDMX / Metropolitana
  if (
    cityLower.includes('cdmx') || cityLower.includes('ciudad de méxico') || 
    cityLower.includes('ciudad de mexico') || cityLower.includes('distrito federal') ||
    cityLower.includes('polanco') || cityLower.includes('reforma') || cityLower.includes('insurgentes') ||
    phoneLower.includes('55 ') || phoneLower.includes('+5255')
  ) {
    return {
      key: 'cdmx',
      label: '🏙️ CDMX / Metropolitana',
      badgeText: '🏙️ CDMX',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/25'
    };
  }

  // 6. Monterrey / San Pedro / N.L.
  if (
    cityLower.includes('monterrey') || cityLower.includes('san pedro') || 
    cityLower.includes('nuevo león') || cityLower.includes('nuevo leon') ||
    phoneLower.includes('81 ') || phoneLower.includes('+5281')
  ) {
    return {
      key: 'monterrey',
      label: '⛰️ Monterrey / N.L.',
      badgeText: '⛰️ Monterrey',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/25'
    };
  }

  // 7. Guadalajara / Zapopan / Jalisco
  if (
    cityLower.includes('guadalajara') || cityLower.includes('zapopan') || 
    cityLower.includes('jalisco') || phoneLower.includes('33 ') || phoneLower.includes('+5233')
  ) {
    return {
      key: 'guadalajara',
      label: '☀️ Guadalajara / Zapopan',
      badgeText: '☀️ Guadalajara',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/25'
    };
  }

  // 8. Auto-descubrimiento dinámico para cualquier otra ciudad registrada en D1
  if (rawCity) {
    const slug = cityLower.replace(/[^a-z0-9]/g, '_').slice(0, 24);
    const displayLabel = rawCity.split(',')[0].trim();
    return {
      key: 'auto_' + slug,
      label: '📍 ' + displayLabel,
      badgeText: '📍 ' + displayLabel,
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-700'
    };
  }

  return {
    key: 'sin_ciudad',
    label: 'Sin ciudad especificada',
    badgeText: '-',
    badgeClass: 'text-slate-600'
  };
}

function resolverPlazaContacto(c) {
  const acc = state.accounts.find(a => a.id === c.account_id);
  const rawCity = c.account_city || acc?.city || '';
  const phone = c.phone || c.whatsapp || '';
  const email = c.email || '';
  return resolverPlaza(rawCity, phone, email);
}

function actualizarOpcionesFiltroCiudades() {
  const selectContactos = document.getElementById('filtroContactosCiudad');
  const selectCuentas = document.getElementById('filtroCiudad');

  // Actualizar selector de Contactos
  if (selectContactos) {
    const currentVal = filtroContactosCiudad;
    const plazasCount = {};
    (state.contacts || []).forEach(c => {
      const plaza = resolverPlazaContacto(c);
      if (plaza.key !== 'sin_ciudad') {
        if (!plazasCount[plaza.key]) {
          plazasCount[plaza.key] = { label: plaza.label, count: 0 };
        }
        plazasCount[plaza.key].count++;
      }
    });

    const totalContactos = (state.contacts || []).length;
    let html = '<option value="">📍 Ciudad (Todas - ' + totalContactos + ')</option>';
    const sortedKeys = Object.keys(plazasCount).sort((a, b) => plazasCount[b].count - plazasCount[a].count);
    for (const k of sortedKeys) {
      const p = plazasCount[k];
      html += '<option value="' + k + '">' + p.label + ' (' + p.count + ')</option>';
    }
    selectContactos.innerHTML = html;
    if (currentVal && plazasCount[currentVal]) {
      selectContactos.value = currentVal;
    } else {
      selectContactos.value = '';
      filtroContactosCiudad = '';
    }
  }

  // Actualizar selector de Cuentas
  if (selectCuentas) {
    const currentVal = selectCuentas.value || '';
    const cuentasCount = {};
    (state.accounts || []).forEach(a => {
      const plaza = resolverPlaza(a.city || '', a.phone || '', a.email || '');
      if (plaza.key !== 'sin_ciudad') {
        if (!cuentasCount[plaza.key]) {
          cuentasCount[plaza.key] = { label: plaza.label, count: 0 };
        }
        cuentasCount[plaza.key].count++;
      }
    });

    const totalCuentas = (state.accounts || []).length;
    let html = '<option value="">Ciudad (Todas - ' + totalCuentas + ')</option>';
    const sortedKeys = Object.keys(cuentasCount).sort((a, b) => cuentasCount[b].count - cuentasCount[a].count);
    for (const k of sortedKeys) {
      const p = cuentasCount[k];
      html += '<option value="' + k + '">' + p.label + ' (' + p.count + ')</option>';
    }
    selectCuentas.innerHTML = html;
    if (currentVal && cuentasCount[currentVal]) {
      selectCuentas.value = currentVal;
    } else {
      selectCuentas.value = '';
    }
  }
}

// ── CONTACTOS ──
let sortContactos = { campo: 'name', dir: 'asc' };
let filtroContactosTexto = '';
let filtroContactosTab = 'todos';
let filtroContactosCiudad = '';
let filtroContactosTenant = '';

async function cambiarFiltroTenantContactos(e) {
  filtroContactosTenant = (e.target?.value || '').trim();
  await loadContacts(filtroContactosTenant);
  paginaContactos = 1;
  renderContactos();
}

function cambiarFiltroCiudadContactos(e) {
  filtroContactosCiudad = (e.target.value || '').trim();
  paginaContactos = 1;
  renderContactos();
}

let paginaContactos = 1;
const CONTACTOS_POR_PAGINA = 50;
let totalPaginasContactos = 1;

function cambiarPaginaContactos(delta) {
  irAPaginaContactos(paginaContactos + delta);
}

function irPrimeraPaginaContactos() {
  irAPaginaContactos(1);
}

function irUltimaPaginaContactos() {
  irAPaginaContactos(totalPaginasContactos);
}

function irAPaginaContactos(pag) {
  if (pag < 1) pag = 1;
  if (pag > totalPaginasContactos) pag = totalPaginasContactos;
  if (pag !== paginaContactos) {
    paginaContactos = pag;
    renderContactos();
    const scrollEl = document.getElementById('contactosTableScrollContainer');
    if (scrollEl) scrollEl.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }
}

function buscarContactosEnTabla(e) {
  filtroContactosTexto = (e.target.value || '').trim().toLowerCase();
  paginaContactos = 1;
  renderContactos();
}

function cambiarTabContactos(tab) {
  filtroContactosTab = tab;
  paginaContactos = 1;
  document.querySelectorAll('.ct-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-ct-tab') === tab) {
      btn.className = 'ct-tab-btn active text-xs font-semibold px-3 py-1.5 rounded-full bg-ark-blue/15 text-ark-blue_hi border border-ark-blue/30';
    } else {
      btn.className = 'ct-tab-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 hover:text-white';
    }
  });
  renderContactos();
}

function alternarOrdenContactos(campo) {
  if (sortContactos.campo === campo) {
    sortContactos.dir = sortContactos.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortContactos.campo = campo;
    sortContactos.dir = 'asc';
  }
  paginaContactos = 1;
  renderContactos();
}

function scrollTablaContactos(offset) {
  const el = document.getElementById('contactosTableScrollContainer');
  if (el) el.scrollBy({ left: offset, behavior: 'smooth' });
}

// ── SELECCIÓN MASIVA ESTILO GMAIL ──
const selectedContactIds = new Set();

function actualizarBulkToolbar() {
  const toolbar = document.getElementById('bulkContactosToolbar');
  const countEl = document.getElementById('bulkContactosCount');
  const masterBox = document.getElementById('selectAllContactosCheckbox');
  const totalVisibleEl = document.getElementById('bulkTotalVisibleCount');
  
  const allRowBoxes = document.querySelectorAll('.ct-row-checkbox');
  const totalVisible = allRowBoxes.length;
  if (totalVisibleEl) totalVisibleEl.textContent = totalVisible;

  const count = selectedContactIds.size;
  if (countEl) countEl.textContent = count;

  if (count > 0) {
    if (toolbar) {
      toolbar.classList.remove('hidden');
      toolbar.classList.add('flex');
    }
  } else {
    if (toolbar) {
      toolbar.classList.add('hidden');
      toolbar.classList.remove('flex');
    }
  }

  if (masterBox) {
    if (count === 0) {
      masterBox.checked = false;
      masterBox.indeterminate = false;
    } else if (count >= totalVisible && totalVisible > 0) {
      masterBox.checked = true;
      masterBox.indeterminate = false;
    } else {
      masterBox.checked = false;
      masterBox.indeterminate = true;
    }
  }
}

function onSelectContactoChange(e, id) {
  if (e.target.checked) {
    selectedContactIds.add(id);
  } else {
    selectedContactIds.delete(id);
  }
  actualizarBulkToolbar();
}

function toggleSelectAllContactos(e) {
  const check = e.target.checked;
  const allRowBoxes = document.querySelectorAll('.ct-row-checkbox');
  allRowBoxes.forEach(box => {
    box.checked = check;
    const id = box.dataset.contactId;
    if (check && id) {
      selectedContactIds.add(id);
    } else if (id) {
      selectedContactIds.delete(id);
    }
  });
  actualizarBulkToolbar();
}

function seleccionarTodosContactosVisibles() {
  const allRowBoxes = document.querySelectorAll('.ct-row-checkbox');
  allRowBoxes.forEach(box => {
    box.checked = true;
    const id = box.dataset.contactId;
    if (id) selectedContactIds.add(id);
  });
  actualizarBulkToolbar();
}

function deseleccionarTodosContactos() {
  selectedContactIds.clear();
  const allRowBoxes = document.querySelectorAll('.ct-row-checkbox');
  allRowBoxes.forEach(box => { box.checked = false; });
  actualizarBulkToolbar();
}

async function ejecutarBulkDeleteContactos() {
  const ids = Array.from(selectedContactIds);
  if (!ids.length) return;
  abrirConfirmacion(
    '¿Eliminar ' + ids.length + ' contactos seleccionados?',
    'Esta acción eliminará ' + ids.length + ' contactos seleccionados de forma permanente.',
    async () => {
      try {
        toast('⏳ Eliminando ' + ids.length + ' contactos...');
        const res = await apiCall('/api/crm/contacts/bulk-delete', 'POST', { ids });
        if (res && res.success) {
          state.contacts = state.contacts.filter(c => !selectedContactIds.has(c.id));
          selectedContactIds.clear();
          actualizarBulkToolbar();
          actualizarOpcionesFiltroCiudades();
          renderContactos();
          toast('✅ ' + ids.length + ' contactos eliminados con éxito.');
        } else {
          toast('Error al eliminar contactos: ' + (res?.error || 'Error'));
        }
      } catch(err) {
        toast('Error al eliminar: ' + (err.message || 'Error de red'));
      }
    }
  );
}

async function renderContactos() {
  if (!state.contacts.length) await loadContacts();
  const body = document.getElementById('contactosBody');
  const contacts = state.contacts || [];

  const selContactos = document.getElementById('filtroContactosCiudad');
  if (selContactos && selContactos.options.length <= 1 && contacts.length > 0) {
    actualizarOpcionesFiltroCiudades();
  }

  // Actualizar indicadores visuales de ordenamiento
  const lblBtn = document.getElementById('lblOrdenContactos');
  if (lblBtn) {
    lblBtn.textContent = sortContactos.campo === 'name'
      ? (sortContactos.dir === 'asc' ? 'A-Z' : 'Z-A')
      : (sortContactos.dir === 'asc' ? '▲ ' + sortContactos.campo : '▼ ' + sortContactos.campo);
  }
  const icoName = document.getElementById('sortIconName');
  if (icoName) {
    icoName.textContent = sortContactos.campo === 'name' ? (sortContactos.dir === 'asc' ? '▲' : '▼') : '⇅';
    icoName.className = sortContactos.campo === 'name' ? 'text-ark-blue_hi font-bold' : 'text-slate-600';
  }
  const icoAcc = document.getElementById('sortIconAccount');
  if (icoAcc) {
    icoAcc.textContent = sortContactos.campo === 'account_name' ? (sortContactos.dir === 'asc' ? '▲' : '▼') : '⇅';
    icoAcc.className = sortContactos.campo === 'account_name' ? 'text-ark-blue_hi font-bold' : 'text-slate-600';
  }
  const icoWa = document.getElementById('sortIconWhatsapp');
  if (icoWa) {
    icoWa.textContent = sortContactos.campo === 'whatsapp' ? (sortContactos.dir === 'asc' ? '▲' : '▼') : '⇅';
    icoWa.className = sortContactos.campo === 'whatsapp' ? 'text-ark-blue_hi font-bold' : 'text-slate-600';
  }
  const icoTitle = document.getElementById('sortIconTitle');
  if (icoTitle) {
    icoTitle.textContent = sortContactos.campo === 'title' ? (sortContactos.dir === 'asc' ? '▲' : '▼') : '⇅';
    icoTitle.className = sortContactos.campo === 'title' ? 'text-ark-blue_hi font-bold' : 'text-slate-600';
  }
  const icoCity = document.getElementById('sortIconCity');
  if (icoCity) {
    icoCity.textContent = sortContactos.campo === 'city' ? (sortContactos.dir === 'asc' ? '▲' : '▼') : '⇅';
    icoCity.className = sortContactos.campo === 'city' ? 'text-ark-blue_hi font-bold' : 'text-slate-600';
  }

  // Filtrado
  let list = contacts.slice();

  if (filtroContactosTab === 'con_whatsapp') {
    list = list.filter(c => c.whatsapp && c.whatsapp !== '-' && c.whatsapp.trim() !== '');
  } else if (filtroContactosTab === 'pendientes') {
    list = list.filter(c => {
      const isPlaceholder = !c.name || c.name === 'Sin nombre' || c.name.toLowerCase().includes('contacto corporativo');
      const missingWa = !c.whatsapp || c.whatsapp === '-';
      const missingPhone = !c.phone || c.phone === '-';
      return isPlaceholder || missingWa || missingPhone;
    });
  }

  if (filtroContactosCiudad) {
    list = list.filter(c => {
      const plaza = resolverPlazaContacto(c);
      return plaza.key === filtroContactosCiudad;
    });
  }

  if (filtroContactosTenant) {
    list = list.filter(c => {
      const acc = (state.accounts || []).find(a => a.id === c.account_id);
      const tid = c.tenant_id || (acc ? getAccountTenant(acc) : '');
      return tid === filtroContactosTenant;
    });
  }

  if (filtroContactosTexto) {
    const q = filtroContactosTexto.toLowerCase();
    list = list.filter(c => {
      const acc = state.accounts.find(a => a.id === c.account_id);
      const accName = (c.account_name || acc?.name || '').toLowerCase();
      const city = (c.account_city || acc?.city || '').toLowerCase();
      const name = (c.name || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const wa = (c.whatsapp || '').toLowerCase();
      const title = (c.title || '').toLowerCase();
      return name.includes(q) || accName.includes(q) || city.includes(q) || email.includes(q) || phone.includes(q) || wa.includes(q) || title.includes(q);
    });
  }

  // Ordenamiento
  list.sort((a, b) => {
    if (sortContactos.campo === 'name') {
      const aIsPlace = !a.name || a.name === 'Sin nombre' || a.name.toLowerCase().includes('contacto corporativo');
      const bIsPlace = !b.name || b.name === 'Sin nombre' || b.name.toLowerCase().includes('contacto corporativo');
      if (aIsPlace && !bIsPlace) return 1;
      if (!aIsPlace && bIsPlace) return -1;
      const cmp = (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
      return sortContactos.dir === 'asc' ? cmp : -cmp;
    }
    if (sortContactos.campo === 'account_name') {
      const aAcc = a.account_name || (state.accounts.find(acc => acc.id === a.account_id)?.name) || '';
      const bAcc = b.account_name || (state.accounts.find(acc => acc.id === b.account_id)?.name) || '';
      const cmp = aAcc.localeCompare(bAcc, 'es', { sensitivity: 'base' });
      return sortContactos.dir === 'asc' ? cmp : -cmp;
    }
    if (sortContactos.campo === 'city') {
      const aCity = a.account_city || (state.accounts.find(acc => acc.id === a.account_id)?.city) || '';
      const bCity = b.account_city || (state.accounts.find(acc => acc.id === b.account_id)?.city) || '';
      const cmp = aCity.localeCompare(bCity, 'es', { sensitivity: 'base' });
      return sortContactos.dir === 'asc' ? cmp : -cmp;
    }
    if (sortContactos.campo === 'whatsapp') {
      const aHasWa = !!(a.whatsapp && a.whatsapp !== '-');
      const bHasWa = !!(b.whatsapp && b.whatsapp !== '-');
      if (aHasWa && !bHasWa) return -1;
      if (!aHasWa && bHasWa) return 1;
      const cmp = (a.whatsapp || '').localeCompare(b.whatsapp || '');
      return sortContactos.dir === 'asc' ? cmp : -cmp;
    }
    if (sortContactos.campo === 'title') {
      const aHasTitle = !!(a.title && a.title !== '-');
      const bHasTitle = !!(b.title && b.title !== '-');
      if (aHasTitle && !bHasTitle) return -1;
      if (!aHasTitle && bHasTitle) return 1;
      const cmp = (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
      return sortContactos.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });

  const totalItems = list.length;
  totalPaginasContactos = Math.max(1, Math.ceil(totalItems / CONTACTOS_POR_PAGINA));
  if (paginaContactos > totalPaginasContactos) paginaContactos = totalPaginasContactos;
  if (paginaContactos < 1) paginaContactos = 1;

  const startIndex = totalItems === 0 ? 0 : (paginaContactos - 1) * CONTACTOS_POR_PAGINA;
  const endIndex = Math.min(startIndex + CONTACTOS_POR_PAGINA, totalItems);
  const itemsPagina = list.slice(startIndex, endIndex);

  const sub = document.getElementById('contactosSub');
  if (sub) {
    const totalRegistrados = state.contactsTotal || contacts.length;
    sub.textContent = totalItems === 0
      ? '0 contactos'
      : (filtroContactosTexto || filtroContactosTab !== 'todos' || filtroContactosTenant)
        ? (totalItems + ' mostrados de ' + totalRegistrados + ' en D1 (Pág. ' + paginaContactos + ' de ' + totalPaginasContactos + ')')
        : (totalRegistrados + ' contactos registrados en D1 (Pág. ' + paginaContactos + ' de ' + totalPaginasContactos + ')');
  }

  // Actualizar indicadores numéricos de paginación
  const pStart = document.getElementById('pagStart');
  const pEnd = document.getElementById('pagEnd');
  const pTotal = document.getElementById('pagTotal');
  const pActual = document.getElementById('pagActual');
  const pTotalPags = document.getElementById('pagTotalPags');
  const btnPrev = document.getElementById('btnPagAnterior');
  const btnNext = document.getElementById('btnPagSiguiente');
  const btnFirst = document.getElementById('btnPagPrimera');
  const btnLast = document.getElementById('btnPagUltima');

  if (pStart) pStart.textContent = totalItems === 0 ? 0 : (startIndex + 1);
  if (pEnd) pEnd.textContent = endIndex;
  if (pTotal) pTotal.textContent = totalItems;
  if (pActual) pActual.textContent = paginaContactos;
  if (pTotalPags) pTotalPags.textContent = totalPaginasContactos;

  if (btnFirst) btnFirst.disabled = paginaContactos <= 1;
  if (btnPrev) btnPrev.disabled = paginaContactos <= 1;
  if (btnNext) btnNext.disabled = paginaContactos >= totalPaginasContactos;
  if (btnLast) btnLast.disabled = paginaContactos >= totalPaginasContactos;

  // Botones rápidos de páginas
  const numContainer = document.getElementById('pagNumerosContainer');
  if (numContainer) {
    let pills = '';
    const maxVisiblePills = 5;
    let startPill = Math.max(1, paginaContactos - 2);
    let endPill = Math.min(totalPaginasContactos, startPill + maxVisiblePills - 1);
    if (endPill - startPill < maxVisiblePills - 1) {
      startPill = Math.max(1, endPill - maxVisiblePills + 1);
    }
    for (let p = startPill; p <= endPill; p++) {
      const activeClass = p === paginaContactos
        ? 'bg-ark-blue/25 text-ark-blue_hi border-ark-blue/50 font-bold'
        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border-transparent';
      pills += '<button type="button" onclick="irAPaginaContactos(' + p + ')" class="w-7 h-7 flex items-center justify-center rounded-lg border text-xs font-mono transition-colors ' + activeClass + '">' + p + '</button>';
    }
    numContainer.innerHTML = pills;
  }

  body.innerHTML = itemsPagina.length === 0
    ? '<tr><td colspan="9" class="p-6 text-center text-slate-500 text-sm">No se encontraron contactos que coincidan con la búsqueda o filtro.</td></tr>'
    : itemsPagina.map(c => {
        const acc = state.accounts.find(a => a.id === c.account_id);
        const cuentaNombre = c.account_name || (acc ? acc.name : (c.account_id ? 'Cuenta ' + c.account_id.slice(0,8) : '-'));
        const plaza = resolverPlazaContacto(c);
        let cityBadge = '<span class="text-slate-600 font-mono text-xs">-</span>';
        if (plaza.key !== 'sin_ciudad') {
          cityBadge = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ' + plaza.badgeClass + ' border whitespace-nowrap max-w-[140px] truncate" title="' + (c.account_city || (acc ? acc.city : '') || plaza.label) + '">' + plaza.badgeText + '</span>';
        }
        const hasPropuesta = Boolean(
          c.has_proposal_sent ||
          (state.opportunities || []).some(o => (o.contact_id === c.id || (o.account_id && o.account_id === c.account_id)) && o.stage === 'propuesta_enviada')
        );
        const propuestaBadge = hasPropuesta
          ? '<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap ml-1.5" title="Propuesta enviada"><i data-lucide="mail-check" class="w-2.5 h-2.5"></i> ✉️ Propuesta enviada</span>'
          : '';
        return \`
        <tr class="hover:bg-slate-800/30 transition-colors">
          <td class="px-3 py-3 text-center sticky left-0 bg-slate-900/90 backdrop-blur-sm z-10 border-r border-slate-800/80">
            <input type="checkbox" data-contact-id="\${c.id}" \${selectedContactIds.has(c.id) ? 'checked' : ''} onchange="onSelectContactoChange(event, '\${c.id}')" class="ct-row-checkbox rounded border-slate-700 bg-slate-800 text-ark-blue focus:ring-0 cursor-pointer">
          </td>
          <td class="px-4 py-3 font-medium text-white">
            <div class="flex items-center flex-wrap gap-1">
              <span>\${c.name || 'Sin nombre'}</span>
              \${propuestaBadge}
            </div>
          </td>
          <td class="px-4 py-3 text-slate-400">\${cuentaNombre}</td>
          <td class="px-4 py-3">\${cityBadge}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-400">\${c.email || '-'}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-400">\${c.phone || '-'}</td>
          <td class="px-4 py-3">
            \${c.whatsapp && c.whatsapp !== '-'
              ? \`<button onclick="accionWhatsApp('\${c.whatsapp}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-mono transition-colors" title="Abrir chat de WhatsApp">
                  <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> \${c.whatsapp}
                </button>\`
              : '<span class="text-xs text-slate-600 font-mono">-</span>'}
          </td>
          <td class="px-4 py-3">
            \${c.title && c.title !== '-'
              ? \`<span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-ark-blue/10 text-ark-blue_hi border border-ark-blue/25 max-w-[200px] truncate" title="\${c.title}">\${c.title}</span>\`
              : '<span class="text-xs text-slate-600 font-mono">-</span>'}
          </td>
          <td class="px-4 py-3 text-right whitespace-nowrap sticky right-0 bg-slate-900/95 backdrop-blur-sm border-l border-slate-800/80 shadow-[-8px_0_12px_rgba(0,0,0,0.5)] z-10">
            <div class="flex items-center justify-end gap-1.5">
              \${c.whatsapp && c.whatsapp !== '-'
                ? \`<button onclick="accionWhatsApp('\${c.whatsapp}')" class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Abrir WhatsApp Web"><i data-lucide="message-circle" class="w-4 h-4"></i></button>\`
                : ''}
              <button onclick="enriquecerContactoRow(\'\${c.id}\')" class="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors" title="🔍 Enriquecer con Google / Doctoralia"><i data-lucide="sparkles" class="w-4 h-4"></i></button>
              <button onclick="abrirModalEditarContacto('\${c.id}')" class="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" title="Editar contacto"><i data-lucide="pencil" class="w-4 h-4"></i></button>
              <button onclick="accionLlamar('\${c.phone || c.whatsapp}')" class="p-1.5 rounded-lg bg-ark-emerald/10 text-ark-emerald_hi hover:bg-ark-emerald/20 transition-colors" title="Llamada IA"><i data-lucide="phone" class="w-4 h-4"></i></button>
              <button onclick="accionEmail('\${c.email}')" class="p-1.5 rounded-lg bg-ark-blue/10 text-ark-blue_hi hover:bg-ark-blue/20 transition-colors" title="Enviar correo"><i data-lucide="mail" class="w-4 h-4"></i></button>
              <button onclick="eliminarContactoRow(event, '\${c.id}')" class="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors" title="Eliminar contacto"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
          </td>
        </tr>\`;
      }).join('');

  lucide.createIcons();
}

function accionWhatsApp(num) {
  if (!num || num === '-') { toast('Contacto sin WhatsApp registrado'); return; }
  let clean = String(num).replace(/\\D/g, '');
  if (clean.length === 10) clean = '52' + clean;
  window.open('https://wa.me/' + clean, '_blank');
}

function accionLlamar(tel) {
  if (!tel || tel === '-') { toast('Contacto sin teléfono registrado'); return; }
  toast(\`📞 Iniciando llamada agente IA a \${tel}…\`);
}

function accionEmail(email) {
  if (!email || email === '-') { toast('Contacto sin correo registrado'); return; }
  toast(\`✉️ Redactando correo agéntico a \${email}…\`);
}

// ── TAREAS ──
let tareasFilter = 'todas';
async function renderTareas() {
  if (!state.tasks.length) await loadTasks();
  let list = state.tasks || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  if (tareasFilter === 'vencidas') {
    list = list.filter(t => t.due_date && t.due_date.slice(0,10) < todayStr && t.status !== 'done');
  }
  if (tareasFilter === 'hoy') {
    list = list.filter(t => t.due_date && t.due_date.slice(0, 10) === todayStr);
  }
  if (tareasFilter === 'semana') {
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    list = list.filter(t => t.due_date && t.due_date.slice(0,10) <= nextWeek);
  }

  const container = document.getElementById('tareasList');
  container.innerHTML = list.length === 0
    ? '<p class="text-sm text-slate-500 py-8 text-center bg-slate-900 border border-slate-800 rounded-xl">Sin tareas en este filtro</p>'
    : list.map(t => {
        const isDone = t.status === 'done';
        const isVencida = t.due_date && t.due_date.slice(0,10) < todayStr && !isDone;
        return \`
        <div class="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 hover:border-slate-700 transition-colors \${isDone ? 'opacity-50' : ''}">
          <input type="checkbox" \${isDone ? 'checked' : ''} onchange="completarTarea('\${t.id}')"
            class="w-4 h-4 rounded border-slate-600 bg-slate-800 text-ark-emerald focus:ring-ark-emerald/30 cursor-pointer">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-white \${isDone ? 'line-through text-slate-500' : ''}">\${t.title}</div>
            <div class="font-mono text-xs \${isVencida ? 'text-ark-rose_hi' : 'text-slate-500'}">\${t.due_date ? t.due_date.slice(0,10) : 'Sin fecha'}</div>
          </div>
          \${isVencida ? '<span class="badge badge-rojo">Vencida</span>' : (isDone ? '<span class="badge badge-esmeralda">Completada</span>' : '')}
        </div>\`;
      }).join('');

  lucide.createIcons();
}

async function completarTarea(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  const isDone = t.status === 'done';
  t.status = isDone ? 'pending' : 'done';
  renderTareas();

  try {
    if (!isDone) {
      await apiCall(\`/api/crm/tasks/\${id}/complete\`, 'POST', {});
      toast('✅ Tarea marcada como completada');
    } else {
      await apiCall(\`/api/crm/tasks/\${id}\`, 'PATCH', { status: 'pending' });
      toast('Tarea reabierta');
    }
    loadMetrics();
  } catch(e) {
    console.error('Error toggling tarea:', e);
  }
}

document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tf-btn').forEach(b => {
      b.className = 'tf-btn text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    });
    btn.className = 'tf-btn active text-xs font-semibold px-3 py-1.5 rounded-full bg-ark-blue/15 text-ark-blue_hi border border-ark-blue/30';
    tareasFilter = btn.dataset.tf;
    renderTareas();
  });
});

// ── SUPERADMIN VIEW (GOVERNANCE & TEAM) ──
async function renderSuperadmin() {
  loadTemplatesForConsole();
  await loadUsers();
  const users = state.users || [];
  document.getElementById('usersCountBadge').textContent = \`\${users.length} colaboradores activos\`;

  const body = document.getElementById('usuariosAdminBody');
  body.innerHTML = users.length === 0
    ? '<tr><td colspan="5" class="p-4 text-center text-xs text-slate-500">Sin colaboradores registrados</td></tr>'
    : users.map(u => {
        const roleBadge = u.role === 'admin' ? 'badge-azul' : (u.role === 'vendedor' ? 'badge-esmeralda' : 'badge-ambar');
        const roleLabel = u.role === 'admin' ? 'Super Admin' : (u.role === 'vendedor' ? 'Ventas' : 'Lector');
        return \`
        <tr class="hover:bg-slate-800/30 transition-colors">
          <td class="px-4 py-3 font-medium text-white">\${u.name || '-'}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-300">\${u.email}</td>
          <td class="px-4 py-3"><span class="badge \${roleBadge}">\${roleLabel}</span></td>
          <td class="px-4 py-3"><span class="text-xs text-emerald-400">● Activo</span></td>
          <td class="px-4 py-3 font-mono text-xs text-slate-500">\${u.created_at ? u.created_at.slice(0,10) : '-'}</td>
        </tr>\`;
      }).join('');

  lucide.createIcons();
}

function abrirModalInvitarUsuario() {
  document.getElementById('modalInvitarUsuario').classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModalInvitarUsuario() {
  document.getElementById('modalInvitarUsuario').classList.add('hidden');
}

async function guardarNuevoUsuario(e) {
  e.preventDefault();
  const nombre = document.getElementById('usrNombreInput').value.trim();
  const email = document.getElementById('usrEmailInput').value.trim();
  const password = document.getElementById('usrPasswordInput').value;
  const role = document.getElementById('usrRolSelect').value;

  try {
    const res = await apiCall('/api/crm/admin/users', 'POST', {
      name: nombre,
      email,
      password,
      role
    });
    if (res && res.error) { toast('⚠️ ' + res.error); return; }
    cerrarModalInvitarUsuario();
    toast(\`🎉 Colaborador \${nombre} dado de alta con rol \${role}\`);
    await renderSuperadmin();
  } catch(err) {
    toast('Error registrando colaborador');
  }
}

// ── CREACIÓN DE ENTIDADES (MODALES) ──

// Nueva Oportunidad
async function abrirModalNuevaOportunidad() {
  if (!state.accounts.length) await loadAccounts();
  const select = document.getElementById('oppAccountSelect');
  select.innerHTML = state.accounts.map(a => \`<option value="\${a.id}">\${a.name} (\${a.city || 'Mérida'})</option>\`).join('');
  document.getElementById('modalNuevaOportunidad').classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModalNuevaOportunidad() { document.getElementById('modalNuevaOportunidad').classList.add('hidden'); }

async function guardarNuevaOportunidad(e) {
  e.preventDefault();
  const accountId = document.getElementById('oppAccountSelect').value;
  const nombre = document.getElementById('oppNombreInput').value.trim();
  const monto = parseFloat(document.getElementById('oppMontoInput').value) || 399;
  const etapa = document.getElementById('oppEtapaSelect').value;
  const fecha = document.getElementById('oppFechaCierreInput').value || null;

  try {
    const res = await apiCall('/api/crm/opportunities', 'POST', {
      account_id: accountId,
      name: nombre,
      estimated_value: monto,
      stage: etapa,
      expected_close_date: fecha,
      currency: 'MXN'
    });
    if (res && res.error) { toast('⚠️ ' + res.error); return; }
    cerrarModalNuevaOportunidad();
    toast('🎉 Oportunidad creada exitosamente');
    await loadOpportunities();
    renderKanban();
  } catch(err) {
    toast('Error creando oportunidad');
  }
}

// Nueva Cuenta
function abrirModalNuevaCuenta() {
  document.getElementById('modalNuevaCuenta').classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModalNuevaCuenta() { document.getElementById('modalNuevaCuenta').classList.add('hidden'); }

async function guardarNuevaCuenta(e) {
  e.preventDefault();
  const nombre = document.getElementById('accNombreInput').value.trim();
  const ciudad = document.getElementById('accCiudadInput').value.trim();
  const tamano = document.getElementById('accTamanoSelect').value;
  const tenant = document.getElementById('accTenantSelect').value;

  try {
    const res = await apiCall('/api/crm/accounts', 'POST', {
      name: nombre,
      city: ciudad || 'Mérida',
      size: tamano,
      origin: tenant === 'acc_futura_capital' ? 'futura_manual' : 'manual'
    });
    if (res && res.error) { toast('⚠️ ' + res.error); return; }
    cerrarModalNuevaCuenta();
    toast('Cuenta dada de alta');
    await loadAccounts();
    renderCuentas();
  } catch(err) {
    toast('Error creando cuenta');
  }
}

// Nuevo Contacto
async function abrirModalNuevoContacto(preselectedAccountId = null) {
  if (!state.accounts.length) await loadAccounts();
  const select = document.getElementById('ctAccountSelect');
  select.innerHTML = state.accounts.map(a => \`<option value="\${a.id}" \${a.id === preselectedAccountId ? 'selected' : ''}>\${a.name}</option>\`).join('');
  document.getElementById('modalNuevoContacto').classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModalNuevoContacto() { document.getElementById('modalNuevoContacto').classList.add('hidden'); }

async function guardarNuevoContacto(e) {
  e.preventDefault();
  const accountId = document.getElementById('ctAccountSelect').value;
  const nombre = document.getElementById('ctNombreInput').value.trim();
  const email = document.getElementById('ctEmailInput').value.trim();
  const tel = document.getElementById('ctTelInput').value.trim();
  const whatsapp = (document.getElementById('ctWhatsAppInput')?.value || '').trim();

  try {
    const res = await apiCall('/api/crm/contacts', 'POST', {
      account_id: accountId,
      name: nombre,
      email: email || null,
      phone: tel || null,
      whatsapp: whatsapp || null
    });
    if (res && res.error) { toast('⚠️ ' + res.error); return; }
    cerrarModalNuevoContacto();
    toast('Contacto registrado');
    await loadContacts();
    renderContactos();
  } catch(err) {
    toast('Error creando contacto');
  }
}

// Nueva Tarea
function abrirModalNuevaTarea() {
  document.getElementById('modalNuevaTarea').classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModalNuevaTarea() { document.getElementById('modalNuevaTarea').classList.add('hidden'); }

async function guardarNuevaTarea(e) {
  e.preventDefault();
  const titulo = document.getElementById('taskTituloInput').value.trim();
  const fecha = document.getElementById('taskFechaInput').value;

  try {
    const res = await apiCall('/api/crm/tasks', 'POST', {
      title: titulo,
      due_date: fecha || null
    });
    if (res && res.error) { toast('⚠️ ' + res.error); return; }
    cerrarModalNuevaTarea();
    toast('Tarea programada');
    await loadTasks();
    renderTareas();
  } catch(err) {
    toast('Error creando tarea');
  }
}

// Plantilla Modal
function abrirModalPlantilla() { document.getElementById('modalPlantilla').classList.remove('hidden'); lucide.createIcons(); }
function cerrarModalPlantilla() { document.getElementById('modalPlantilla').classList.add('hidden'); }

// Importar Modal
// ── IMPORTADOR DESDE GOOGLE SHEETS / CSV (Cuentas + Contactos + Pipeline) ──
function abrirModalImportarSheets() {
  const modal = document.getElementById('modalImportar');
  if (modal) {
    modal.classList.remove('hidden');
    actualizarPreviewImportarSheets();
    lucide.createIcons();
  }
}

function cerrarModalImportarSheets() {
  const modal = document.getElementById('modalImportar');
  if (modal) modal.classList.add('hidden');
}

// Aliases para compatibilidad
function abrirModalImportar() { abrirModalImportarSheets(); }
function cerrarModalImportar() { cerrarModalImportarSheets(); }

function parseSheetsClientRows(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const firstLine = lines[0].toLowerCase();
  const hasEmail = lines[0].includes('@');
  const hasHeader = !hasEmail && (firstLine.includes('despacho') || firstLine.includes('empresa') || firstLine.includes('titular') ||
                    firstLine.includes('contacto') || firstLine.includes('correo') || firstLine.includes('email') ||
                    firstLine.includes('telefono') || firstLine.includes('whatsapp') || firstLine.includes('ciudad'));

  const startIdx = hasHeader ? 1 : 0;
  let colMap = {};
  if (hasHeader) {
    const sep = lines[0].includes('\\t') ? '\\t' : (lines[0].includes(';') ? ';' : ',');
    const cols = lines[0].split(sep).map(c => c.trim().toLowerCase().replace(/^["']|["']$/g, ''));
    cols.forEach((col, idx) => {
      if (col.includes('despacho') || col.includes('empresa') || col.includes('razon') || col === 'nombre') {
        if (colMap.despacho === undefined) colMap.despacho = idx;
      } else if (col.includes('titular') || col.includes('contacto') || col.includes('socio') || col.includes('persona')) {
        colMap.titular = idx;
      } else if (col.includes('email') || col.includes('correo')) {
        colMap.email = idx;
      } else if (col.includes('tel') || col.includes('whatsapp') || col.includes('celular') || col.includes('movil')) {
        colMap.telefono = idx;
      } else if (col.includes('ciudad') || col.includes('plaza') || col.includes('municipio') || col.includes('estado')) {
        colMap.ciudad = idx;
      }
    });
  }

  const items = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const sep = line.includes('\\t') ? '\\t' : (line.includes(';') ? ';' : ',');
    const parts = line.split(sep).map(s => s.trim().replace(/^["']|["']$/g, ''));

    let despacho = '';
    let titular = '';
    let email = '';
    let telefono = '';
    let ciudad = '';

    if (hasHeader && Object.keys(colMap).length > 0) {
      if (colMap.despacho !== undefined && parts[colMap.despacho]) despacho = parts[colMap.despacho];
      if (colMap.titular !== undefined && parts[colMap.titular]) titular = parts[colMap.titular];
      if (colMap.email !== undefined && parts[colMap.email]) email = parts[colMap.email];
      if (colMap.telefono !== undefined && parts[colMap.telefono]) telefono = parts[colMap.telefono];
      if (colMap.ciudad !== undefined && parts[colMap.ciudad]) ciudad = parts[colMap.ciudad];
    } else {
      despacho = parts[0] || '';
      titular = parts[1] || '';
      email = parts[2] || '';
      telefono = parts[3] || '';
      ciudad = parts[4] || '';
    }

    if (despacho || titular || email) {
      items.push({ despacho, titular, email, telefono, ciudad });
    }
  }
  return items;
}

function actualizarPreviewImportarSheets() {
  const textarea = document.getElementById('importarTextarea');
  const countEl = document.getElementById('previewSheetsCount');
  const noticeEl = document.getElementById('previewSheetsNotice');
  const bodyEl = document.getElementById('previewSheetsBody');
  const btn = document.getElementById('btnConfirmarImportarSheets');

  if (!textarea || !bodyEl) return;
  const raw = textarea.value;
  const rows = parseSheetsClientRows(raw);

  if (countEl) countEl.textContent = rows.length;
  if (btn) btn.disabled = rows.length === 0;

  if (rows.length === 0) {
    if (noticeEl) noticeEl.textContent = '';
    bodyEl.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Pega contenido en el área superior para ver la previsualización.</td></tr>';
    return;
  }

  const maxPreview = 8;
  const previewSlice = rows.slice(0, maxPreview);
  if (noticeEl) {
    noticeEl.textContent = rows.length > maxPreview ? ('(Mostrando primeras ' + maxPreview + ' de ' + rows.length + ' filas)') : '';
  }

  bodyEl.innerHTML = previewSlice.map((r, idx) => \`
    <tr class="hover:bg-slate-900/60 font-mono text-xs">
      <td class="px-3 py-1.5 text-slate-500">\${idx + 1}</td>
      <td class="px-3 py-1.5 font-medium text-white">\${r.despacho || '<span class="text-slate-600 italic">Auto-generado</span>'}</td>
      <td class="px-3 py-1.5 text-slate-300">\${r.titular || '<span class="text-slate-600">Socio / Titular</span>'}</td>
      <td class="px-3 py-1.5 text-slate-400">\${r.email || '-'}</td>
      <td class="px-3 py-1.5 text-slate-400">\${r.telefono || '-'}</td>
      <td class="px-3 py-1.5 text-slate-400">\${r.ciudad || '-'}</td>
    </tr>
  \`).join('');
}

async function ejecutarImportarSheets() {
  const textarea = document.getElementById('importarTextarea');
  const btn = document.getElementById('btnConfirmarImportarSheets');
  const statusMsg = document.getElementById('importSheetsStatusMsg');
  const raw = textarea ? textarea.value.trim() : '';

  if (!raw) {
    toast('⚠️ No hay datos para importar.');
    return;
  }

  const rows = parseSheetsClientRows(raw);
  if (!rows.length) {
    toast('⚠️ No se detectaron filas válidas.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Importando al CRM...';
    lucide.createIcons();
  }
  if (statusMsg) statusMsg.textContent = 'Procesando ' + rows.length + ' registros...';

  try {
    const res = await apiCall('/api/crm/import/sheets', 'POST', {
      raw: raw,
      items: rows.map(r => ({
        despacho_nombre: r.despacho,
        titular_nombre: r.titular,
        email: r.email,
        telefono: r.telefono,
        ciudad: r.ciudad,
      }))
    });

    if (res && res.error) {
      toast('⚠️ Error: ' + res.error);
      if (statusMsg) statusMsg.textContent = res.error;
      return;
    }

    const accs = res.imported_accounts !== undefined ? res.imported_accounts : 0;
    const cts = res.imported_contacts !== undefined ? res.imported_contacts : 0;
    const opps = res.imported_opportunities !== undefined ? res.imported_opportunities : 0;

    toast(\`✅ Importados: \${accs} despachos, \${cts} contactos y \${opps} oportunidades al Pipeline\`);
    cerrarModalImportarSheets();

    if (textarea) textarea.value = '';
    actualizarPreviewImportarSheets();

    // Refrescar vistas en vivo
    await Promise.all([loadAccounts(), loadContacts(), loadOpportunities()]);
    renderCuentas();
    renderContactos();
    renderKanban();

  } catch (err) {
    console.error('Error importando sheets:', err);
    toast('⚠️ Error al procesar importación');
    if (statusMsg) statusMsg.textContent = 'Error de red o servidor al importar.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Confirmar e Importar al CRM';
      lucide.createIcons();
    }
  }
}

// ── EXPORTADORES CSV / PDF ──
function descargarCSV(nombreArchivo, contenido) {
  const contenidoConBom = contenido.startsWith('\uFEFF') ? contenido : ('\uFEFF' + contenido);
  const blob = new Blob([contenidoConBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(\`Archivo descargado: \${nombreArchivo}\`);
}

function exportarCuentasCSV() {
  const contactMap = {};
  (state.contacts || []).forEach(c => {
    if (c.account_id) {
      if (!contactMap[c.account_id]) contactMap[c.account_id] = [];
      contactMap[c.account_id].push(c);
    }
  });

  const encabezados = 'id,nombre,scian,tamano,fuente,tenant,ciudad,total_contactos,contacto_principal,telefono_principal,whatsapp_principal,email_principal\\r\\n';
  const filas = (state.accounts || []).map(a => {
    const cts = contactMap[a.id] || [];
    const p = cts[0] || {};
    return \`"\${a.id}","\${(a.name||'').replace(/"/g, '""')}","\${a.scian_code||''}","\${a.size||'1-5'}","\${a.harvest_source||a.origin||'denue'}","\${getAccountTenant(a)}","\${a.city||'Mérida'}","\${cts.length}","\${(p.name||'').replace(/"/g, '""')}","\${(p.phone||'').replace(/"/g, '""')}","\${(p.whatsapp||'').replace(/"/g, '""')}","\${(p.email||'').replace(/"/g, '""')}"\`;
  }).join('\\r\\n');
  descargarCSV('cuentas_ark_crm.csv', encabezados + filas);
}

async function exportarContactosCSV() {
  toast('Preparando exportación completa de contactos…');
  let contacts = [];
  try {
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const data = await apiCall(\`/api/crm/contacts?limit=\${pageSize}&offset=\${offset}\`);
      const items = (data && data.items) || [];
      contacts.push(...items);
      if (items.length < pageSize) break;
      offset += pageSize;
      if (offset > 20000) break;
    }
    if (contacts.length > 0) {
      state.contacts = contacts;
    }
  } catch(e) {
    console.warn('Error cargando contactos para exportación, usando memoria:', e);
    contacts = state.contacts || [];
  }

  if (!contacts.length) {
    toast('No hay contactos registrados para exportar');
    return;
  }

  const accMap = {};
  (state.accounts || []).forEach(a => { accMap[a.id] = a; });

  const encabezados = 'id,nombre,puesto,email,telefono_consultorio,whatsapp,cuenta_id,cuenta_nombre,ciudad,tenant,consentimiento,fecha_creacion\\r\\n';
  const filas = contacts.map(c => {
    const acc = accMap[c.account_id] || {};
    const accName = c.account_name || acc.name || '';
    const accCity = c.account_city || acc.city || 'Mérida';
    const accTenant = acc.id ? getAccountTenant(acc) : '';
    return \`"\${c.id}","\${(c.name||'').replace(/"/g, '""')}","\${(c.title||'').replace(/"/g, '""')}","\${(c.email||'').replace(/"/g, '""')}","\${(c.phone||'').replace(/"/g, '""')}","\${(c.whatsapp||'').replace(/"/g, '""')}","\${c.account_id||''}","\${accName.replace(/"/g, '""')}","\${accCity.replace(/"/g, '""')}","\${accTenant}","\${c.consent_status||'opt_in'}","\${c.created_at||''}"\`;
  }).join('\\r\\n');

  descargarCSV('contactos_ark_crm.csv', encabezados + filas);
  toast(\`Exportados \${contacts.length} contactos a CSV\`);
}

// ── CONFIRMACIÓN Y ELIMINACIÓN ──
let _accionConfirmar = null;

function abrirConfirmacion(titulo, mensaje, onConfirm) {
  document.getElementById('modalConfirmarTitulo').textContent = titulo;
  document.getElementById('modalConfirmarMensaje').textContent = mensaje;
  _accionConfirmar = onConfirm;
  document.getElementById('modalConfirmar').classList.remove('hidden');
  lucide.createIcons();
}

function cerrarModalConfirmar() {
  document.getElementById('modalConfirmar').classList.add('hidden');
  _accionConfirmar = null;
}

const btnConfElim = document.getElementById('btnConfirmarEliminar');
if (btnConfElim) {
  btnConfElim.onclick = async () => {
    if (_accionConfirmar) {
      const fn = _accionConfirmar;
      cerrarModalConfirmar();
      await fn();
    }
  };
}

function confirmarEliminarCuenta(id, nombre) {
  abrirConfirmacion(
    '¿Eliminar cuenta "' + nombre + '"?',
    'Esta acción eliminará la cuenta y desvinculará sus contactos y actividades asociadas de forma permanente.',
    async () => {
      try {
        await apiCall('/api/crm/accounts/' + id, 'DELETE');
        state.accounts = state.accounts.filter(a => a.id !== id);
        cerrarModalCuenta();
        filtrarCuentas();
        toast('Cuenta eliminada con éxito');
      } catch(err) {
        toast('Error al eliminar cuenta: ' + (err.message || 'Error'));
      }
    }
  );
}

function eliminarCuentaRow(e, id) {
  e.stopPropagation();
  const a = state.accounts.find(x => x.id === id);
  confirmarEliminarCuenta(id, a ? a.name : 'esta cuenta');
}

function confirmarEliminarContacto(id, nombre, modalAccountId) {
  abrirConfirmacion(
    '¿Eliminar contacto "' + (nombre || 'este contacto') + '"?',
    'Esta acción eliminará al contacto de forma permanente.',
    async () => {
      try {
        await apiCall('/api/crm/contacts/' + id, 'DELETE');
        state.contacts = state.contacts.filter(c => c.id !== id);
        actualizarOpcionesFiltroCiudades();
        renderContactos();
        if (modalAccountId) {
          abrirModalCuenta(modalAccountId);
        }
        toast('Contacto eliminado con éxito');
      } catch(err) {
        toast('Error al eliminar contacto: ' + (err.message || 'Error'));
      }
    }
  );
}

function eliminarContactoRow(e, id) {
  e.stopPropagation();
  const c = state.contacts.find(x => x.id === id);
  confirmarEliminarContacto(id, c ? c.name : 'este contacto');
}

function eliminarContactoModal(e, id, accountId) {
  e.stopPropagation();
  const c = state.contacts.find(x => x.id === id);
  confirmarEliminarContacto(id, c ? c.name : 'este contacto', accountId);
}

// ── ENRIQUECIMIENTO NIVEL 2 ──
async function enriquecerContactoRow(id) {
  const c = state.contacts.find(x => x.id === id);
  const acc = c ? state.accounts.find(a => a.id === c.account_id) : null;
  const nameToSearch = c && c.name && c.name !== 'Sin nombre' && !c.name.toLowerCase().includes('contacto corporativo')
    ? c.name
    : (acc && acc.name ? acc.name : (c && c.account_name ? c.account_name : 'Contacto'));

  toast('🔍 Buscando en Doctoralia y Google para ' + nameToSearch + '…');
  try {
    const res = await apiCall('/api/crm/contacts/' + id + '/enrich', 'POST', { auto_apply: true });
    if (res && res.success) {
      if (res.enrichment && res.enrichment.found) {
        if (res.contact) {
          const idx = state.contacts.findIndex(x => x.id === id);
          if (idx !== -1) state.contacts[idx] = { ...state.contacts[idx], ...res.contact };
          renderContactos();
        }
        const wa = res.enrichment.whatsapp || res.enrichment.phone || '';
        toast('✨ ¡Enriquecido con éxito! WhatsApp: ' + wa);
      } else {
        toast('No se halló teléfono en Doctoralia para ' + nameToSearch + '.');
        if (res.enrichment && res.enrichment.google_search_url) {
          window.open(res.enrichment.google_search_url, '_blank');
        }
      }
    } else {
      toast('Error al consultar motor de enriquecimiento.');
    }
  } catch(err) {
    toast('Error: ' + (err.message || 'Error de red'));
  }
}

async function autoEnriquecerModalContacto() {
  const id = document.getElementById('editCtId').value;
  if (!id) return;
  const btn = document.getElementById('btnAutoEnriquecerModal');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Buscando…';
  lucide.createIcons();
  toast('🔍 Consultando Doctoralia y Google con IA…');

  try {
    const res = await apiCall('/api/crm/contacts/' + id + '/enrich', 'POST', { auto_apply: false });
    if (res && res.success && res.enrichment && res.enrichment.found) {
      const e = res.enrichment;
      if (e.doctor_name && (!document.getElementById('editCtNombreInput').value || document.getElementById('editCtNombreInput').value.includes('Sin nombre'))) {
        document.getElementById('editCtNombreInput').value = e.doctor_name;
      }
      if (e.title && !document.getElementById('editCtCargoInput').value) {
        document.getElementById('editCtCargoInput').value = e.title;
      }
      if (e.phone) {
        document.getElementById('editCtTelInput').value = e.phone;
      }
      if (e.whatsapp) {
        document.getElementById('editCtWhatsAppInput').value = e.whatsapp;
      }
      toast('✨ Datos encontrados: ' + (e.whatsapp || e.phone));
    } else {
      toast('No se encontraron teléfonos públicos de forma automática.');
    }
  } catch(err) {
    toast('Error: ' + (err.message || 'Error de red'));
  } finally {
    btn.innerHTML = originalText;
    lucide.createIcons();
  }
}

function abrirBusquedaGoogleModal() {
  const id = document.getElementById('editCtId').value;
  const c = state.contacts.find(x => x.id === id);
  const acc = c ? state.accounts.find(a => a.id === c.account_id) : null;
  const q = ((c && c.name && c.name !== 'Sin nombre') ? c.name : (acc && acc.name ? acc.name : '')) + ' telefono whatsapp medico';
  window.open('https://www.google.com/search?q=' + encodeURIComponent(q.trim()), '_blank');
}

function abrirBusquedaDoctoraliaModal() {
  const id = document.getElementById('editCtId').value;
  const c = state.contacts.find(x => x.id === id);
  const acc = c ? state.accounts.find(a => a.id === c.account_id) : null;
  const q = (c && c.name && c.name !== 'Sin nombre') ? c.name : (acc && acc.name ? acc.name : '');
  window.open('https://www.doctoralia.com.mx/buscar?q=' + encodeURIComponent(q.trim()), '_blank');
}

async function enriquecerCuentaRow(event, id) {
  if (event) event.stopPropagation();
  const acc = (state.accounts || []).find(a => a.id === id);
  const nameToSearch = acc && acc.name ? acc.name : 'Cuenta';

  toast('🔍 Buscando titular / socio director para ' + nameToSearch + '…');
  try {
    const res = await apiCall('/api/crm/accounts/' + id + '/enrich', 'POST', { auto_apply: true });
    if (res && res.success) {
      if (res.enrichment && res.enrichment.found) {
        const titular = res.enrichment.titular_name || res.enrichment.doctor_name || res.enrichment.contact_name || 'Titular detectado';
        const contact = res.contact;
        if (contact) {
          const idx = (state.contacts || []).findIndex(x => x.id === contact.id);
          if (idx !== -1) {
            state.contacts[idx] = { ...state.contacts[idx], ...contact };
          } else if (state.contacts) {
            state.contacts.unshift(contact);
          }
          if (currentView === 'contactos') renderContactos();
        }
        toast('✨ ¡Titular detectado! ' + titular);
      } else {
        toast('No se halló titular público automático para ' + nameToSearch + '.');
        if (res.enrichment && res.enrichment.google_search_url) {
          window.open(res.enrichment.google_search_url, '_blank');
        }
      }
    } else {
      toast('Error al consultar motor de enriquecimiento.');
    }
  } catch(err) {
    toast('Error: ' + (err.message || 'Error de red'));
  }
}

async function autoEnriquecerModalCuenta(id) {
  if (!id) return;
  const btn = document.getElementById('btnAutoEnriquecerCuenta');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Buscando…';
    lucide.createIcons();
  }
  toast('🔍 Rastreando titular, socios y redes de la firma…');

  try {
    const res = await apiCall('/api/crm/accounts/' + id + '/enrich', 'POST', { auto_apply: true });
    if (res && res.success) {
      if (res.enrichment && res.enrichment.found) {
        const e = res.enrichment;
        const titular = e.titular_name || e.doctor_name || e.contact_name || 'Titular';
        toast('✨ ¡Titular detectado! ' + titular);
        abrirModalCuenta(id);
      } else {
        toast('No se encontró titular público automático.');
        if (res.enrichment && res.enrichment.google_search_url) {
          window.open(res.enrichment.google_search_url, '_blank');
        }
      }
    }
  } catch(err) {
    toast('Error: ' + (err.message || 'Error de red'));
  } finally {
    if (btn) {
      btn.innerHTML = originalText;
      lucide.createIcons();
    }
  }
}

// ── EDICIÓN DE CONTACTO ──
function abrirModalEditarContacto(id, modalAccountId = null) {
  const c = state.contacts.find(x => x.id === id);
  if (!c) { toast('Contacto no encontrado'); return; }

  const acc = state.accounts.find(a => a.id === c.account_id);
  const cuentaNombre = c.account_name || (acc ? acc.name : (c.account_id || ''));

  document.getElementById('editCtId').value = c.id;
  document.getElementById('editCtModalAccountId').value = modalAccountId || '';
  document.getElementById('editCtCuentaNombre').textContent = cuentaNombre ? ('Empresa: ' + cuentaNombre) : '';

  const isGenericName = !c.name || c.name === 'Sin nombre' || c.name === 'Contacto Corporativo';
  document.getElementById('editCtNombreInput').value = isGenericName ? '' : c.name;
  if (isGenericName && cuentaNombre) {
    document.getElementById('editCtNombreInput').placeholder = cuentaNombre.toLowerCase().includes('consultorio') || cuentaNombre.toLowerCase().includes('dr')
      ? 'Ej. Dr. Titular / Especialista'
      : 'Ej. Titular / Director General';
  }

  document.getElementById('editCtCargoInput').value = c.title || '';

  const isSyntheticEmail = c.email && c.email.includes('@harvest.arksystems.local');
  document.getElementById('editCtEmailInput').value = isSyntheticEmail ? '' : (c.email || '');
  if (isSyntheticEmail) {
    document.getElementById('editCtEmailInput').placeholder = 'Ingresa el correo real investigado';
  }

  document.getElementById('editCtTelInput').value = (c.phone && c.phone !== '-') ? c.phone : '';
  document.getElementById('editCtWhatsAppInput').value = (c.whatsapp && c.whatsapp !== '-') ? c.whatsapp : '';
  document.getElementById('editCtConsentSelect').value = c.consent_status || 'opt_in';
  document.getElementById('editCtNoteInput').value = '';
  document.getElementById('editCtNotesList').innerHTML = '<p class="text-xs text-slate-500">Cargando notas…</p>';
  const canWriteNotes = state.user && state.user.role !== 'lector';
  document.getElementById('editCtNoteInput').disabled = !canWriteNotes;
  document.getElementById('editCtNoteSaveButton').classList.toggle('hidden', !canWriteNotes);

  document.getElementById('modalEditarContacto').classList.remove('hidden');
  lucide.createIcons();
  cargarNotasContacto(c.id);
}

function cerrarModalEditarContacto() {
  document.getElementById('modalEditarContacto').classList.add('hidden');
}

async function cargarNotasContacto(contactId) {
  const list = document.getElementById('editCtNotesList');
  try {
    const result = await apiCall('/api/crm/activities?contact_id=' + encodeURIComponent(contactId) + '&type=note&limit=50');
    if (document.getElementById('editCtId').value !== contactId) return;
    if (!result || result.error) {
      list.innerHTML = '<p class="text-xs text-rose-400">No se pudieron cargar las notas del contacto.</p>';
      return;
    }

    const notes = result.items || [];
    list.innerHTML = notes.length ? notes.map(note => \`
      <article class="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
        <p class="whitespace-pre-wrap break-words text-xs text-slate-200">\${escapeHtml(note.content)}</p>
        <div class="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
          <span>\${escapeHtml(note.author_name || 'Usuario del CRM')}</span>
          <span aria-hidden="true">·</span>
          <time datetime="\${escapeHtml(note.created_at)}">\${escapeHtml(formatearFechaNota(note.created_at))}</time>
        </div>
      </article>
    \`).join('') : '<p class="text-xs text-slate-500">Este contacto todavía no tiene notas.</p>';
  } catch (error) {
    if (document.getElementById('editCtId').value === contactId) {
      list.innerHTML = '<p class="text-xs text-rose-400">Error al cargar las notas. Intenta de nuevo.</p>';
    }
    console.error('Error cargando notas del contacto:', error);
  }
}

async function guardarNotaContacto() {
  const contactId = document.getElementById('editCtId').value;
  const contact = state.contacts.find(item => item.id === contactId);
  const textarea = document.getElementById('editCtNoteInput');
  const button = document.getElementById('editCtNoteSaveButton');
  const content = textarea.value.trim();
  if (!content) {
    toast('Escribe una nota antes de guardarla.');
    textarea.focus();
    return;
  }
  if (!contact) {
    toast('No se encontró el contacto para asociar la nota.');
    return;
  }

  button.disabled = true;
  try {
    const result = await apiCall('/api/crm/activities', 'POST', {
      type: 'note',
      account_id: contact.account_id,
      contact_id: contact.id,
      content
    });
    if (!result || result.error || !result.activity) {
      toast('No se pudo guardar la nota: ' + ((result && result.error) || 'respuesta inválida del servidor'));
      return;
    }
    textarea.value = '';
    await cargarNotasContacto(contactId);
    toast('Nota del contacto guardada.');
  } catch (error) {
    toast('Error al guardar la nota: ' + (error.message || 'Error de red'));
  } finally {
    button.disabled = false;
  }
}

async function guardarEditarContacto(e) {
  e.preventDefault();
  const id = document.getElementById('editCtId').value;
  const modalAccountId = document.getElementById('editCtModalAccountId').value;

  const name = document.getElementById('editCtNombreInput').value.trim();
  const title = document.getElementById('editCtCargoInput').value.trim();
  const email = document.getElementById('editCtEmailInput').value.trim();
  const phone = document.getElementById('editCtTelInput').value.trim();
  const whatsapp = (document.getElementById('editCtWhatsAppInput')?.value || '').trim();
  const consent_status = document.getElementById('editCtConsentSelect').value;

  try {
    const res = await apiCall('/api/crm/contacts/' + id, 'PATCH', {
      name: name || null,
      title: title || null,
      email: email || null,
      phone: phone || null,
      whatsapp: whatsapp || null,
      consent_status
    });

    if (res && res.contact) {
      const idx = state.contacts.findIndex(c => c.id === id);
      if (idx !== -1) {
        state.contacts[idx] = { ...state.contacts[idx], ...res.contact };
      }
      cerrarModalEditarContacto();
      renderContactos();
      if (modalAccountId) {
        abrirModalCuenta(modalAccountId);
      }
      toast('✅ Contacto actualizado correctamente');
    } else {
      toast('Error actualizando contacto');
    }
  } catch(err) {
    toast('Error: ' + (err.message || 'Error del servidor'));
  }
}

function exportarCohorteCSV() {
  const leads = (state.accounts || []).filter(a => getAccountTenant(a) === 'acc_ark_ledger' || a.harvest_source === 'denue');
  const encabezados = 'id,nombre,scian,fuente,ciudad\\r\\n';
  const filas = leads.map(a => \`"\${a.id}","\${(a.name||'').replace(/"/g, '""')}","\${a.scian_code||'541211'}","\${a.harvest_source||'denue'}","\${a.city||'Mérida'}"\`).join('\\r\\n');
  descargarCSV('cohorte_ark_ledger_despachos.csv', encabezados + filas);
}

function exportarCohortePDF() {
  window.print();
}

// ── BÚSQUEDA GLOBAL ──
const buscador = document.getElementById('buscadorGlobal');
const searchResults = document.getElementById('searchResults');
let searchDebounce;

buscador.addEventListener('input', (e) => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async () => {
    const q = e.target.value.trim();
    if (q.length < 2) { searchResults.classList.add('hidden'); return; }

    try {
      const data = await apiCall(\`/api/crm/search?q=\${encodeURIComponent(q)}\`);
      const resultados = [];
      (data?.accounts || []).forEach(a => resultados.push({ tipo: 'Cuenta', id: a.id, nombre: a.name, badge: 'badge-ambar', action: () => abrirModalCuenta(a.id) }));
      (data?.contacts || []).forEach(c => resultados.push({ tipo: 'Contacto', id: c.id, nombre: c.name, badge: 'badge-esmeralda', action: () => { location.hash = '#/contactos'; } }));
      (data?.opportunities || []).forEach(o => resultados.push({ tipo: 'Oportunidad', id: o.id, nombre: o.name || ('Oportunidad ' + o.id.slice(0,8)), badge: 'badge-azul', action: () => { location.hash = '#/pipeline'; } }));

      searchResults.innerHTML = resultados.length === 0
        ? '<p class="p-4 text-xs text-slate-500">Sin resultados para "' + q + '"</p>'
        : resultados.slice(0, 8).map((r, i) => \`
          <div onclick="searchResults.classList.add('hidden'); window._searchActions[\${i}]()" class="px-4 py-2.5 hover:bg-slate-800 cursor-pointer border-b border-slate-800/50 last:border-0 flex items-center justify-between">
            <span class="text-xs text-white">\${r.nombre}</span>
            <span class="badge \${r.badge}">\${r.tipo}</span>
          </div>\`).join('');

      window._searchActions = resultados.map(r => r.action);
      searchResults.classList.remove('hidden');
    } catch(err) {
      console.warn('Error en búsqueda:', err);
    }
  }, 250);
});

document.addEventListener('click', (e) => {
  if (!buscador.contains(e.target)) searchResults.classList.add('hidden');
});

// ── TOAST ──
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.innerHTML = \`<span>\${msg}</span>\`;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ── INIT ──
window.addEventListener('hashchange', router);
initUser().then(() => refreshData());

// ── CENTRAL DE COMUNICACIONES (SOFTPHONE TELNYX & MAILING RESEND) ──
let cachedTemplates = [];
let softphoneCallTimer = null;
let softphoneSeconds = 0;

function softphonePress(digit) {
  const input = document.getElementById('softphonePhoneInput');
  if (input) input.value = (input.value || '') + digit;
}

function softphoneClear() {
  const input = document.getElementById('softphonePhoneInput');
  if (input) input.value = '';
}

function onSoftphoneSpeechChange() {
  const mode = document.getElementById('softphoneSpeechMode').value;
  const customBox = document.getElementById('softphoneCustomTextBox');
  if (customBox) {
    if (mode === 'custom') customBox.classList.remove('hidden');
    else customBox.classList.add('hidden');
  }
}

async function iniciarLlamadaSoftphone() {
  const input = document.getElementById('softphonePhoneInput');
  const phone = (input?.value || '').trim();
  if (!phone || phone.length < 10) {
    toast('⚠️ Ingresa un número telefónico válido (mínimo 10 dígitos)');
    return;
  }

  const mode = document.getElementById('softphoneSpeechMode').value;
  const customText = (document.getElementById('softphoneCustomText')?.value || '').trim();

  let message = null;
  let industry = 'general';
  if (mode === 'demo_60s') {
    industry = 'general';
  } else if (mode === 'gancho_30dias') {
    industry = 'ecommerce';
    message = 'Hola, te contactamos de ARK Systems para notificarte que tu entorno comercial en la nube ya está preconfigurado con 30 días de cortesía total para tu negocio. Puedes activar tu catálogo en línea y recibir pedidos directos en WhatsApp sin costo ni tarjeta de crédito.';
  } else if (mode === 'fiscal_despachos') {
    industry = 'fiscal';
    message = 'Hola, te saludamos del equipo fiscal de ARK Systems. Recibimos tu interés para el timbrado CFDI 4.0 y papeles de trabajo oficiales con sello criptográfico inmutable SHA-256 para tu despacho. Un asesor especializado te contactará en breve para habilitar tus 20 calculadoras fiscales sin costo.';
  } else if (mode === 'custom' && customText) {
    message = customText;
  }

  const statusLabel = document.getElementById('softphoneStatusLabel');
  const dot = document.getElementById('softphoneDot');
  const callBtn = document.getElementById('softphoneCallBtn');

  statusLabel.textContent = 'Marcando vía Telnyx...';
  dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping';
  callBtn.disabled = true;

  try {
    const res = await apiCall('/api/superadmin/voice/call', 'POST', {
      to: phone,
      despacho_nombre: 'Prospecto ARK',
      message,
      industry
    });

    if (res && res.error) {
      toast('⚠️ ' + (res.message || res.error));
      statusLabel.textContent = 'Error al conectar';
      dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-rose-500';
      callBtn.disabled = false;
      return;
    }

    toast('📞 Llamada disparada exitosamente (' + (res.simulated ? 'Modo Simulado' : 'Telnyx PSTN') + ')');
    statusLabel.textContent = 'En curso · ' + (res.call_control_id || 'ID activo');
    dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-emerald-400';
    
    softphoneSeconds = 0;
    if (softphoneCallTimer) clearInterval(softphoneCallTimer);
    softphoneCallTimer = setInterval(() => {
      softphoneSeconds++;
      const m = String(Math.floor(softphoneSeconds / 60)).padStart(2, '0');
      const s = String(softphoneSeconds % 60).padStart(2, '0');
      statusLabel.textContent = 'En llamada · ' + m + ':' + s;
    }, 1000);

  } catch(e) {
    toast('Error comunicando con Telnyx');
    statusLabel.textContent = 'Falla de conexión';
    dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-rose-500';
  } finally {
    callBtn.disabled = false;
  }
}

function colgarSoftphone() {
  if (softphoneCallTimer) {
    clearInterval(softphoneCallTimer);
    softphoneCallTimer = null;
  }
  const statusLabel = document.getElementById('softphoneStatusLabel');
  const dot = document.getElementById('softphoneDot');
  if (statusLabel) statusLabel.textContent = 'Llamada finalizada · Listo';
  if (dot) dot.className = 'inline-block w-1.5 h-1.5 rounded-full bg-slate-500';
  toast('Llamada finalizada');
}

function setEmailDispatchMode(mode) {
  const singleBtn = document.getElementById('emailModeSingleBtn');
  const cohortBtn = document.getElementById('emailModeCohortBtn');
  const singleForm = document.getElementById('emailFormSingle');
  const cohortForm = document.getElementById('emailFormCohort');

  if (mode === 'single') {
    singleBtn.className = 'flex-1 py-1.5 text-xs font-medium rounded-md bg-ark-blue text-white transition-all';
    cohortBtn.className = 'flex-1 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-all';
    singleForm.classList.remove('hidden');
    cohortForm.classList.add('hidden');
  } else {
    cohortBtn.className = 'flex-1 py-1.5 text-xs font-medium rounded-md bg-ark-blue text-white transition-all';
    singleBtn.className = 'flex-1 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-all';
    cohortForm.classList.remove('hidden');
    singleForm.classList.add('hidden');
  }
}

async function loadTemplatesForConsole() {
  try {
    const res = await apiCall('/api/superadmin/templates');
    if (res && res.templates) {
      cachedTemplates = res.templates;
      const select = document.getElementById('emailConsoleTemplateSelect');
      if (select) {
        if (cachedTemplates.length) {
          select.innerHTML = cachedTemplates.map(t => \`<option value="\${t.slug}">\${t.name}</option>\`).join('');
        } else {
          select.innerHTML = '<option value="">Sin plantillas disponibles</option>';
        }
      }
    }
  } catch(e) {
    console.warn('Error loading templates:', e);
  }
  onTemplateSelectChange();
}

async function borrarPlantillaSeleccionada() {
  const select = document.getElementById('emailConsoleTemplateSelect');
  const slug = select ? select.value : '';
  if (!slug) {
    toast('⚠️ No hay ninguna plantilla seleccionada');
    return;
  }
  const tmpl = (cachedTemplates || []).find(t => t.slug === slug || t.id === slug);
  const nombre = tmpl ? tmpl.name : slug;
  const templateId = tmpl ? tmpl.id : slug;

  if (!confirm('¿Estás seguro de que deseas eliminar permanentemente la plantilla "' + nombre + '"?\\nEsta acción no se puede deshacer.')) {
    return;
  }

  try {
    const res = await apiCall('/api/superadmin/templates/' + encodeURIComponent(templateId), 'DELETE');
    if (res && res.error) {
      toast('⚠️ ' + (res.details || res.error));
      return;
    }
    toast('🗑️ Plantilla "' + nombre + '" eliminada correctamente.');
    await loadTemplatesForConsole();
    lucide.createIcons();
  } catch(e) {
    toast('Error al eliminar la plantilla');
  }
}

function onTemplateSelectChange() {
  const select = document.getElementById('emailConsoleTemplateSelect');
  const slug = select ? select.value : 'gancho_landing_30dias';
  const tmpl = cachedTemplates.find(t => t.slug === slug || t.id === slug);

  const subjectLabel = document.getElementById('emailPreviewSubject');
  const frame = document.getElementById('emailPreviewFrame');

  const sampleName = document.getElementById('emailTargetName')?.value || 'Lic. Roberto Morales';
  const sampleCompany = document.getElementById('emailTargetCompany')?.value || 'Despacho & Asociados';

  if (tmpl) {
    let html = tmpl.html_content || '';
    let subject = tmpl.subject || '';
    html = html.replace(/{{nombre}}/g, sampleName)
               .replace(/{{empresa}}/g, sampleCompany)
               .replace(/{{link_activacion}}/g, 'https://sales.arksystems.site/alta-comercio?ref=asesor')
               .replace(/{{unsubscribe_url}}/g, 'https://sales.arksystems.site/dnc');
    subject = subject.replace(/{{nombre}}/g, sampleName).replace(/{{empresa}}/g, sampleCompany);
    if (subjectLabel) subjectLabel.textContent = subject;
    if (frame) frame.srcdoc = html;
  }
}

async function dispararCorreoIndividual() {
  const select = document.getElementById('emailConsoleTemplateSelect');
  const slug = select ? select.value : 'gancho_landing_30dias';
  const to = (document.getElementById('emailTargetAddress')?.value || '').trim();
  const nombre = (document.getElementById('emailTargetName')?.value || 'Prospecto').trim();
  const empresa = (document.getElementById('emailTargetCompany')?.value || 'Empresa').trim();

  if (!to || !to.includes('@')) {
    toast('⚠️ Ingresa un correo electrónico válido');
    return;
  }

  const tmpl = cachedTemplates.find(t => t.slug === slug || t.id === slug);
  const templateId = tmpl ? tmpl.id : slug;

  try {
    const res = await apiCall(\`/api/superadmin/templates/\${templateId}/send\`, 'POST', {
      to,
      recipient_name: nombre,
      variables: {
        nombre,
        empresa,
        link_activacion: 'https://sales.arksystems.site/alta-comercio?ref=superadmin',
        unsubscribe_url: 'https://sales.arksystems.site/dnc'
      }
    });

    if (res && res.error) {
      toast('⚠️ ' + (res.details || res.error));
      return;
    }

    toast('✉️ Correo disparado con éxito a ' + to);
  } catch(e) {
    toast('Error al disparar correo con Resend');
  }
}

async function dispararCampañaCohorte() {
  const cohortId = document.getElementById('emailCohortSelect').value;
  const select = document.getElementById('emailConsoleTemplateSelect');
  const slug = select ? select.value : 'gancho_landing_30dias';
  const tmpl = cachedTemplates.find(t => t.slug === slug || t.id === slug);
  const templateId = tmpl ? tmpl.id : slug;

  if (!confirm('¿Deseas disparar la campaña masiva a la cohorte ' + cohortId + '?')) return;

  try {
    const res = await apiCall(\`/api/superadmin/cohorts/\${cohortId}/launch-email\`, 'POST', {
      template_id: templateId
    });

    if (res && res.error) {
      toast('⚠️ ' + (res.details || res.error));
      return;
    }

    toast('🚀 Campaña masiva encolada: ' + (res.total_targets || 0) + ' destinatarios procesados');
  } catch(e) {
    toast('Error al disparar campaña por cohorte');
  }
}
</script>
<script src="/admin-assistant.js" defer></script>
</body>
</html>`;
}
