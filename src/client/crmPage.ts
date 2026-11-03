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
          <button onclick="abrirModalImportar()" class="flex items-center gap-2 border border-slate-700 text-slate-300 text-sm px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            <i data-lucide="upload" class="w-4 h-4"></i> Importar
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
        <select class="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue" id="filtroTenant" onchange="filtrarCuentas()">
          <option value="">Tenant (todos)</option>
          <option value="acc_ark_ledger">Ark Ledger</option>
          <option value="acc_futura_capital">Futura Capital</option>
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
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-white">Contactos Clave</h1>
          <p class="text-xs text-slate-400">Tomadores de decisión y contactos directos</p>
        </div>
        <button onclick="abrirModalNuevoContacto()" class="flex items-center gap-2 bg-ark-emerald text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ark-emerald/80 transition-colors">
          <i data-lucide="plus" class="w-4 h-4"></i> Nuevo contacto
        </button>
      </div>
      <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800 text-left text-slate-400 font-mono text-xs uppercase tracking-wider">
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Cuenta</th>
              <th class="px-4 py-3">Email</th>
              <th class="px-4 py-3">Teléfono</th>
              <th class="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody id="contactosBody" class="divide-y divide-slate-800/50"></tbody>
        </table>
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
            <span class="text-[10px] font-mono text-slate-400">ventas@arksystems.site</span>
          </div>

          <div class="p-5 space-y-4 flex-1 flex flex-col">
            <!-- Selector de Plantilla y Modo -->
            <div class="grid sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-mono text-slate-400 mb-1">Plantilla de Campaña</label>
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
          <label class="block text-xs font-mono text-slate-400 mb-1">Teléfono</label>
          <input type="text" id="ctTelInput" placeholder="+52 999 123 4567" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-ark-blue">
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button type="button" onclick="cerrarModalNuevoContacto()" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700">Cancelar</button>
        <button type="submit" class="px-4 py-2 rounded-lg bg-ark-emerald text-white text-xs font-semibold hover:bg-ark-emerald/80">Guardar contacto</button>
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

<!-- ═══════════════ MODAL IMPORTAR ═══════════════ -->
<div id="modalImportar" class="fixed inset-0 z-50 hidden flex items-center justify-center p-4">
  <div class="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="cerrarModalImportar()"></div>
  <div class="modal-content relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl z-10">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-bold text-white">Importar Cuentas</h3>
      <button onclick="cerrarModalImportar()" class="p-1 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <div class="space-y-4">
      <p class="text-xs text-slate-400">Pega un listado de razones sociales o un JSON con formato <code class="text-ark-blue_hi">[{"name":"...", "city":"..."}]</code>:</p>
      <textarea id="importarTextarea" rows="6" placeholder="Despacho Contable ABC, Mérida&#10;Consultores Fiscales Sureste, Cancún" class="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white font-mono focus:border-ark-blue"></textarea>
      <div class="flex justify-end gap-2">
        <button onclick="cerrarModalImportar()" class="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold">Cancelar</button>
        <button onclick="procesarImportarCuentas()" class="px-4 py-2 bg-ark-blue text-white rounded-lg text-xs font-semibold hover:bg-ark-blue/80">Importar</button>
      </div>
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

async function loadAccounts() {
  try {
    const data = await apiCall('/api/crm/accounts?limit=200');
    if (data && data.items) state.accounts = data.items;
  } catch (e) { console.error('loadAccounts error:', e); }
}

async function loadOpportunities() {
  try {
    const data = await apiCall('/api/crm/opportunities?limit=200');
    if (data && data.items) state.opportunities = data.items;
  } catch (e) { console.error('loadOpportunities error:', e); }
}

async function loadContacts() {
  try {
    const data = await apiCall('/api/crm/contacts?limit=200');
    if (data && data.items) state.contacts = data.items;
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

const FUTURA_SCIANS = new Set([
  '531210', '531311', '523920',
  '621111', '621112', '621211', '621511', '622111',
  '484111', '484121', '493111', '488511',
  '721111', '721190', '531110', '551110'
]);

function getAccountTenant(a) {
  if (a && a.tenant_id) return a.tenant_id;
  if (!a) return 'acc_ark_ledger';
  const id = String(a.id || '').toLowerCase();
  const name = String(a.name || '').toLowerCase();
  const origin = String(a.origin || '').toLowerCase();
  const source = String(a.harvest_source || '').toLowerCase();
  const scian = String(a.scian_code || '').trim();

  if (
    id.includes('futura') ||
    name.includes('futura capital') ||
    origin.includes('futura') ||
    origin.includes('proptech') ||
    origin.includes('inmobiliaria') ||
    source.includes('hermes') ||
    source.includes('vektor') ||
    FUTURA_SCIANS.has(scian)
  ) {
    return 'acc_futura_capital';
  }
  return 'acc_ark_ledger';
}

function filtrarCuentas() {
  const tamano = document.getElementById('filtroTamano').value;
  const tenant = document.getElementById('filtroTenant').value;

  let list = state.accounts || [];
  if (tamano) list = list.filter(a => (a.size || a.employee_count_range || '').includes(tamano));
  if (tenant) list = list.filter(a => getAccountTenant(a) === tenant);

  document.getElementById('cuentasSub').textContent = \`\${list.length} de \${state.accounts.length} cuentas registradas en D1\`;

  const body = document.getElementById('cuentasBody');
  body.innerHTML = list.length === 0
    ? '<tr><td colspan="7" class="p-6 text-center text-slate-500 text-sm">No se encontraron cuentas con los filtros seleccionados</td></tr>'
    : list.map(a => {
        const tid = getAccountTenant(a);
        const isFutura = tid === 'acc_futura_capital';
        return \`
    <tr class="hover:bg-slate-800/30 cursor-pointer transition-colors" onclick="abrirModalCuenta('\${a.id}')">
      <td class="px-4 py-3 font-medium text-white">\${a.name || '-'}</td>
      <td class="px-4 py-3 font-mono text-xs text-slate-400">\${a.scian_code || '-'}</td>
      <td class="px-4 py-3"><span class="badge badge-ambar">\${a.size || a.employee_count_range || '1-5'}</span></td>
      <td class="px-4 py-3 font-mono text-xs text-slate-400">\${a.harvest_source || a.origin || 'denue'}</td>
      <td class="px-4 py-3"><span class="badge \${isFutura ? 'badge-indigo' : 'badge-azul'}">\${isFutura ? 'Futura Capital' : 'Ark Ledger'}</span></td>
      <td class="px-4 py-3 text-xs text-slate-400">\${a.city || 'Mérida'}</td>
      <td class="px-4 py-3 text-right"><i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 inline"></i></td>
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

    content.innerHTML = \`
      <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div>
          <h2 class="text-lg font-bold text-white">\${account.name}</h2>
          <span class="text-xs font-mono text-slate-500">\${account.id}</span>
        </div>
        <button onclick="cerrarModalCuenta()" class="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><i data-lucide="x" class="w-5 h-5"></i></button>
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
                <div class="font-mono text-xs text-slate-400">\${c.phone || 'Sin tel'}</div>
              </div>
              <span class="text-xs text-slate-400 font-mono">\${c.email || 'Sin email'}</span>
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

function cerrarModalCuenta() {
  document.getElementById('modalCuenta').classList.add('hidden');
}

// ── CONTACTOS ──
async function renderContactos() {
  if (!state.contacts.length) await loadContacts();
  const body = document.getElementById('contactosBody');
  const contacts = state.contacts || [];

  body.innerHTML = contacts.length === 0
    ? '<tr><td colspan="5" class="p-6 text-center text-slate-500 text-sm">Sin contactos registrados. Haz clic en "+ Nuevo contacto" para dar de alta uno.</td></tr>'
    : contacts.map(c => {
        const acc = state.accounts.find(a => a.id === c.account_id);
        const cuentaNombre = acc ? acc.name : (c.account_id ? 'Cuenta ' + c.account_id.slice(0,8) : '-');
        return \`
        <tr class="hover:bg-slate-800/30 transition-colors">
          <td class="px-4 py-3 font-medium text-white">\${c.name || 'Sin nombre'}</td>
          <td class="px-4 py-3 text-slate-400">\${cuentaNombre}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-400">\${c.email || '-'}</td>
          <td class="px-4 py-3 font-mono text-xs text-slate-400">\${c.phone || '-'}</td>
          <td class="px-4 py-3">
            <div class="flex gap-2">
              <button onclick="accionLlamar('\${c.phone}')" class="p-1.5 rounded-lg bg-ark-emerald/10 text-ark-emerald_hi hover:bg-ark-emerald/20 transition-colors" title="Llamada IA"><i data-lucide="phone" class="w-4 h-4"></i></button>
              <button onclick="accionEmail('\${c.email}')" class="p-1.5 rounded-lg bg-ark-blue/10 text-ark-blue_hi hover:bg-ark-blue/20 transition-colors" title="Enviar correo"><i data-lucide="mail" class="w-4 h-4"></i></button>
            </div>
          </td>
        </tr>\`;
      }).join('');

  lucide.createIcons();
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

  try {
    const res = await apiCall('/api/crm/contacts', 'POST', {
      account_id: accountId,
      name: nombre,
      email: email || null,
      phone: tel || null
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
function abrirModalImportar() { document.getElementById('modalImportar').classList.remove('hidden'); lucide.createIcons(); }
function cerrarModalImportar() { document.getElementById('modalImportar').classList.add('hidden'); }

async function procesarImportarCuentas() {
  const text = document.getElementById('importarTextarea').value.trim();
  if (!text) return;
  const items = [];
  try {
    if (text.startsWith('[')) {
      items.push(...JSON.parse(text));
    } else {
      const lines = text.split('\\n');
      for (const line of lines) {
        const parts = line.split(',');
        if (parts[0]) {
          items.push({ name: parts[0].trim(), city: (parts[1] || 'Mérida').trim(), origin: 'csv_import' });
        }
      }
    }
    const res = await apiCall('/api/crm/accounts/bulk', 'POST', { items });
    toast(\`✅ \${res?.created || items.length} cuentas importadas\`);
    cerrarModalImportar();
    await loadAccounts();
    renderCuentas();
  } catch(err) {
    toast('Error en formato de importación');
  }
}

// ── EXPORTADORES CSV / PDF ──
function descargarCSV(nombreArchivo, contenido) {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast(\`Archivo descargado: \${nombreArchivo}\`);
}

function exportarCuentasCSV() {
  const encabezados = 'id,nombre,scian,tamano,fuente,tenant,ciudad\\n';
  const filas = (state.accounts || []).map(a => 
    \`"\${a.id}","\${(a.name||'').replace(/"/g, '""')}","\${a.scian_code||''}","\${a.size||'1-5'}","\${a.harvest_source||a.origin||'denue'}","\${getAccountTenant(a)}","\${a.city||'Mérida'}"\`
  ).join('\\n');
  descargarCSV('cuentas_ark_crm.csv', encabezados + filas);
}

function exportarCohorteCSV() {
  const leads = (state.accounts || []).filter(a => getAccountTenant(a) === 'acc_ark_ledger' || a.harvest_source === 'denue');
  const encabezados = 'id,nombre,scian,fuente,ciudad\\n';
  const filas = leads.map(a => \`"\${a.id}","\${(a.name||'').replace(/"/g, '""')}","\${a.scian_code||'541211'}","\${a.harvest_source||'denue'}","\${a.city||'Mérida'}"\`).join('\\n');
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
</script>
</body>
</html>`;
}


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
      if (select && cachedTemplates.length) {
        select.innerHTML = cachedTemplates.map(t => `<option value="${t.slug}">${t.name}</option>`).join('');
      }
    }
  } catch(e) {
    console.warn('Error loading templates:', e);
  }
  onTemplateSelectChange();
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
    const res = await apiCall(`/api/superadmin/templates/${templateId}/send`, 'POST', {
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
    const res = await apiCall(`/api/superadmin/cohorts/${cohortId}/launch-email`, 'POST', {
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
