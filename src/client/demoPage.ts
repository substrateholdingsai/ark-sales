function resolveRequestUrl(input: unknown): string {
  if (!input) return "https://tu-dominio.com";
  if (typeof input === "string") return input;
  if (input instanceof Request) return input.url;
  if (typeof input === "object") {
    const obj = input as { req?: { url?: unknown }; url?: unknown };
    if (obj.req && typeof obj.req.url === "string") return obj.req.url;
    if (typeof obj.url === "string") return obj.url;
  }
  return "https://tu-dominio.com";
}

function resolveOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "https://tu-dominio.com";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderLandingHtml(requestOrUrl?: unknown): string {
  const resolvedUrl = resolveRequestUrl(requestOrUrl);
  const origin = resolveOrigin(resolvedUrl);
  const canonicalUrl = escapeHtml(resolvedUrl);
  const ogImageUrl = escapeHtml(`${origin}/og-image.png`);
  const metaDescription = "Diagnóstico agéntico para despachos contables en México: riesgos SAT, cobranza y comercio digital. Bundle Total ARK por $997 MXN/mes.";
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ARK Sales & Pulse Engine",
    "applicationCategory": "BusinessApplication / AccountingSoftware",
    "operatingSystem": "All",
    "description": "Motor agéntico e infraestructura operativa para despachos contables en México: contabilidad, cobranza y comercio digital.",
    "offers": {
      "@type": "Offer",
      "price": "997",
      "priceCurrency": "MXN",
      "billingCycle": "Monthly",
      "availability": "https://schema.org/InStock"
    },
    "provider": {
      "@type": "Organization",
      "name": "ARK Ecosystem"
    }
  });
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARK Sales | Infraestructura de IA para Despachos Contables en México</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:title" content="ARK Sales | Infraestructura de IA para Despachos Contables en México">
    <meta property="og:description" content="${escapeHtml(metaDescription)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="ARK Ecosystem">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${ogImageUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="ARK Sales | Infraestructura de IA para Despachos Contables en México">
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
    <meta name="twitter:image" content="${ogImageUrl}">
    <script type="application/ld+json">${jsonLd}</script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #020617; color: #f8fafc; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
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

    <!-- Navbar con Estado de Workers AI -->
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
                <a href="#bundle" class="text-slate-300 hover:text-white transition-colors">Soluciones</a>
                <button onclick="window.__ARK_SALES_OPEN && window.__ARK_SALES_OPEN()" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                    Iniciar Diagnóstico
                </button>
            </div>
        </div>
    </nav>

    <main class="flex-grow max-w-6xl mx-auto px-4 py-16 w-full">
        <!-- Hero Section -->
        <div class="text-center max-w-3xl mx-auto mb-20">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/50 border border-blue-800 text-blue-400 text-xs font-medium mb-6">
                <i data-lucide="cpu" class="w-3 h-3"></i> Motor de Adquisición Agéntico v1.0
            </div>
            <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                No vendemos software.<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Vendemos infraestructura operativa.</span>
            </h1>
            <p class="text-lg text-slate-400 mb-8 leading-relaxed">
                El primer sistema que escucha el dolor de tu despacho contable, diagnostica riesgos fiscales (SAT) o de flujo, y despliega la solución autónoma en segundos.
            </p>
            <p class="text-sm text-slate-500 mb-8">Funciones del Proyecto: enrutamiento agéntico, catálogo fail-closed, widget embebible, memoria persistente, cola y outbox, integración Grok Bot.</p>
            
            <!-- Agentic Routing Visualizer -->
            <div class="glass-panel rounded-xl p-6 max-w-2xl mx-auto text-left">
                <p class="text-xs font-mono text-slate-500 mb-4 uppercase tracking-wider">Enrutamiento por Dolor en Tiempo Real</p>
                <div class="space-y-3">
                    <div class="flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-800/40 p-1.5 rounded transition" onclick="triggerChatWithPain('Auditorías y errores en cálculos del SAT')">
                        <i data-lucide="message-square" class="w-4 h-4 text-slate-400"></i>
                        <span class="text-slate-300">"Tengo multas del SAT y no entiendo el CFDI 4.0"</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-600 mx-2"></i>
                        <span class="px-2 py-0.5 rounded bg-rose-950/50 text-rose-400 border border-rose-900 text-xs font-mono">Agente: Riesgo</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-800/40 p-1.5 rounded transition" onclick="triggerChatWithPain('Clientes que no pagan honorarios a tiempo')">
                        <i data-lucide="message-square" class="w-4 h-4 text-slate-400"></i>
                        <span class="text-slate-300">"Mis clientes no pagan y necesito una tienda"</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-600 mx-2"></i>
                        <span class="px-2 py-0.5 rounded bg-blue-950/50 text-blue-400 border border-blue-900 text-xs font-mono">Agente: Flujo</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm cursor-pointer hover:bg-slate-800/40 p-1.5 rounded transition" onclick="triggerChatWithPain('Todo el despacho está en caos y descontrol')">
                        <i data-lucide="message-square" class="w-4 h-4 text-slate-400"></i>
                        <span class="text-slate-300">"Todo es un caos, necesito control total"</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-600 mx-2"></i>
                        <span class="px-2 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-900 text-xs font-mono">Agente: Closer (Bundle)</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- The Bundle (Focal Point) -->
        <div id="bundle" class="max-w-4xl mx-auto">
            <div class="glass-panel rounded-2xl p-1 glow-amber relative overflow-hidden">
                <div class="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
                
                <div class="bg-slate-950/80 rounded-xl p-8 md:p-10 relative">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <h2 class="text-2xl font-bold text-white mb-2">El Bundle Total ARK</h2>
                            <p class="text-slate-400 text-sm max-w-md">La regla, no la excepción. Infraestructura completa para despachos que exigen soberanía operativa.</p>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold text-amber-500 font-mono">$997 <span class="text-sm text-slate-500 font-sans font-normal">MXN/mes</span></div>
                            <div class="text-xs text-slate-500 mt-1">Facturación mensual, cancelación en cualquier momento.</div>
                        </div>
                    </div>

                    <div class="grid md:grid-cols-3 gap-6 mb-8">
                        <!-- Ledger -->
                        <div class="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                            <div class="flex items-center gap-2 mb-3">
                                <i data-lucide="shield-check" class="w-5 h-5 text-blue-500"></i>
                                <h3 class="font-semibold text-sm">Ark Ledger</h3>
                            </div>
                            <p class="text-xs text-slate-400">Fiscal, SAT y Sello SHA-256. Cumplimiento normativo automatizado.</p>
                        </div>
                        <!-- Angel -->
                        <div class="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                            <div class="flex items-center gap-2 mb-3">
                                <i data-lucide="zap" class="w-5 h-5 text-emerald-500"></i>
                                <h3 class="font-semibold text-sm">Ark Angel</h3>
                            </div>
                            <p class="text-xs text-slate-400">Cobranza inteligente con IA. Legal Fail-Closed y recuperación de flujo.</p>
                        </div>
                        <!-- Commerce -->
                        <div class="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                            <div class="flex items-center gap-2 mb-3">
                                <i data-lucide="shopping-cart" class="w-5 h-5 text-purple-500"></i>
                                <h3 class="font-semibold text-sm">Ark Commerce</h3>
                            </div>
                            <p class="text-xs text-slate-400">Tienda Digital Edge y Checkout por WhatsApp para tus clientes.</p>
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

    <!-- Footer -->
    <footer class="border-t border-slate-800 bg-slate-950 py-8 mt-12">
        <div class="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <p>© 2026 Ark Systems. Infraestructura de la economía agéntica.</p>
            <div class="flex gap-4 font-mono">
                <span>v1.0.4-stable</span>
                <span class="text-emerald-600">● All systems operational</span>
            </div>
        </div>
    </footer>

    <!-- Script universal del Chat Widget -->
    <script src="/widget.js" defer></script>
    <script>
        lucide.createIcons();
        window.__ARK_SALES_OPEN = function() {
            const modal = document.querySelector(".ark-modal");
            if (modal) modal.classList.add("open");
        };
        function triggerChatWithPain(painText) {
            window.__ARK_SALES_OPEN();
            const input = document.querySelector("#ark-input");
            const sendBtn = document.querySelector("#ark-send-btn");
            if (input && sendBtn) {
                input.value = painText;
                sendBtn.click();
            }
        }
    </script>
</body>
</html>`;
}

export { renderPublicLandingHtml, renderLandingPageHtml, renderFeaturesHtml, renderFunctionsHtml, renderPublicLandingPageHtml } from "./landingPage";
