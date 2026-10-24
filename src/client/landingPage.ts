export function renderPublicLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARK Sales · Funciones del Proyecto · Infraestructura Agéntica</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
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
                <button onclick="window.__ARK_SALES_OPEN && window.__ARK_SALES_OPEN()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                    Iniciar Diagnóstico
                </button>
            </div>
        </div>
    </nav>

    <main class="flex-grow max-w-6xl mx-auto px-4 py-16 w-full">
        <div class="text-center max-w-3xl mx-auto mb-20">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/50 border border-blue-800 text-blue-400 text-xs font-medium mb-6">
                <i data-lucide="cpu" class="w-3 h-3"></i> Funciones del Proyecto · v1.0
            </div>
            <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Funciones y características del proyecto<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">ARK Sales · Motor Agéntico</span>
            </h1>
            <p class="text-lg text-slate-400 mb-8 leading-relaxed">
                Esta landing page pública explica las funciones, features y capacidades del proyecto: enrutamiento agéntico por dolor, catálogo fail-closed, memoria persistente, cola asíncrona, integración con Grok Bot y más.
            </p>
        </div>

        <section id="funciones" class="mb-20">
            <h2 class="text-2xl font-bold text-white mb-8 text-center">Funciones del Proyecto</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="route" class="w-6 h-6 text-amber-500 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Enrutamiento por Dolor</h3>
                    <p class="text-xs text-slate-400">Clasifica el dolor del despacho y deriva automáticamente al especialista correcto: Riesgo, Flujo o Arquitecto del Bundle.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="database" class="w-6 h-6 text-rose-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Catálogo Fail-Closed (Cero Hardcoding)</h3>
                    <p class="text-xs text-slate-400">Precios y features se leen dinámicamente desde D1. Si falla, responde el mensaje oficial sin inventar datos.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="message-square" class="w-6 h-6 text-blue-500 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Chat Widget Embebible</h3>
                    <p class="text-xs text-slate-400">Script universal sin dependencias que inyecta el chat agéntico en cualquier landing externa.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="memory-stick" class="w-6 h-6 text-emerald-500 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Memoria Persistente por Lead</h3>
                    <p class="text-xs text-slate-400">Durable Objects mantienen el historial de conversación y el estado de cada prospecto.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="send" class="w-6 h-6 text-purple-500 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Cola Asíncrona y Outbox Pattern</h3>
                    <p class="text-xs text-slate-400">Entrega federada de leads hacia los hermanos del ecosistema con reintentos automáticos cada 15 min.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="bot" class="w-6 h-6 text-blue-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Integración con Grok Bot</h3>
                    <p class="text-xs text-slate-400">Operador autónomo de computadora que investiga prospectos y ejecuta habilidades registradas en D1.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="file-signature" class="w-6 h-6 text-amber-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Contrato Federado LEAD_INGEST_V3</h3>
                    <p class="text-xs text-slate-400">Payload tipado con versionado, score, contexto de cuenta y resumen de conversación.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="shield-check" class="w-6 h-6 text-rose-500 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Sellado SHA-256 Inmutable</h3>
                    <p class="text-xs text-slate-400">Ark Ledger garantiza auditoría fail-closed para pólizas y reportes fiscales.</p>
                </div>
                <div class="glass-panel rounded-xl p-6">
                    <i data-lucide="shopping-cart" class="w-6 h-6 text-purple-400 mb-3"></i>
                    <h3 class="font-semibold text-sm mb-2">Tienda Digital y Checkout WhatsApp</h3>
                    <p class="text-xs text-slate-400">Ark Commerce habilita cobros en línea y pasarelas automáticas para el despacho.</p>
                </div>
            </div>
        </section>

        <div id="bundle" class="max-w-4xl mx-auto">
            <div class="glass-panel rounded-2xl p-1 glow-amber relative overflow-hidden">
                <div class="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
                <div class="bg-slate-950/80 rounded-xl p-8 md:p-10 relative">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-2">El Bundle Total ARK</h2>
                            <p class="text-slate-400 text-sm max-w-md">Infraestructura completa: Ledger + Angel + Commerce por un solo precio.</p>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold text-amber-500 font-mono">$997 <span class="text-sm text-slate-500 font-sans font-normal">MXN/mes</span></div>
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
    </script>
</body>
</html>`;
}

export function renderLandingPageHtml(): string { return renderPublicLandingHtml(); }
export function renderFeaturesHtml(): string { return renderPublicLandingHtml(); }
export function renderFunctionsHtml(): string { return renderPublicLandingHtml(); }
export function renderPublicLandingPageHtml(): string { return renderPublicLandingHtml(); }
export function renderLandingHtml(): string { return renderPublicLandingHtml(); }
