import { Env } from "../types";
import { verifyJwt } from "../auth/jwt";
import { normalizeRole } from "../auth/roles";

function getSecret(env: Env): string {
  if (env.CRM_JWT_SECRET && env.CRM_JWT_SECRET.trim()) return env.CRM_JWT_SECRET;
  if (env.ENVIRONMENT === "production") return "";
  return "ark-sales-dev-jwt-secret-change-me";
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
        <input name="email" type="email" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="admin@arksystems.site">
      </div>
      <div>
        <label class="text-xs text-slate-400 mb-1 block">Contraseña</label>
        <input name="password" type="password" required class="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
      </div>
      <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-md text-sm transition-colors">Entrar</button>
      <p id="err" class="text-rose-400 text-xs hidden"></p>
    </form>
  </div>
  <script>
    lucide.createIcons();
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }) });
      const data = await res.json();
      if (!res.ok) { document.getElementById('err').textContent = data.error || 'Error'; document.getElementById('err').classList.remove('hidden'); return; }
      localStorage.setItem('ark_crm_token', data.token || data.access_token);
      window.location.href = '/crm';
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
    <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 bg-blue-600 rounded flex items-center justify-center"><i data-lucide="hexagon" class="text-white w-4 h-4"></i></div>
        <span class="font-bold text-base tracking-tight">ARK <span class="text-slate-400 font-normal">CRM</span></span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span id="userInfo" class="text-slate-400 font-mono text-xs"></span>
        <button id="logoutBtn" class="text-slate-300 hover:text-white text-xs">Salir</button>
      </div>
    </div>
  </nav>

  <div class="max-w-7xl mx-auto px-4 py-4 flex gap-4">
    <aside class="w-48 shrink-0">
      <nav class="space-y-1">
        <button data-view="pipeline" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm bg-slate-800 text-white">Pipeline</button>
        <button data-view="accounts" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Cuentas</button>
        <button data-view="tasks" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Tareas</button>
        <button data-view="activities" class="navbtn w-full text-left px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-800">Actividad</button>
      </nav>
      <div class="mt-6 space-y-2">
        <button id="newAccountBtn" class="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium py-2 rounded-md">+ Nueva cuenta</button>
        <button id="newTaskBtn" class="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-2 rounded-md">+ Nueva tarea</button>
      </div>
    </aside>

    <main class="flex-1 min-w-0">
      <div id="view-pipeline" class="view"></div>
      <div id="view-accounts" class="view hidden"></div>
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
const views = ['pipeline','accounts','tasks','activities'];
function showView(v){
  views.forEach(x => document.getElementById('view-'+x).classList.toggle('hidden', x!==v));
  document.querySelectorAll('.navbtn').forEach(b => {
    const active = b.dataset.view===v;
    b.classList.toggle('bg-slate-800', active);
    b.classList.toggle('text-white', active);
    b.classList.toggle('text-slate-300', !active);
  });
  if (v==='pipeline') loadPipeline();
  if (v==='accounts') loadAccounts();
  if (v==='tasks') loadTasks();
  if (v==='activities') loadActivities();
}
document.querySelectorAll('.navbtn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

// Pipeline
const STAGES = ['nuevo','contactado','calificado','demo_agendada','propuesta_enviada','negociacion','ganado','perdido'];
const STAGE_LABEL = {nuevo:'Nuevo',contactado:'Contactado',calificado:'Calificado',demo_agendada:'Demo agendada',propuesta_enviada:'Propuesta enviada',negociacion:'Negociación',ganado:'Ganado',perdido:'Perdido'};
async function loadPipeline(){
  const el = document.getElementById('view-pipeline');
  el.innerHTML = '<div class="text-slate-400 text-sm">Cargando pipeline…</div>';
  let opps = [];
  try { const d = await api.get('/api/crm/opportunities?limit=200'); opps = d.items || []; } catch(e){ el.innerHTML='<div class="text-rose-400 text-sm">Error cargando pipeline.</div>'; return; }
  const byStage = {};
  STAGES.forEach(s => byStage[s]=[]);
  opps.forEach(o => { if(byStage[o.stage]) byStage[o.stage].push(o); else byStage['nuevo'].push(o); });

  // fetch accounts for names
  let accounts = [];
  try { const ad = await api.get('/api/crm/accounts?limit=200'); accounts = ad.items || []; } catch(e){}
  const accMap = {}; accounts.forEach(a => accMap[a.id]=a);

  let html = '<div class="flex gap-3 overflow-x-auto pb-4">';
  STAGES.forEach(s => {
    html += '<div class="kanban-col w-64 shrink-0">';
    html += '<div class="flex items-center justify-between mb-2"><h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400">'+STAGE_LABEL[s]+'</h3><span class="text-xs font-mono text-slate-500">'+byStage[s].length+'</span></div>';
    html += '<div class="space-y-2">';
    byStage[s].forEach(o => {
      const acc = accMap[o.account_id] || {};
      html += '<div class="card glass-panel rounded-lg p-3 cursor-pointer" data-opp="'+o.id+'">';
      html += '<div class="text-sm font-medium mb-1">'+(acc.name||o.account_id||'Sin cuenta')+'</div>';
      if(o.estimated_value) html += '<div class="text-xs font-mono text-amber-400 mb-1">$'+Number(o.estimated_value).toLocaleString()+' '+o.currency+'</div>';
      html += '<div class="flex items-center justify-between text-xs text-slate-500"><span>'+ (o.owner_user_id||'sin responsable') +'</span>';
      html += '<button class="stageBtn text-slate-400 hover:text-white" data-id="'+o.id+'" data-stage="'+o.stage+'">Cambiar etapa</button></div>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;

  el.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('stageBtn')) return;
      openOpportunity(card.dataset.opp);
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
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">Oportunidad</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<div class="grid grid-cols-2 gap-3 text-sm mb-4">'
    + '<div><span class="text-slate-500 text-xs">Etapa</span><div class="font-mono">'+o.stage+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Valor</span><div class="font-mono">'+(o.estimated_value||'—')+' '+o.currency+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Cierre esperado</span><div>'+(o.expected_close_date||'—')+'</div></div>'
    + '<div><span class="text-slate-500 text-xs">Responsable</span><div>'+(o.owner_user_id||'—')+'</div></div>'
    + '</div>'
    + '<h3 class="text-sm font-semibold mb-2">Actividades</h3>'
    + (d.activities||[]).map(a=>'<div class="text-xs border-b border-slate-800 py-2"><span class="font-mono text-slate-500">'+a.type+'</span> — '+ (a.content||'') +'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Tareas</h3>'
    + (d.tasks||[]).map(t=>'<div class="text-xs border-b border-slate-800 py-2">'+t.title+' · '+t.status+'</div>').join('');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}
function closeModal(){ const m=document.getElementById('modal'); m.classList.add('hidden'); m.classList.remove('flex'); }
window.closeModal = closeModal;

// Accounts
async function loadAccounts(){
  const el = document.getElementById('view-accounts');
  el.innerHTML = '<div class="mb-4 flex gap-2"><input id="accSearch" placeholder="Buscar cuenta…" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm flex-1"><select id="accSize" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Tamaño</option><option>1-5</option><option>6-20</option><option>21-50</option><option>50+</option></select></div><div id="accList" class="space-y-2"></div>';
  async function render(){
    const q = document.getElementById('accSearch').value;
    const size = document.getElementById('accSize').value;
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
  render();
}

async function openAccount(id){
  const d = await api.get('/api/crm/accounts/'+id);
  const a = d.account;
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '<div class="flex items-center justify-between mb-4"><h2 class="text-lg font-semibold">'+a.name+'</h2><button onclick="closeModal()" class="text-slate-400 hover:text-white">✕</button></div>'
    + '<div class="text-xs text-slate-500 mb-4">'+(a.size||'—')+' · '+(a.city||'—')+' · '+(a.origin||'—')+'</div>'
    + '<h3 class="text-sm font-semibold mb-2">Contactos ('+d.contacts.length+')</h3>'
    + d.contacts.map(c=>'<div class="text-xs border-b border-slate-800 py-2">'+(c.name||'—')+' · '+(c.email||'—')+' · '+(c.title||'—')+'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Oportunidades ('+d.opportunities.length+')</h3>'
    + d.opportunities.map(o=>'<div class="text-xs border-b border-slate-800 py-2">'+o.stage+' · '+(o.estimated_value||'—')+'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Tareas ('+d.tasks.length+')</h3>'
    + d.tasks.map(t=>'<div class="text-xs border-b border-slate-800 py-2">'+t.title+' · '+t.status+'</div>').join('')
    + '<h3 class="text-sm font-semibold mt-4 mb-2">Actividad reciente</h3>'
    + d.activities.map(a=>'<div class="text-xs border-b border-slate-800 py-2">'+a.type+' · '+(a.content||'')+'</div>').join('');
  modal.classList.remove('hidden'); modal.classList.add('flex');
}

// Tasks
async function loadTasks(){
  const el = document.getElementById('view-tasks');
  el.innerHTML = '<div class="mb-4 flex gap-2"><select id="taskStatus" class="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm"><option value="">Todos</option><option value="pending">Pendientes</option><option value="in_progress">En progreso</option><option value="done">Hechas</option><option value="cancelled">Canceladas</option></select><label class="flex items-center gap-2 text-sm text-slate-400"><input type="checkbox" id="taskOverdue"> Solo vencidas</label></div><div id="taskList" class="space-y-2"></div>';
  async function render(){
    const status = document.getElementById('taskStatus').value;
    const overdue = document.getElementById('taskOverdue').checked;
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

lucide.createIcons();
showView('pipeline');
</script>
</body>
</html>`;
}