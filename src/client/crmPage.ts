import { Env } from "../types";
import { verifyJwt } from "../auth/jwt";
import { normalizeRole } from "../auth/roles";

function getSecret(env: Env): string {
  if (env.CRM_JWT_SECRET && env.CRM_JWT_SECRET.trim()) return env.CRM_JWT_SECRET.trim();
  return "ark-sales-jwt-production-sovereign-2026-substrate";
}

export function hasValidToken(cookieOrToken: string | null, env: Env): boolean {
  if (!cookieOrToken) return false;
  const secret = getSecret(env);
  if (!secret) return false;
  // sync not possible; this is sync wrapper not used. We'll handle async in route.
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
  const secret = getSecret(env);
  if (!secret) return false;
  const payload = await verifyJwt(token, secret);
  if (!payload) return false;
  return !!normalizeRole(payload.role);
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
        <input name="email" type="email" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="substrateholdingsai@gmail.com">
      </div>
      <div>
        <label class="text-xs text-slate-400 mb-1 block">Contraseña</label>
        <input name="password" type="password" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
      </div>
      <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-md text-sm transition-colors">Entrar</button>
      <div class="flex items-center justify-between text-xs">
        <button type="button" id="forgotBtn" class="text-blue-400 hover:text-blue-300">Olvidé mi contraseña</button>
      </div>
      <div class="p-2.5 bg-slate-900/60 border border-slate-800/80 rounded-md text-center">
        <div class="text-[10px] uppercase font-mono tracking-wider text-slate-500">Super Admin & Cuenta Demo</div>
        <div class="text-xs font-mono text-blue-400 font-medium mt-0.5">substrateholdingsai@gmail.com</div>
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
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARK CRM · Pipeline</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
body{font-family:'Inter',sans-serif;background-color:#020617;color:#f8fafc}
.font-mono{font-family:'JetBrains Mono',monospace}
.glass-panel{background:rgba(15,23,42,0.6);backdrop-filter:blur(12px);border:1px solid rgba(51,65,85,0.5)}
.grid-bg{background-image:linear-gradient(rgba(51,65,85,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(51,65,85,0.1) 1px,transparent 1px);background-size:40px 40px}
.kanban-col{min-height:200px}
.card{transition:transform .1s ease}
.card:hover{transform:translateY(-2px)}
.modal-backdrop{background:rgba(2,6,23,0.8)}
</style>
</head>
<body class="grid-bg min-h-screen">
  <nav class="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-blue-600 rounded flex items-center justify-center"><i data-lucide="hexagon" class="text-white w-4 h-4"></i></div>
        <span class="font-bold text-base tracking-tight">ARK <span class="text-slate-400 font-normal">CRM</span></span>
      </div>
      <div class="flex-1 max-w-md">
        <input id="globalSearch" placeholder="Buscar en CRM…" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
      </div>
      <div class="flex items-center gap-3 text-sm">
        <a href="/superadmin" class="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-600/40 hover:border-blue-500 rounded text-xs font-semibold text-blue-300 hover:text-white transition-all shadow-sm">
          <i data-lucide="shield" class="w-3.5 h-3.5"></i> Super Admin
        </a>
        <span id="userInfo" class="text-slate-400 font-mono text-xs"></span>
        <button id="logoutBtn" class="text-slate-300 hover:text-white text-xs">Salir</button>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-4 py-4 flex gap-4">
    <aside class="w-48 shrink-0">
      <nav class="space-y-1">
        <button data-view="dashboard" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm bg-slate-800 text-white">Dashboard</button>
        <button data-view="pipeline" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Pipeline</button>
        <button data-view="accounts" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Cuentas</button>
        <button data-view="contacts" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Contactos</button>
        <button data-view="tasks" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Tareas</button>
        <button data-view="activities" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Actividad</button>
      </nav>
      <div class="mt-6 space-y-2">
        <button id="newAccountBtn" class="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium py-2 rounded-md">+ Nueva cuenta</button>
        <button id="newOpportunityBtn" class="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded-md">+ Nueva oportunidad</button>
        <button id="newContactBtn" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium py-2 rounded-md">+ Nuevo contacto</button>
        <button id="inviteUserBtn" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-2 rounded-md">+ Invitar usuario</button>
        <button id="newTaskBtn" class="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 rounded-md">+ Nueva tarea</button>
      </div>
    </aside>

    <main class="flex-1 min-w-0">
      <div id="view-dashboard" class="view"></div>
      <div id="view-pipeline" class="view hidden"></div>
      <div id="view-accounts" class="view hidden"></div>
      <div id="view-contacts" class="view hidden"></div>
      <div id="view-tasks" class="view hidden"></div>
      <div id="view-activities" class="view hidden"></div>
    </main>
  </div>

  <!-- Account detail modal -->
  <div id="modal" class="fixed inset-0 z-50 hidden items-center justify-center modal-backdrop">
    <div class="glass-panel rounded-xl w-full max-w-3xl max-h-[90vh] overflow-auto p-6 m-4" id="modalBody"></div>
  </div>

  <div id="toast" class="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 text-sm px-4 py-2 rounded-md hidden"></div>

<script>
const TOKEN = localStorage.getItem('ark_crm_token');
const API = (p) => fetch(p, { headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } });
const api = {
  get: (p) => API(p).then(r => r.json()),
  post: (p, b) => API(p, { method:'POST', body: JSON.stringify(b||{}) }).then(r => r.json()),
  patch: (p, b) => API(p, { method:'PATCH', body: JSON.stringify(b||{}) }).then(r => r.json()),
};

function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),2500); }

if (!TOKEN) { window.location.href = '/crm/login'; }

async function initUser(){
  try { const u = await api.get('/api/auth/me'); document.getElementById('userInfo').textContent = (u.user?.email||'') + ' · ' + (u.user?.role||''); } catch(e){}
}
initUser();

document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.removeItem('ark_crm_token'); window.location.href='/crm/login'; });

// Navigation
const views = ['dashboard','pipeline','accounts','contacts','tasks','activities'];
function showView(v){
  views.forEach(x => document.getElementById('view-'+x).classList.toggle('hidden', x!==v));
  document.querySelectorAll('.navbtn').forEach(b => {
    const active = b.dataset.view===v;
    b.classList.toggle('bg-slate-800', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('text-slate-300', !active);
  });
  if (v==='dashboard') loadDashboard();
  if (v==='pipeline') loadPipeline();
  if (v==='accounts') loadAccounts();
  if (v==='contacts') loadContacts();
  if (v==='tasks') loadTasks();
  if (v==='activities') loadActivities();
}
document.querySelectorAll('.navbtn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

// Dashboard
const STAGE_LABEL_DASH = {nuevo:'Nuevo',contactado:'Contactado',calificado:'Calificado',demo_agendada:'Demo agendada',propuesta_enviada:'Propuesta enviada',negociacion:'Negociación',ganado:'Ganado',perdido:'Perdido'};
async function loadDashboard(){
  const el = document.getElementById('view-dashboard');
  el.innerHTML = '<div class="text-slate-400 text-sm">Cargando métricas…</div>';
  let metrics = null, inboxData = null;
  try { metrics = await api.get('/api/crm/metrics'); } catch(e){ el.innerHTML='<div class="text-rose-400 text-sm">Error cargando métricas.</div>'; return; }
  try { inboxData = await api.get('/api/crm/inbox'); } catch(e){ inboxData = {inbox:[], global_overdue_tasks:[]}; }
  const o = metrics.opportunities;
  const kpis = [
    ['Oportunidades', o.total],
    ['Ganadas', o.won],
    ['Perdidas', o.lost],
    ['Conversión', o.conversion_rate_percent+'%'],
    ['Cierre prom. (días)', o.avg_time_to_close_days],
    ['Sin próxima acción', o.open_without_next_action],
    ['Tareas vencidas', metrics.tasks.overdue],
    ['Cuentas', metrics.entities.accounts],
    ['Contactos', metrics.entities.contacts],
    ['Leads', metrics.entities.leads],
  ];
  let html = '<div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">';
  kpis.forEach(([label,val]) => {
    html += '<div class="glass-panel rounded-lg p-3"><div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">'+label+'</div><div class="text-xl font-mono font-semibold">'+val+'</div></div>';
  });
  html += '</div>';

  html += '<div class="glass-panel rounded-lg p-4 mb-6"><h3 class="text-sm font-semibold mb-3">Pipeline por etapa</h3><div class="flex flex-wrap gap-3">';
  Object.keys(STAGE_LABEL_DASH).forEach(s => {
    const c = (o.by_stage && o.by_stage[s]) || 0;
    html += '<div class="flex items-center gap-2"><span class="text-xs text-slate-400">'+STAGE_LABEL_DASH[s]+'</span><span class="font-mono text-sm text-amber-400">'+c+'</span></div>';
  });
  html += '</div></div>';

  const inbox = (inboxData && inboxData.inbox) || [];
  html += '<div class="glass-panel rounded-lg p-4 mb-6"><h3 class="text-sm font-semibold mb-3">Bandeja de trabajo ('+inbox.length+')</h3>';
  if(!inbox.length){ html += '<div class="text-slate-500 text-sm">Sin oportunidades que requieran atención.</div>'; }
  else {
    html += '<div class="space-y-2">';
    inbox.forEach(item => {
      const opp = item.opportunity || {};
      const late = item.overdue_tasks_count > 0;
      html += '<div class="border-b border-slate-800 py-2 flex items-center justify-between '+(late?'text-rose-300':'')+'">';
      html += '<div><div class="text-sm font-medium">'+(opp.id||'')+'</div><div class="text-xs text-slate-500">Etapa: '+(opp.stage||'')+' · '+item.days_since_activity+' días sin actividad'+(late?' · '+item.overdue_tasks_count+' vencidas':'')+'</div></div>';
      html += '<button class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded" data-opp="'+opp.id+'">Abrir</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  const globalOverdue = (inboxData && inboxData.global_overdue_tasks) || [];
  html += '<div class="glass-panel rounded-lg p-4"><h3 class="text-sm font-semibold mb-3">Tareas vencidas sin oportunidad ('+globalOverdue.length+')</h3>';
  if(!globalOverdue.length){ html += '<div class="text-slate-500 text-sm">Ninguna.</div>'; }
  else {
    html += '<div class="space-y-1">';
    globalOverdue.forEach(t => { html += '<div class="text-xs border-b border-slate-800 py-1">'+t.title+' · '+(t.due_date||'')+'</div>'; });
    html += '</div>';
  }
  html += '</div>';

  el.innerHTML = html;
  el.querySelectorAll('[data-opp]').forEach(b => b.addEventListener('click', () => openOpportunity(b.dataset.opp)));
}

// Pipeline
const STAGE_LABEL = {nuevo:'Nuevo',contactado:'Contactado',calificado:'Calificado',demo_agendada:'Demo agendada',propuesta_enviada:'Propuesta enviada',negociacion:'Negociación',ganado:'Ganado',perdido:'Perdido'};
async function loadPipeline(){
  const el = document.getElementById('view-pipeline');
  el.innerHTML = '<div class="text-slate-400 text-sm">Cargando pipeline…</div>';
  let opps = [];
  try { const d = await api.get('/api/crm/opportunities?limit=200'); opps = d.items || []; } catch(e){ el.innerHTML='<div class="text-rose-400 text-sm">Error cargando pipeline.</div>'; return; }
  const byStage = {};
  STAGES.forEach(s => byStage[s]=[]);
  opps.forEach(o => { if(byStage[o.stage]) byStage[o.stage].push(o); else byStage['nuevo'].push(o); });

  let accounts = [];
  try { const ad = await api.get('/api/crm/accounts?limit=200'); accounts = ad.items || []; } catch(e){}
  const accMap = {}; accounts.forEach(a => accMap[a.id]=a);

  let html = '<div class="flex gap-3 overflow-x-auto pb-4">';
  STAGES.forEach(s => {
    html += '<div class="kanban-col w-64 shrink-0" data-stage="'+s+'">';
    html += '<div class="flex items-center justify-between mb-2"><h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">'+STAGE_LABEL[s]+'</h3><span class="text-xs font-mono text-slate-500" data-count="'+s+'">'+byStage[s].length+'</span></div>';
    html += '<div class="space-y-2 min-h-[120px] dropzone rounded-md p-1" data-drop="'+s+'">';
    byStage[s].forEach(o => {
      const acc = accMap[o.account_id] || {};
      html += '<div class="card glass-panel rounded-lg p-3 cursor-grab" draggable="true" data-opp="'+o.id+'" data-stage="'+o.stage+'">';
      html += '<div class="text-sm font-medium mb-1">'+(acc.name||o.account_id||'Sin cuenta')+'</div>';
      if(o.estimated_value) html += '<div class="text-xs font-mono text-amber-400 mb-1">$'+Number(o.estimated_value).toLocaleString()+' '+o.currency+'</div>';
      html += '<div class="flex items-center justify-between text-xs text-slate-500"><span>'+ (o.owner_user_id||'sin responsable') +'</span>';
      html += '<button class="stageBtn text-slate-400 hover:text-white" data-id="'+o.id+'" data-stage="'+o.stage+'">Cambiar</button></div>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;

  // click open
  el.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('stageBtn')) return;
      openOpportunity(card.dataset.opp);
    });
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.opp);
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', () => card.classList.remove('opacity-50'));
  });

  // dropzones
  el.querySelectorAll('.dropzone').forEach(zone => {
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('bg-slate-800/40'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('bg-slate-800/40'));
    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('bg-slate-800/40');
      const id = e.dataTransfer.getData('text/plain');
      const newStage = zone.dataset.drop;
      const card = el.querySelector('.card[data-opp="'+id+'"]');
      const cur = card ? card.dataset.stage : null;
      if (!id || !newStage || newStage === cur) return;
      let lossReason = null;
      if (newStage === 'perdido') lossReason = prompt('Motivo de pérdida:');
      try {
        await api.patch('/api/crm/opportunities/'+id+'/stage', { stage: newStage, loss_reason: lossReason });
        toast('Etapa actualizada');
        loadPipeline();
      } catch(err){ toast('Transición no permitida'); }
    });
  });

  el.querySelectorAll('.stageBtn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const cur = btn.dataset.stage;
      const next = prompt('Nueva etapa ('+STAGES.join(', ')+'):', cur);
      if (!next || next===cur) return;
      let lossReason = null;
      if (next==='perdido') lossReason = prompt('Motivo de pérdida:');
      try { await api.patch('/api/crm/opportunities/'+id+'/stage' , { stage: next, loss_reason: lossReason }); toast('Etapa actualizada'); loadPipeline(); }
      catch(err){ toast('Error'); }
    });
  });
}

async function openOpportunity(id){
  const d = await api.get('/api/crm/opportunities/'+id);
  const o = d.opportunity;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  let html = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Oportunidad</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<div class="grid grid-cols-2 gap-3 text-sm mb-4">'
    + '<div><span class="text-slate-500 text-xs">Etapa</span><div class="font-mono">'+o.stage+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Valor</span><div class="font-mono">'+(o.estimated_value||'—')+' '+o.currency+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Cierre esperado</span><div>'+(o.expected_close_date||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Responsable</span><div>'+(o.owner_user_id||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Cuenta</span><div>'+(o.account_id||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Contacto</span><div>'+(o.contact_id||'—')+'</div></div>'
    + '</div>'
    + '<h3 class="text-sm font-semibold mb-2">Registrar actividad</h3>'
    + '<form id="actForm" class="flex gap-2 mb-4">'
    + '<select name="type" class="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-xs"><option value="nota">Nota</option><option value="llamada">Llamada</option><option value="email">Email</option><option value="demo">Demo</option></select>'
    + '<input name="content" placeholder="Descripción…" class="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-1 text-xs">'
    + '<button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded">Agregar</button>'
    + '</form>'
    + '<h3 class="text-sm font-semibold mb-2">Actividades</h3>'
    + (d.activities||[]).map(a=>'<div class="text-xs border-b border-slate-800 py-2"><span class="font-mono text-slate-500">'+a.type+'</span> — '+ (a.content||'') +'<span class="text-slate-600 ml-2">'+a.created_at+'</span></div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Tareas</h3>'
    + (d.tasks||[]).map(t=>'<div class="text-xs border-b border-slate-800 py-2">'+t.title+' · '+t.status+'</div>').join('');
  body.innerHTML = html;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  const form = document.getElementById('actForm');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/api/crm/activities', { type: fd.get('type'), content: fd.get('content'), opportunity_id: id, account_id: o.account_id });
    toast('Actividad registrada'); openOpportunity(id);
  });
}
function closeModal(){ const m=document.getElementById('modal'); m.classList.add('hidden'); m.classList.remove('flex'); }
window.closeModal = closeModal;

// Accounts
async function loadAccounts(){
  const el = document.getElementById('view-accounts');
  el.innerHTML = '<div class="mb-4 flex gap-2 flex-wrap"><input id="accSearch" placeholder="Buscar cuenta…" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm flex-1"><select id="accSize" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Tamaño</option><option>1-5</option><option>6-20</option><option>21-50</option><option>50+</option></select><button id="saveAccFilter" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 rounded">Guardar filtro</button><button id="importCsvBtn" class="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 rounded">Importar CSV</button><button id="exportCsvBtn" class="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 rounded">Exportar CSV</button><input id="csvFile" type="file" accept=".csv" class="hidden"></div><div id="accList" class="space-y-2"></div>';
  const saved = JSON.parse(localStorage.getItem('ark_acc_filter')||'{}');
  if (saved.q) document.getElementById('accSearch').value = saved.q;
  if (saved.size) document.getElementById('accSize').value = saved.size;
  async function render(){
    const q = document.getElementById('accSearch').value;
    const size = document.getElementById('accSize').value;
    localStorage.setItem('ark_acc_filter', JSON.stringify({q,size}));
    let url = '/api/crm/accounts?limit=100';
    if(q) url += '&q='+encodeURIComponent(q);
    if(size) url += '&size='+encodeURIComponent(size);
    const d = await api.get(url);
    const list = document.getElementById('accList');
    if(!d.items || !d.items.length){ list.innerHTML='<div class="text-slate-500 text-sm">Sin cuentas.</div>'; return; }
    list.innerHTML = d.items.map(a=>'<div class="glass-panel rounded-lg p-3 flex items-center justify-between cursor-pointer" data-acc="'+a.id+'"><div><div class="text-sm font-medium">'+a.name+'</div><div class="text-xs text-slate-500">'+(a.size||'—')+' · '+(a.city||'—')+' · '+(a.origin||'—')+'</div></div><span class="text-xs font-mono text-slate-500">'+a.duplicate_review_status+'</span></div>').join('');
    list.querySelectorAll('[data-acc]').forEach(row => row.addEventListener('click', () => openAccount(row.dataset.acc)));
  }
  document.getElementById('accSearch').addEventListener('input', render);
  document.getElementById('accSize').addEventListener('change', render);
  document.getElementById('saveAccFilter').addEventListener('click', () => { toast('Filtro guardado'); });
  document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('csvFile').click());
  document.getElementById('csvFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { toast('CSV vacío'); return; }
    const header = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const items = [];
    for (let i=1;i<lines.length;i++){
      if (!lines[i].trim()) continue;
      const cols = lines[i].split(',').map(c=>c.trim());
      const obj = {};
      header.forEach((h,idx)=> obj[h]=cols[idx]||'');
      items.push({ name: obj.name||obj.nombre, size: obj.size||obj.tamano||null, city: obj.city||obj.ciudad||null, origin: obj.origin||obj.origen||'csv' });
    }
    try {
      const r = await api.post('/api/crm/accounts/bulk', { items });
      toast('Importadas '+r.created+' cuentas');
      loadAccounts();
    } catch(err){ toast('Error importando'); }
    e.target.value = '';
  });
  document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    const d = await api.get('/api/crm/accounts?limit=1000');
    const items = d.items||[];
    const csv = ['name,size,city,origin'].concat(items.map(a=>[a.name,a.size,a.city,a.origin].map(v=>'"'+(v||'')+'"').join(','))).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='accounts.csv'; a.click();
    URL.revokeObjectURL(url);
  });
  render();
}

async function openAccount(id){
  const d = await api.get('/api/crm/accounts/'+id);
  const a = d.account;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  let html = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">'+a.name+'</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<div class="text-xs text-slate-500 mb-4">'+(a.size||'—')+' · '+(a.city||'—')+' · '+(a.origin||'—')+'</div>'
    + '<h3 class="text-sm font-semibold mb-2">Agregar contacto</h3>'
    + '<form id="addContactForm" class="grid grid-cols-2 gap-2 mb-4">'
    + '<input name="name" placeholder="Nombre" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="email" placeholder="Correo" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="phone" placeholder="Teléfono" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="title" placeholder="Cargo" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<button type="submit" class="col-span-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-2 rounded-md">Agregar contacto</button>'
    + '</form>'
    + '<h3 class="text-sm font-semibold mb-2">Contactos ('+d.contacts.length+')</h3>'
    + d.contacts.map(c=>'<div class="text-xs border-b border-slate-800 py-2">'+(c.name||'—')+' · '+(c.email||'—')+' · '+(c.title||'—')+'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Oportunidades ('+d.opportunities.length+')</h3>'
    + d.opportunities.map(o=>'<div class="text-xs border-b border-slate-800 py-2">'+o.stage+' · '+(o.estimated_value||'—')+'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Tareas ('+d.tasks.length+')</h3>'
    + d.tasks.map(t=>'<div class="text-xs border-b border-slate-800 py-2">'+t.title+' · '+t.status+'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Actividad reciente</h3>'
    + d.activities.map(a=>'<div class="text-xs border-b border-slate-800 py-2">'+a.type+' · '+(a.content||'')+'</div>').join('');
  body.innerHTML = html;
  modal.classList.remove('hidden'); modal.classList.add('flex');
  const form = document.getElementById('addContactForm');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/api/crm/contacts', { account_id: id, name: fd.get('name')||null, email: fd.get('email')||null, phone: fd.get('phone')||null, title: fd.get('title')||null });
    toast('Contacto agregado'); openAccount(id);
  });
}

// Contacts
async function loadContacts(){
  const el = document.getElementById('view-contacts');
  el.innerHTML = '<div class="mb-4 flex gap-2"><input id="ctSearch" placeholder="Buscar contacto…" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm flex-1"><select id="ctAccount" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Todas las cuentas</option></select></div><div id="ctList" class="space-y-2"></div>';
  let accounts = [];
  try { const ad = await api.get('/api/crm/accounts?limit=200'); accounts = ad.items || []; } catch(e){}
  const sel = document.getElementById('ctAccount');
  accounts.forEach(a => { const o=document.createElement('option'); o.value=a.id; o.textContent=a.name; sel.appendChild(o); });

  async function render(){
    const q = document.getElementById('ctSearch').value;
    const acc = document.getElementById('ctAccount').value;
    let url = '/api/crm/contacts?limit=100';
    if(q) url += '&q='+encodeURIComponent(q);
    if(acc) url += '&account_id='+encodeURIComponent(acc);
    const d = await api.get(url);
    const list = document.getElementById('ctList');
    if(!d.items || !d.items.length){ list.innerHTML='<div class="text-slate-500 text-sm">Sin contactos.</div>'; return; }
    const accMap = {}; accounts.forEach(a => accMap[a.id]=a);
    list.innerHTML = d.items.map(c => '<div class="glass-panel rounded-lg p-3 flex items-center justify-between cursor-pointer" data-ct="'+c.id+'"><div><div class="text-sm font-medium">'+(c.name||'—')+'</div><div class="text-xs text-slate-500">'+(accMap[c.account_id]?.name||c.account_id||'—')+' · '+(c.email||'—')+' · '+(c.title||'—')+'</div></div><span class="text-xs font-mono text-slate-500">'+(c.consent_status||'')+'</span></div>').join('');
    list.querySelectorAll('[data-ct]').forEach(row => row.addEventListener('click', () => openContact(row.dataset.ct)));
  }
  document.getElementById('ctSearch').addEventListener('input', render);
  document.getElementById('ctAccount').addEventListener('change', render);
  render();
}

async function openContact(id){
  const d = await api.get('/api/crm/contacts/'+id);
  const c = d.contact;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">'+(c.name||'Contacto')+'</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<div class="grid grid-cols-2 gap-3 text-sm mb-4">'
    + '<div><span class="text-slate-500 text-xs">Cuenta</span><div>'+c.account_id+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Correo</span><div>'+(c.email||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Teléfono</span><div>'+(c.phone||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Cargo</span><div>'+(c.title||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Consentimiento</span><div>'+(c.consent_status||'—')+'</div></div>'
    + '</div>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
}

// Tasks
async function loadTasks(){
  const el = document.getElementById('view-tasks');
  el.innerHTML = '<div class="mb-4 flex gap-2"><select id="taskStatus" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Todos</option><option value="pending">Pendientes</option><option value="in_progress">En progreso</option><option value="done">Hechas</option><option value="cancelled">Canceladas</option></select><label class="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" id="taskOverdue"> Solo vencidas</label></div><div id="taskList" class="space-y-2"></div>';
  const saved = JSON.parse(localStorage.getItem('ark_task_filter')||'{}');
  if (saved.status) document.getElementById('taskStatus').value = saved.status;
  if (saved.overdue) document.getElementById('taskOverdue').checked = true;
  async function render(){
    const status = document.getElementById('taskStatus').value;
    const overdue = document.getElementById('taskOverdue').checked;
    localStorage.setItem('ark_task_filter', JSON.stringify({status,overdue}));
    let url = '/api/crm/tasks?limit=100';
    if(status) url += '&status='+encodeURIComponent(status);
    if(overdue) url += '&overdue=true';
    const d = await api.get(url);
    const list = document.getElementById('taskList');
    if(!d.items || !d.items.length){ list.innerHTML='<div class="text-slate-500 text-sm">Sin tareas.</div>'; return; }
    list.innerHTML = d.items.map(t=>{
      const late = t.due_date && new Date(t.due_date) < new Date() && t.status!=='done';
      return '<div class="glass-panel rounded-lg p-3 flex items-center justify-between '+(late?'border-rose-900':'')+'"><div><div class="text-sm font-medium">'+t.title+'</div><div class="text-xs text-slate-500">'+(t.due_date||'sin fecha')+' · '+(t.status)+'</div></div>'+(t.status!=='done'?'<button class="completeBtn text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded" data-id="'+t.id+'">Completar</button>':'<span class="text-xs text-emerald-400">Hecha</span>')+'</div>';
    }).join('');
    list.querySelectorAll('.completeBtn').forEach(b => b.addEventListener('click', async () => {
      await api.post('/api/crm/tasks/'+b.dataset.id+'/complete', {});
      toast('Tarea completada'); loadTasks();
    }));
  }
  document.getElementById('taskStatus').addEventListener('change', render);
  document.getElementById('taskOverdue').addEventListener('change', render);
  render();
}

// Activities
async function loadActivities(){
  const el = document.getElementById('view-activities');
  el.innerHTML = '<div id="actList" class="space-y-2"></div>';
  const d = await api.get('/api/crm/activities?limit=50');
  const list = document.getElementById('actList');
  if(!d.items || !d.items.length){ list.innerHTML='<div class="text-slate-500 text-sm">Sin actividad.</div>'; return; }
  list.innerHTML = d.items.map(a=>'<div class="glass-panel rounded-lg p-3"><div class="flex items-center justify-between mb-1"><span class="text-xs font-mono text-slate-500">'+a.type+'</span><span class="text-xs text-slate-600">'+a.created_at+'</span></div><div class="text-sm">'+(a.content||'')+'</div></div>').join('');
}

// Modals for new account/task
document.getElementById('newAccountBtn').addEventListener('click', () => {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Nueva cuenta</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<form id="newAccForm" class="space-y-3">'
    + '<input name="name" placeholder="Nombre del despacho" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<select name="size" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Tamaño</option><option>1-5</option><option>6-20</option><option>21-50</option><option>50+</option></select>'
    + '<input name="city" placeholder="Ciudad" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="origin" placeholder="Origen (lead, referido…)" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 rounded-md text-sm">Crear</button>'
    + '</form>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.getElementById('newAccForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/api/crm/accounts', { name: fd.get('name'), size: fd.get('size')||null, city: fd.get('city')||null, origin: fd.get('origin')||null });
    toast('Cuenta creada'); closeModal(); loadAccounts();
  });
});

document.getElementById('newOpportunityBtn').addEventListener('click', async () => {
  let accounts = [];
  try { const ad = await api.get('/api/crm/accounts?limit=200'); accounts = ad.items || []; } catch(e){}
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Nueva oportunidad</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<form id="newOppForm" class="space-y-3">'
    + '<select name="account_id" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Sin cuenta</option>'+accounts.map(a=>'<option value="'+a.id+'">'+a.name+'</option>').join('')+'</select>'
    + '<select name="stage" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="nuevo">Nuevo</option><option value="contactado">Contactado</option><option value="calificado">Calificado</option></select>'
    + '<input name="estimated_value" type="number" placeholder="Valor estimado" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="currency" placeholder="Moneda (MXN)" value="MXN" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="expected_close_date" type="date" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="owner_user_id" placeholder="Responsable (id)" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-md text-sm">Crear</button>'
    + '</form>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.getElementById('newOppForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/api/crm/opportunities', {
      account_id: fd.get('account_id')||null,
      stage: fd.get('stage')||'nuevo',
      estimated_value: fd.get('estimated_value')?Number(fd.get('estimated_value')):null,
      currency: fd.get('currency')||'MXN',
      expected_close_date: fd.get('expected_close_date')||null,
      owner_user_id: fd.get('owner_user_id')||null,
    });
    toast('Oportunidad creada'); closeModal(); loadPipeline();
  });
});

document.getElementById('newContactBtn').addEventListener('click', async () => {
  let accounts = [];
  try { const ad = await api.get('/api/crm/accounts?limit=200'); accounts = ad.items || []; } catch(e){}
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Nuevo contacto</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<form id="newContactForm" class="space-y-3">'
    + '<select name="account_id" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Cuenta *</option>'+accounts.map(a=>'<option value="'+a.id+'">'+a.name+'</option>').join('')+'</select>'
    + '<input name="name" placeholder="Nombre" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="email" placeholder="Correo" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="phone" placeholder="Teléfono" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="title" placeholder="Cargo" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md text-sm">Crear</button>'
    + '</form>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.getElementById('newContactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/api/crm/contacts', { account_id: fd.get('account_id'), name: fd.get('name')||null, email: fd.get('email')||null, phone: fd.get('phone')||null, title: fd.get('title')||null });
    toast('Contacto creado'); closeModal(); loadContacts();
  });
});

document.getElementById('inviteUserBtn').addEventListener('click', () => {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Invitar usuario</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<form id="inviteForm" class="space-y-3">'
    + '<input name="email" type="email" placeholder="Correo" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<input name="name" placeholder="Nombre" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<select name="role" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="vendedor">Vendedor</option><option value="lector">Lector</option><option value="admin">Admin</option></select>'
    + '<button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-md text-sm">Invitar</button>'
    + '</form>'
    + '<p id="inviteMsg" class="text-xs text-slate-400 mt-2"></p>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.getElementById('inviteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const res = await fetch('/api/auth/invite', { method:'POST', headers:{'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'}, body: JSON.stringify({ email: fd.get('email'), name: fd.get('name'), role: fd.get('role') }) });
    const data = await res.json();
    const msg = document.getElementById('inviteMsg');
    if (!res.ok) { msg.textContent = data.error || 'Error'; msg.className='text-xs text-rose-400 mt-2'; return; }
    msg.textContent = 'Invitación enviada' + (data.reset_token ? ' (dev token: '+data.reset_token+')' : '');
    msg.className='text-xs text-emerald-400 mt-2';
  });
});

document.getElementById('newTaskBtn').addEventListener('click', () => {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Nueva tarea</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<form id="newTaskForm" class="space-y-3">'
    + '<input name="title" placeholder="Título" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<textarea name="description" placeholder="Descripción" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"></textarea>'
    + '<input name="due_date" type="date" class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm">'
    + '<button type="submit" class="w-full bg-amber-600 hover:bg-amber-500 text-white font-medium py-2 rounded-md text-sm">Crear</button>'
    + '</form>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
  document.getElementById('newTaskForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await api.post('/api/crm/tasks', { title: fd.get('title'), description: fd.get('description')||null, due_date: fd.get('due_date')||null });
    toast('Tarea creada'); closeModal(); loadTasks();
  });
});

document.getElementById('globalSearch').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  const q = e.target.value.trim();
  if (!q) return;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="text-slate-400 text-sm">Buscando…</div>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
  try {
    const d = await api.get('/api/crm/search?q='+encodeURIComponent(q));
    let html = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Resultados: '+q+'</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>';
    const section = (title, items, render) => {
      if (!items || !items.length) return '';
      return '<h3 class="text-sm font-semibold mt-3 mb-1">'+title+' ('+items.length+')</h3>'+items.map(render).join('');
    };
    html += section('Cuentas', d.accounts, a=>'<div class="text-xs border-b border-slate-800 py-1 cursor-pointer" data-acc="'+a.id+'">'+a.name+' · '+(a.city||'')+'</div>');
    html += section('Contactos', d.contacts, c=>'<div class="text-xs border-b border-slate-800 py-1 cursor-pointer" data-ct="'+c.id+'">'+(c.name||'—')+' · '+(c.email||'')+'</div>');
    html += section('Oportunidades', d.opportunities, o=>'<div class="text-xs border-b border-slate-800 py-1 cursor-pointer" data-opp="'+o.id+'">'+o.id+' · '+o.stage+' · '+(o.estimated_value||'')+'</div>');
    html += section('Actividades', d.activities, a=>'<div class="text-xs border-b border-slate-800 py-1">'+a.type+' · '+(a.content||'').slice(0,80)+'</div>');
    if (!d.accounts.length && !d.contacts.length && !d.opportunities.length && !d.activities.length) html += '<div class="text-slate-500 text-sm mt-2">Sin resultados.</div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-acc]').forEach(x=>x.addEventListener('click',()=>{ closeModal(); openAccount(x.dataset.acc); }));
    body.querySelectorAll('[data-ct]').forEach(x=>x.addEventListener('click',()=>{ closeModal(); openContact(x.dataset.ct); }));
    body.querySelectorAll('[data-opp]').forEach(x=>x.addEventListener('click',()=>{ closeModal(); openOpportunity(x.dataset.opp); }));
  } catch(err){ body.innerHTML = '<div class="text-rose-400 text-sm">Error en búsqueda.</div>'; }
});
</script>
</body>
</html>`;
}