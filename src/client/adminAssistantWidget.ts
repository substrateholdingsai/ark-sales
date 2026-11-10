export const ADMIN_ASSISTANT_WIDGET_JS_SOURCE = `
(function() {
  if (window.__ARK_ADMIN_ASSISTANT_LOADED__) return;
  window.__ARK_ADMIN_ASSISTANT_LOADED__ = true;

  const TOKEN_KEY = "ark_crm_token";

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }

  const style = document.createElement("style");
  style.id = "ark-admin-assistant-styles";
  style.textContent = \`
    .ark-admin-fab {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 999999;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid #6366f1;
      border-radius: 9999px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4), 0 0 15px rgba(99,102,241,0.25);
      transition: all 0.2s ease;
    }
    .ark-admin-fab:hover { transform: translateY(-2px); background: #1e293b; }
    .ark-admin-modal {
      position: fixed;
      bottom: 84px;
      left: 24px;
      z-index: 999999;
      width: 400px;
      max-width: calc(100vw - 32px);
      height: 560px;
      max-height: calc(100vh - 120px);
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 16px;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: Inter, system-ui, sans-serif;
      box-shadow: 0 20px 50px rgba(0,0,0,0.7);
    }
    .ark-admin-modal.open { display: flex; animation: ark-admin-fade 0.2s ease; }
    @keyframes ark-admin-fade { from { opacity: 0; transform: translateY(10px);} to { opacity:1; transform: translateY(0);} }
    .ark-admin-header { background: #0f172a; padding: 14px 18px; border-bottom: 1px solid #1e293b; display:flex; justify-content:space-between; align-items:center; }
    .ark-admin-title { font-size: 13px; font-weight: 700; color: #f8fafc; display:flex; align-items:center; gap:8px; }
    .ark-admin-chip { font-size: 11px; padding: 3px 8px; border-radius: 9999px; background: rgba(99,102,241,0.15); border:1px solid #6366f1; color:#a5b4fc; font-weight:600; }
    .ark-admin-close { background:none; border:none; color:#64748b; font-size:18px; cursor:pointer; padding:4px; line-height:1; }
    .ark-admin-close:hover { color:#f8fafc; }
    .ark-admin-body { flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; background:#020617; }
    .ark-admin-msg { max-width:85%; padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.45; word-break:break-word; }
    .ark-admin-msg.assistant { background:#0f172a; color:#e2e8f0; border:1px solid #1e293b; align-self:flex-start; border-top-left-radius:4px; }
    .ark-admin-msg.user { background:#6366f1; color:#fff; align-self:flex-end; border-top-right-radius:4px; }
    .ark-admin-footer { padding:12px 14px; background:#0f172a; border-top:1px solid #1e293b; display:flex; gap:8px; }
    .ark-admin-input { flex:1; background:#020617; border:1px solid #1e293b; border-radius:8px; color:#f8fafc; padding:8px 12px; font-size:13px; outline:none; }
    .ark-admin-input:focus { border-color:#6366f1; }
    .ark-admin-send { background:#6366f1; color:#fff; border:none; border-radius:8px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; }
    .ark-admin-send:hover { background:#4f46e5; }
    .ark-admin-typing { display:flex; align-items:center; gap:4px; padding:8px 12px; background:#0f172a; border-radius:12px; align-self:flex-start; width:fit-content; }
    .ark-admin-typing-dot { width:6px; height:6px; background:#64748b; border-radius:50%; animation: ark-admin-bounce 1.4s infinite ease-in-out both; }
    .ark-admin-typing-dot:nth-child(1){animation-delay:-0.32s;}
    .ark-admin-typing-dot:nth-child(2){animation-delay:-0.16s;}
    @keyframes ark-admin-bounce { 0%,80%,100%{transform:scale(0);} 40%{transform:scale(1);} }
  \`;
  document.head.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "ark-admin-fab";
  fab.innerHTML = '<span style="width:10px;height:10px;background:#6366f1;border-radius:50%;box-shadow:0 0 8px #6366f1;"></span><span>Asistente AI</span>';
  document.body.appendChild(fab);

  const modal = document.createElement("div");
  modal.className = "ark-admin-modal";
  modal.innerHTML = \`
    <div class="ark-admin-header">
      <div class="ark-admin-title">
        <span>🤖 ARK ADMIN ASSISTANT</span>
        <span class="ark-admin-chip" id="ark-admin-chip">Asistente AI</span>
      </div>
      <button class="ark-admin-close" id="ark-admin-close">&times;</button>
    </div>
    <div class="ark-admin-body" id="ark-admin-body">
      <div class="ark-admin-msg assistant">
        Hola. Soy el <strong>Asistente AI</strong> de ARK. Puedo ayudarte con métricas, tenants, campañas y operación del CRM.
      </div>
    </div>
    <div class="ark-admin-footer">
      <input type="text" class="ark-admin-input" id="ark-admin-input" placeholder="Escribe tu consulta..." />
      <button class="ark-admin-send" id="ark-admin-send">&#10148;</button>
    </div>
  \`;
  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#ark-admin-close");
  const bodyEl = modal.querySelector("#ark-admin-body");
  const inputEl = modal.querySelector("#ark-admin-input");
  const sendBtn = modal.querySelector("#ark-admin-send");

  fab.addEventListener("click", () => modal.classList.toggle("open"));
  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
  sendBtn.addEventListener("click", sendMessage);

  function appendMessage(text, role) {
    const msg = document.createElement("div");
    msg.className = "ark-admin-msg " + role;
    msg.innerHTML = String(text || "").replace(/\\n/g, "<br>");
    bodyEl.appendChild(msg);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function showTyping() {
    const t = document.createElement("div");
    t.className = "ark-admin-typing";
    t.id = "ark-admin-typing";
    t.innerHTML = '<span class="ark-admin-typing-dot"></span><span class="ark-admin-typing-dot"></span><span class="ark-admin-typing-dot"></span>';
    bodyEl.appendChild(t);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function hideTyping() {
    const t = document.querySelector("#ark-admin-typing");
    if (t) t.remove();
  }

  function baseUrl() {
    try {
      const scripts = document.querySelectorAll("script[src*='assistant'],script[src*='admin-widget'],script[src*='ai-assistant']");
      for (const s of scripts) {
        if (s && s.src) {
          const u = new URL(s.src, window.location.href);
          return u.origin;
        }
      }
    } catch (e) {}
    try { return window.location.origin; } catch (e) { return ""; }
  }

  async function postAssistant(text) {
    const token = getToken();
    const bases = [baseUrl(), window.location.origin];
    const paths = ["/api/admin/assistant", "/api/superadmin/assistant", "/api/assistant", "/api/admin/ai-assistant", "/api/ai-assistant"];
    const body = JSON.stringify({ message: text });
    for (const b of bases) {
      for (const p of paths) {
        try {
          const resp = await fetch(b + p, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: "Bearer " + token } : {})
            },
            body
          });
          if (resp.ok) {
            const data = await resp.json().catch(() => ({}));
            return data.response || data.answer || data.reply || data.message || "Sin respuesta.";
          }
        } catch (e) {}
      }
    }
    return "No se pudo contactar al asistente AI.";
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    appendMessage(text, "user");
    showTyping();
    const reply = await postAssistant(text);
    hideTyping();
    appendMessage(reply, "assistant");
  }
})();
`;
