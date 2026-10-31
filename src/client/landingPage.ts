export function renderPublicLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARK Sales · Funciones del Proyecto · Infraestructura Agéntica</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script type="module" src="https://unpkg.com/@splinetool/viewer@1.9.72/build/spline-viewer.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #020617; color: #f8fafc; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(51, 65, 85, 0.5);
        }
        .glow-amber { box-shadow: 0 0 25px rgba(245, 158, 11, 0.15); }
        .grid-bg {
            background-image: linear-gradient(rgba(51, 65, 85, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(51, 65, 85, 0.1) 1px, transparent 1px);
            background-size: 40px 40px;
        }
        @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(2); opacity: 0; }
        }
        .agent-active::before {
            content: ''; position: absolute; left: 0; top: 0; width: 8px; height: 8px;
            background: #10b981; border-radius: 50%;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
    </style>
</head>
<body class="grid-bg min-h-screen flex flex-col">
    <nav class="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <i data-lucide="hexagon" class="text-white w-5 h-5"></i>
                </div>
                <span class="font-bold text-lg tracking-tight">ARK <span class="text-slate-400 font-normal">PULSE</span></span>
            </div>
            <div class="flex items-center gap-4 text-sm">
                <div class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                    <div class="relative w-2 h-2">
                        <div class="absolute inset-0 bg-emerald-500 rounded-full agent-active"></div>
                        <div class="relative w-2 h-2 bg-emerald-500 rounded-full"></div>
                    </div>
                    <span class="text-slate-400 font-mono text-xs">Llama 3.3 70B · Online</span>
                </div>
                <a href="#funciones" class="text-slate-300 hover:text-white transition-colors">Funciones</a>
                <a href="/crm" class="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white text-xs font-medium transition-colors">
                    <i data-lucide="layout-dashboard" class="w-3.5 h-3.5 text-amber-400"></i>
                    <span>Acceso CRM</span>
                </a>
                <a href="/superadmin" class="flex items-center gap-1.5 px-3 py-1.5 rounded border border-blue-600/40 hover:border-blue-500 bg-gradient-to-r from-blue-950/70 to-indigo-950/70 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20">
                    <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-blue-400"></i>
                    <span>Super Admin</span>
                </a>
                <button onclick="window.__ARK_SALES_OPEN && window.__ARK_SALES_OPEN()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                    Iniciar Diagnóstico
                </button>
            </div>
        </div>
    </nav>

    <main class="flex-grow max-w-6xl mx-auto px-4 py-16 w-full">
        <div class="text-center max-w-4xl mx-auto mb-16">
            <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-medium mb-6">
                <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> 🇲🇽 Infraestructura Operativa de Cobranza & Blindaje Fiscal en México
            </div>
            <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Recupera tu flujo a gran escala<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-amber-400">con Inteligencia Artificial y Certeza Jurídica en México.</span>
            </h1>
            <p class="text-lg text-slate-300 mb-6 leading-relaxed max-w-3xl mx-auto">
                La plataforma institucional que une <strong>Ark Angel</strong> (cobranza masiva multicanal por Voz y WhatsApp con Motor Legal CONDUSEF/REDECO y conciliación SPEI en vivo) con <strong>Ark Ledger</strong> (suite pericial de 19 herramientas fiscales ancladas al DOF con sellado criptográfico inmutable SHA-256).
            </p>

            <!-- 3D VORTEX PORTAL CTA (Spline 3D + Interactive Physics Vortex) -->
            <div class="relative max-w-xl mx-auto my-10 group">
                <div class="relative rounded-3xl p-[2px] bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-[0_0_50px_rgba(37,99,235,0.3)] group-hover:shadow-[0_0_80px_rgba(56,189,248,0.6)] transition-all duration-500">
                    <div class="relative bg-slate-950/95 rounded-[22px] p-6 text-center backdrop-blur-2xl overflow-hidden border border-slate-800/80">
                        <canvas id="vortexCanvasLanding" class="absolute inset-0 w-full h-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"></canvas>
                        
                        <div class="relative z-10 flex flex-col items-center">
                            <div class="w-24 h-24 relative flex items-center justify-center mb-1">
                                <spline-viewer url="https://prod.spline.design/IaZypc0K4Rnb07vW/scene.splinecode" class="w-32 h-32 pointer-events-none scale-110" loading-anim-type="none"></spline-viewer>
                            </div>
                            
                            <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 border border-cyan-400/30 text-cyan-300 font-mono text-[10px] uppercase tracking-widest mb-2">
                                <i data-lucide="orbit" class="w-3 h-3 text-cyan-400 animate-spin"></i> Vórtice 3D · Puesto de Mando Soberano
                            </div>
                            
                            <h3 class="text-xl font-extrabold text-white tracking-tight mb-1">
                                Consola Super Admin & Pipeline de Ventas
                            </h3>
                            <p class="text-xs text-slate-400 mb-5 max-w-sm mx-auto">
                                Control multitenant soberano de Resend (plantillas HTML), Campañas de Voz AI Telnyx y sincronización federada.
                            </p>

                            <div class="flex flex-wrap items-center justify-center gap-3 w-full">
                                <a href="/superadmin" class="flex-1 min-w-[180px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2">
                                    <i data-lucide="shield-alert" class="w-4 h-4"></i>
                                    <span>Entrar a Super Admin</span>
                                </a>
                                <a href="/crm" class="flex-1 min-w-[160px] bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2">
                                    <i data-lucide="layout-dashboard" class="w-4 h-4 text-amber-400"></i>
                                    <span>Acceso al CRM</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <section id="funciones" class="mb-20">
            <h2 class="text-2xl font-bold text-white mb-2 text-center">Capacidades de la Infraestructura Operativa</h2>
            <p class="text-xs font-mono text-slate-400 text-center uppercase tracking-wider mb-10">Misión Crítica · Cero Cajas Negras · Cumplimiento Regulatorio Mexicano</p>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="phone-call" class="w-6 h-6 text-blue-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Cobranza con Voz IA en Tiempo Real</h3>
                    <p class="text-xs text-slate-400">Llamadas fluidas de alta fidelidad ($0.25 USD/min con Deepgram Nova-3 y Aura-2) con negociación automática de promesas y registro de CLABE.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="shield-alert" class="w-6 h-6 text-emerald-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Motor Legal Fail-Closed (12 Reglas)</h3>
                    <p class="text-xs text-slate-400">Bloqueo automático en milisegundos (HTTP 422) a cualquier mensaje con amenazas, cobranza a terceros o fuera de la ventana horaria NOM-184. Tu REDECO protegido.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="zap" class="w-6 h-6 text-amber-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Conciliación SPEI en Vivo (Conekta & Cobre)</h3>
                    <p class="text-xs text-slate-400">Webhooks automáticos con Conekta (SPEI / OXXO Pay PyME) y Cobre (SPEI corporativo). Al confirmarse el pago, la cola de llamadas se cancela al segundo.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="user-check" class="w-6 h-6 text-purple-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Copilot IA & Softphone para Operadores</h3>
                    <p class="text-xs text-slate-400">Diagnóstico ejecutivo del deudor en 1 pantalla (estilo Payments by Wix), guion CONDUSEF obligatorio y redacción asistida con saldo y CLABE de 18 dígitos.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="file-check-2" class="w-6 h-6 text-rose-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Suite Fiscal de 19 Herramientas (Ark Ledger)</h3>
                    <p class="text-xs text-slate-400">Conciliación Anexo 24, timbrado masivo CFDI 4.0, actualización y recargos CFF 17-A/21, monitor antilavado LFPIORPI y RESICO 2026.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="fingerprint" class="w-6 h-6 text-blue-500 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Papel de Trabajo SHA-256 + QR Verificable</h3>
                    <p class="text-xs text-slate-400">Cada cálculo y póliza queda sellada criptográficamente con hash inmutable y QR público verificable en /verify sin login para auditores del SAT.</p>
                </div>
            </div>
        </section>

        <div id="bundle" class="max-w-4xl mx-auto">
            <div class="glass-panel rounded-2xl p-1 glow-amber relative overflow-hidden">
                <div class="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
                <div class="bg-slate-950/80 rounded-xl p-8 md:p-10 relative">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <span class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono uppercase font-bold tracking-wider">Propuesta Oficial Octubre 2026</span>
                            <h2 class="text-2xl font-bold text-white mt-2 mb-1">Paquete Enterprise — El Bundle Total ARK</h2>
                            <p class="text-slate-400 text-sm max-w-md">Cobranza IA por uso real (Voz $0.25/min, WA $0.20/msg) + Cierre Fiscal Ark Ledger con sello SHA-256.</p>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold text-amber-500 font-mono">Uso Real + Add-on</div>
                            <div class="text-xs text-slate-400 mt-1">Mínimo sugerido: <strong>$8,000 – $12,000 MXN/mes</strong></div>
                        </div>
                    </div>
                    <div class="flex flex-col sm:flex-row gap-4">
                        <button onclick="window.__ARK_SALES_OPEN && window.__ARK_SALES_OPEN()" class="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 group">
                            Solicitar Diagnóstico Gratuito
                            <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                        </button>
                        <a href="/api/catalog" target="_blank" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 px-6 rounded-lg transition-all border border-slate-700 text-center flex items-center justify-center">
                            Ver Catálogo Oficial (D1)
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer class="border-t border-slate-800 bg-slate-950 py-8 mt-12">
        <div class="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>© 2026 Ark Systems. Infraestructura de la economía agéntica.</p>
            <div class="flex items-center gap-4">
                <a href="/crm" class="text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 text-xs">
                    <i data-lucide="layout-dashboard" class="w-3.5 h-3.5 text-amber-400"></i>
                    CRM
                </a>
                <a href="/superadmin" class="text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 text-xs">
                    <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-blue-400"></i>
                    Super Admin
                </a>
                <div class="flex gap-4 font-mono">
                <span>v1.0.4-stable</span>
                <span class="text-emerald-600">● All systems operational</span>
            </div>
        </div>
    </footer>

    <script src="/widget.js" defer></script>
    <script>
        lucide.createIcons();
        window.__ARK_SALES_OPEN = function() {
            const modal = document.querySelector(".ark-modal");
            if (modal) modal.classList.add("open");
        };

        // 3D Vortex Canvas Animation
        (function initVortexLanding() {
            const canvas = document.getElementById('vortexCanvasLanding');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            let width = 0, height = 0, cx = 0, cy = 0;
            let time = 0;
            let speed = 0.02;
            const particles = [];
            for (let i = 0; i < 70; i++) {
                particles.push({
                    angle: Math.random() * Math.PI * 2,
                    dist: Math.random() * 120 + 20,
                    size: Math.random() * 1.8 + 0.8,
                    speed: Math.random() * 0.02 + 0.008,
                    color: i % 3 === 0 ? '#38bdf8' : (i % 3 === 1 ? '#6366f1' : '#10b981')
                });
            }

            function resize() {
                if (!canvas) return;
                width = canvas.width = canvas.offsetWidth;
                height = canvas.height = canvas.offsetHeight;
                cx = width / 2;
                cy = height / 2;
            }
            resize();
            window.addEventListener('resize', resize);

            const card = canvas.closest('.group');
            if (card) {
                card.addEventListener('mouseenter', () => speed = 0.05);
                card.addEventListener('mouseleave', () => speed = 0.02);
            }

            function render() {
                ctx.clearRect(0, 0, width, height);
                time += speed;

                ctx.save();
                ctx.translate(cx, cy);

                for (let arm = 0; arm < 3; arm++) {
                    ctx.beginPath();
                    ctx.strokeStyle = arm === 0 ? 'rgba(56, 189, 248, 0.28)' : (arm === 1 ? 'rgba(99, 102, 241, 0.24)' : 'rgba(16, 185, 129, 0.2)');
                    ctx.lineWidth = 1.4;
                    for (let r = 8; r < 140; r += 4) {
                        const theta = arm * (Math.PI * 2 / 3) + (r * 0.035) - time * 2;
                        const x = Math.cos(theta) * r;
                        const y = Math.sin(theta) * r * 0.52;
                        if (r === 8) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }

                const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 75);
                grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
                grad.addColorStop(0.4, 'rgba(99, 102, 241, 0.15)');
                grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, 75, 0, Math.PI * 2);
                ctx.fill();

                for (const p of particles) {
                    p.angle += p.speed;
                    p.dist -= 0.18;
                    if (p.dist < 8) p.dist = 135;

                    const px = Math.cos(p.angle) * p.dist;
                    const py = Math.sin(p.angle) * p.dist * 0.52;

                    ctx.fillStyle = p.color;
                    ctx.globalAlpha = Math.min(1, p.dist / 70);
                    ctx.beginPath();
                    ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
                requestAnimationFrame(render);
            }
            render();
        })();
    </script>
</body>
</html>`;
}

export function renderLandingPageHtml(): string { return renderPublicLandingHtml(); }
export function renderFeaturesHtml(): string { return renderPublicLandingHtml(); }
export function renderFunctionsHtml(): string { return renderPublicLandingHtml(); }
export function renderPublicLandingPageHtml(): string { return renderPublicLandingHtml(); }
export function renderLandingHtml(): string { return renderPublicLandingHtml(); }
