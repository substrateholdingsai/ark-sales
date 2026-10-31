export const WIDGET_JS_SOURCE = `
(function() {
  if (window.__ARK_SALES_LOADED__) return;
  window.__ARK_SALES_LOADED__ = true;

  const STORAGE_KEY = "ark_sales_lead";
  let leadData = {
    id: localStorage.getItem(STORAGE_KEY + "_id") || "",
    email: localStorage.getItem(STORAGE_KEY + "_email") || "",
    despacho: localStorage.getItem(STORAGE_KEY + "_despacho") || "",
    tamano: localStorage.getItem(STORAGE_KEY + "_tamano") || "1-5",
    agent: "intake"
  };

  const AGENT_LABELS = {
    intake: { title: "El Triador (Intake)", color: "#F59E0B", icon: "🛡️" },
    riesgo: { title: "Especialista en Riesgo (SAT)", color: "#EF4444", icon: "⚖️" },
    flujo: { title: "Especialista en Flujo (Cobranza)", color: "#3B82F6", icon: "⚡" },
    closer: { title: "Arquitecto del Bundle (Closer)", color: "#B4FF00", icon: "🎯" }
  };

  // Inyectar estilos CSS
  const style = document.createElement("style");
  style.id = "ark-sales-styles";
  style.textContent = \`
    .ark-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: #0B0F14;
      color: #F8FAFC;
      border: 1px solid #B4FF00;
      border-radius: 9999px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4), 0 0 15px rgba(180, 255, 0, 0.2);
      transition: all 0.25s ease;
    }
    .ark-fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 25px rgba(180, 255, 0, 0.4);
      background: #11171E;
    }
    .ark-pulse-dot {
      width: 10px;
      height: 10px;
      background: #B4FF00;
      border-radius: 50%;
      box-shadow: 0 0 8px #B4FF00;
      animation: ark-pulse 2s infinite;
    }
    @keyframes ark-pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }
    .ark-modal {
      position: fixed;
      bottom: 84px;
      right: 24px;
      z-index: 999999;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 580px;
      max-height: calc(100vh - 120px);
      background: #090D11;
      border: 1px solid #1E293B;
      border-radius: 16px;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(180, 255, 0, 0.1);
    }
    .ark-modal.open {
      display: flex;
      animation: ark-fade-in 0.25s ease;
    }
    @keyframes ark-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ark-header {
      background: #0E141B;
      padding: 14px 18px;
      border-bottom: 1px solid #1E293B;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ark-header-title {
      font-size: 13px;
      font-weight: 700;
      color: #F8FAFC;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ark-agent-chip {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 9999px;
      background: rgba(180, 255, 0, 0.1);
      border: 1px solid #B4FF00;
      color: #B4FF00;
      font-weight: 600;
    }
    .ark-close-btn {
      background: none;
      border: none;
      color: #64748B;
      font-size: 18px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
    }
    .ark-close-btn:hover { color: #F8FAFC; }
    .ark-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #090D11;
    }
    .ark-body::-webkit-scrollbar { width: 5px; }
    .ark-body::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 4px; }
    .ark-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
    }
    .ark-msg.assistant {
      background: #131A22;
      color: #E2E8F0;
      border: 1px solid #1E293B;
      align-self: flex-start;
      border-top-left-radius: 4px;
    }
    .ark-msg.user {
      background: #B4FF00;
      color: #050B10;
      align-self: flex-end;
      font-weight: 500;
      border-top-right-radius: 4px;
    }
    .ark-transfer-alert {
      background: rgba(180, 255, 0, 0.08);
      border: 1px dashed #B4FF00;
      color: #B4FF00;
      font-size: 11px;
      padding: 8px 12px;
      border-radius: 8px;
      text-align: center;
      margin: 4px 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .ark-bundle-card {
      background: #0E141C;
      border: 1px solid #B4FF00;
      border-radius: 10px;
      padding: 12px;
      margin-top: 8px;
      box-shadow: 0 4px 15px rgba(180, 255, 0, 0.15);
    }
    .ark-bundle-card h4 {
      margin: 0 0 6px 0;
      color: #B4FF00;
      font-size: 13px;
    }
    .ark-bundle-price {
      font-size: 16px;
      font-weight: 800;
      color: #F8FAFC;
      margin-bottom: 8px;
    }
    .ark-bundle-btn {
      background: #B4FF00;
      color: #050B10;
      border: none;
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
    }
    .ark-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .ark-quick-btn {
      background: #11171F;
      border: 1px solid #1E293B;
      color: #94A3B8;
      padding: 6px 10px;
      border-radius: 9999px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .ark-quick-btn:hover {
      background: #1A232D;
      color: #B4FF00;
      border-color: #B4FF00;
    }
    .ark-footer {
      padding: 12px 14px;
      background: #0E141B;
      border-top: 1px solid #1E293B;
      display: flex;
      gap: 8px;
    }
    .ark-input {
      flex: 1;
      background: #05080B;
      border: 1px solid #1E293B;
      border-radius: 8px;
      color: #F8FAFC;
      padding: 8px 12px;
      font-size: 13px;
      outline: none;
    }
    .ark-input:focus { border-color: #B4FF00; }
    .ark-send-btn {
      background: #B4FF00;
      color: #050B10;
      border: none;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: bold;
    }
    .ark-send-btn:hover { background: #A3E635; }
    .ark-lead-bar {
      background: #0B1015;
      padding: 8px 14px;
      border-bottom: 1px solid #1E293B;
      display: flex;
      gap: 6px;
    }
    .ark-lead-bar input {
      background: #05080B;
      border: 1px solid #1E293B;
      border-radius: 4px;
      color: #CBD5E1;
      font-size: 11px;
      padding: 4px 8px;
      width: 50%;
    }
    .ark-typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: #131A22;
      border-radius: 12px;
      align-self: flex-start;
      width: fit-content;
    }
    .ark-typing-dot {
      width: 6px;
      height: 6px;
      background: #64748B;
      border-radius: 50%;
      animation: ark-bounce 1.4s infinite ease-in-out both;
    }
    .ark-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .ark-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes ark-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  \`;
  document.head.appendChild(style);

  // Crear elementos HTML del widget
  const fab = document.createElement("button");
  fab.className = "ark-fab";
  fab.innerHTML = \`<span class="ark-pulse-dot"></span><span>Hablar con ARK Sales</span>\`;
  document.body.appendChild(fab);

  const modal = document.createElement("div");
  modal.className = "ark-modal";
  modal.innerHTML = \`
    <div class="ark-header">
      <div class="ark-header-title">
        <span>⚡ ARK SALES AGENT</span>
        <span class="ark-agent-chip" id="ark-agent-chip">🛡️ El Triador</span>
      </div>
      <button class="ark-close-btn" id="ark-close-btn">&times;</button>
    </div>
    <div class="ark-lead-bar">
      <input type="text" id="ark-lead-despacho" placeholder="Tu Despacho..." value="\${leadData.despacho}">
      <input type="email" id="ark-lead-email" placeholder="correo@ejemplo.com" value="\${leadData.email}">
    </div>
    <div class="ark-body" id="ark-body">
      <div class="ark-msg assistant">
        Hola. Soy <strong>El Triador</strong> de ARK Systems. Infraestructura agéntica de cobranza multicanal (Ark Angel) y blindaje fiscal DOF (Ark Ledger) en México.
        <br><br>
        ¿En qué operación necesitas acelerar recuperación de cartera o blindar cumplimiento hoy?
        <div class="ark-quick-replies" id="ark-quick-replies">
          <button class="ark-quick-btn" data-pain="Cobranza masiva para despacho o call center BPO con guion CONDUSEF y softphone">🏢 Cobranza BPO / Call Center</button>
          <button class="ark-quick-btn" data-pain="Cobranza de rentas, cuotas de mantenimiento y pagarés con monitor antilavado LFPIORPI">🏡 Inmobiliarias & Rentas</button>
          <button class="ark-quick-btn" data-pain="Crédito automotriz, mensualidades vencidas y recargos CFF Art. 17-A y 21">🚗 Financieras de Autos & Leasing</button>
          <button class="ark-quick-btn" data-pain="Honorarios de despacho contable, CFDI 4.0, Anexo 24 y multas SAT">💼 Despachos Contables & SAT</button>
        </div>
      </div>
    </div>
    <div class="ark-footer">
      <input type="text" class="ark-input" id="ark-input" placeholder="Escribe tu mensaje aquí..." />
      <button class="ark-send-btn" id="ark-send-btn">&#10148;</button>
    </div>
  \`;
  document.body.appendChild(modal);

  // Referencias UI
  const closeBtn = modal.querySelector("#ark-close-btn");
  const bodyEl = modal.querySelector("#ark-body");
  const inputEl = modal.querySelector("#ark-input");
  const sendBtn = modal.querySelector("#ark-send-btn");
  const agentChip = modal.querySelector("#ark-agent-chip");
  const despachoInput = modal.querySelector("#ark-lead-despacho");
  const emailInput = modal.querySelector("#ark-lead-email");
  const quickReplies = modal.querySelector("#ark-quick-replies");

  // Event Listeners
  fab.addEventListener("click", () => modal.classList.toggle("open"));
  closeBtn.addEventListener("click", () => modal.classList.remove("open"));

  despachoInput.addEventListener("change", (e) => {
    leadData.despacho = e.target.value.trim();
    localStorage.setItem(STORAGE_KEY + "_despacho", leadData.despacho);
  });
  emailInput.addEventListener("change", (e) => {
    leadData.email = e.target.value.trim();
    localStorage.setItem(STORAGE_KEY + "_email", leadData.email);
  });

  quickReplies.addEventListener("click", (e) => {
    const btn = e.target.closest(".ark-quick-btn");
    if (!btn) return;
    const pain = btn.getAttribute("data-pain");
    if (pain) {
      inputEl.value = pain;
      sendMessage();
    }
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  sendBtn.addEventListener("click", sendMessage);

  function updateAgentBadge(agentKey) {
    leadData.agent = agentKey || "intake";
    const cfg = AGENT_LABELS[agentKey] || AGENT_LABELS.intake;
    agentChip.textContent = cfg.icon + " " + cfg.title;
    agentChip.style.borderColor = cfg.color;
    agentChip.style.color = cfg.color;
    agentChip.style.background = cfg.color + "18";
  }

  function appendMessage(text, role, options = {}) {
    const msg = document.createElement("div");
    msg.className = "ark-msg " + role;
    msg.innerHTML = text.replace(/\\n/g, "<br>");

    if (options.card === "bundle") {
      const card = document.createElement("div");
      card.className = "ark-bundle-card";
      card.innerHTML = \`
        <h4>🚀 PROPUESTA OFICIAL ARK SYSTEMS</h4>
        <div class="ark-bundle-price">Cobranza IA + Ark Ledger</div>
        <p style="font-size:11px;color:#94A3B8;margin:0 0 8px 0;">Voz IA ($0.25 USD/min) + WhatsApp ($0.20 USD) + Cierre Fiscal SHA-256 (desde $6,000 MXN). Motor Legal fail-closed y Grok Bot incluidos.</p>
        <button class="ark-bundle-btn" id="ark-btn-accept-proposal">Formalizar Propuesta y Recibir Cotización</button>
      \`;
      card.querySelector("#ark-btn-accept-proposal").addEventListener("click", () => {
        inputEl.value = "Acepto la propuesta oficial de Ark Angel + Ark Ledger. Favor de enviar la cotización formal.";
        sendMessage();
      });
      msg.appendChild(card);
    }

    bodyEl.appendChild(msg);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "ark-typing";
    typing.id = "ark-typing-indicator";
    typing.innerHTML = \`
      <span class="ark-typing-dot"></span>
      <span class="ark-typing-dot"></span>
      <span class="ark-typing-dot"></span>
    \`;
    bodyEl.appendChild(typing);
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function hideTyping() {
    const typing = document.querySelector("#ark-typing-indicator");
    if (typing) typing.remove();
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    appendMessage(text, "user");
    showTyping();

    // Determinar endpoint base
    const scriptTag = document.currentScript || document.querySelector("script[src*='widget.js']");
    let baseUrl = "";
    if (scriptTag && scriptTag.src) {
      try {
        const parsed = new URL(scriptTag.src, window.location.href);
        baseUrl = parsed.origin;
      } catch (e) {}
    }
    if (!baseUrl) {
      try {
        baseUrl = window.location.origin;
      } catch (e) {}
    }

    try {
      const resp = await fetch(baseUrl + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadData.id || undefined,
          message: text,
          email: leadData.email || undefined,
          despacho_nombre: leadData.despacho || undefined,
          tamano: leadData.tamano || undefined
        })
      });

      hideTyping();

      if (!resp.ok) {
        appendMessage("Disculpa, hubo una interrupción con el servicio de ventas. Por favor intenta de nuevo.", "assistant");
        return;
      }

      const data = await resp.json();

      // Guardar lead_id si es nuevo
      if (data.lead_id && data.lead_id !== leadData.id) {
        leadData.id = data.lead_id;
        localStorage.setItem(STORAGE_KEY + "_id", leadData.id);
      }

      // Notificar si hubo transferencia entre especialistas
      if (data.transferred_to && data.transferred_to !== leadData.agent) {
        const transferAlert = document.createElement("div");
        transferAlert.className = "ark-transfer-alert";
        const targetConfig = AGENT_LABELS[data.transferred_to] || AGENT_LABELS.intake;
        transferAlert.innerHTML = \`<span>⚡</span> Transfiriendo lead a: <strong>\${targetConfig.title}</strong>\`;
        bodyEl.appendChild(transferAlert);
        updateAgentBadge(data.transferred_to);
      } else if (data.agente_id) {
        updateAgentBadge(data.agente_id);
      }

      const isBundleOffer = (data.response && (data.response.includes("Enterprise") || data.response.toLowerCase().includes("bundle") || data.response.includes("6,000") || data.response.toLowerCase().includes("propuesta")));
      appendMessage(data.response || "Permíteme verificar con el equipo.", "assistant", {
        card: isBundleOffer ? "bundle" : undefined
      });

    } catch (err) {
      hideTyping();
      appendMessage("Error de conexión con el agente comercial de ARK.", "assistant");
    }
  }
})();
`;
