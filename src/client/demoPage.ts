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
  const metaDescription = "Infraestructura agéntica de cobranza multicanal y blindaje fiscal en México: Ark Angel (Voz IA $0.25 USD/min, WhatsApp $0.20 USD bajo normas CONDUSEF/REDECO con SPEI en vivo) y Ark Ledger (19 herramientas DOF: Anexo 24, CFDI 4.0 y sellado SHA-256).";
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
    <title>ARK Sales | Infraestructura de Cobranza con IA y Cierre Fiscal en México</title>
    <meta name="description" content="${escapeHtml(metaDescription)}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:title" content="ARK Sales | Infraestructura de Cobranza con IA y Cierre Fiscal en México">
    <meta property="og:description" content="${escapeHtml(metaDescription)}">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="ARK Ecosystem">
    <meta property="og:type" content="website">
    <meta property="og:image" content="${ogImageUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="ARK Sales | Infraestructura de Cobranza con IA y Cierre Fiscal en México">
    <meta name="twitter:description" content="${escapeHtml(metaDescription)}">
    <meta name="twitter:image" content="${ogImageUrl}">
    <script type="application/ld+json">${jsonLd}</script>
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
        <!-- Hero Section -->
        <div class="text-center max-w-4xl mx-auto mb-16">
            <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-medium mb-6">
                <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> 🇲🇽 Cumplimiento CONDUSEF · REDECO · NOM-184 · Conciliación SPEI en Tiempo Real
            </div>
            <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
                Recupera tu cartera vencida a escala<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-amber-400">sin violar la ley mexicana ni quemar a tus clientes.</span>
            </h1>
            <p class="text-lg text-slate-300 mb-6 leading-relaxed max-w-3xl mx-auto">
                La plataforma agéntica que acelera tu cobranza con Inteligencia Artificial (Voz $0.25 USD/min, WhatsApp $0.20 USD), concilia pagos SPEI en vivo (Conekta/Cobre) y blinda cada cierre contable con las 19 herramientas de Ark Ledger (Anexo 24, CFDI 4.0 y sellado inmutable SHA-256).
            </p>
            <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 mb-8">
                <span class="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1.5"><i data-lucide="check" class="w-3 h-3 text-emerald-400"></i> 12 Reglas Fail-Closed (Anti-quejas REDECO)</span>
                <span class="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1.5"><i data-lucide="zap" class="w-3 h-3 text-blue-400"></i> Conciliación SPEI / OXXO al instante</span>
                <span class="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1.5"><i data-lucide="award" class="w-3 h-3 text-amber-400"></i> Papel de Trabajo SHA-256 + QR Verificable</span>
            </div>

            <!-- 3D VORTEX PORTAL CTA (Spline 3D + Interactive Physics Vortex) -->
            <div class="relative max-w-xl mx-auto mb-12 group">
                <div class="relative rounded-3xl p-[2px] bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-[0_0_50px_rgba(37,99,235,0.3)] group-hover:shadow-[0_0_80px_rgba(56,189,248,0.6)] transition-all duration-500">
                    <div class="relative bg-slate-950/95 rounded-[22px] p-6 text-center backdrop-blur-2xl overflow-hidden border border-slate-800/80">
                        <!-- 3D Canvas Vortex Background -->
                        <canvas id="vortexCanvas" class="absolute inset-0 w-full h-full pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"></canvas>
                        
                        <div class="relative z-10 flex flex-col items-center">
                            <!-- Spline 3D Scene Viewer -->
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
            
            <!-- Agentic Routing Visualizer (4 Mexican Target Industries) -->
            <div class="glass-panel rounded-xl p-6 max-w-3xl mx-auto text-left">
                <div class="flex items-center justify-between mb-4">
                    <p class="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">Enrutamiento por Dolor en Tiempo Real · Selecciona tu Operación</p>
                    <span class="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">Llama 3.3 70B · Listo</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition" onclick="triggerChatWithPain('Cobranza masiva para despacho o call center BPO con guion CONDUSEF y softphone')">
                        <div class="p-2 rounded bg-blue-500/10 text-blue-400 mt-0.5"><i data-lucide="building" class="w-4 h-4"></i></div>
                        <div>
                            <div class="text-sm font-semibold text-slate-200">Despachos de Cobranza & BPO</div>
                            <p class="text-xs text-slate-400 mt-0.5">Alto volumen, rotación de cobradores y riesgo de multas en REDECO.</p>
                            <span class="inline-block mt-2 px-2 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-900 text-[10px] font-mono">Solución: Ark Angel BPO</span>
                        </div>
                    </div>
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition" onclick="triggerChatWithPain('Cobranza de rentas, cuotas de mantenimiento y pagarés con monitor antilavado LFPIORPI')">
                        <div class="p-2 rounded bg-emerald-500/10 text-emerald-400 mt-0.5"><i data-lucide="home" class="w-4 h-4"></i></div>
                        <div>
                            <div class="text-sm font-semibold text-slate-200">Bienes Raíces & Inmobiliarias</div>
                            <p class="text-xs text-slate-400 mt-0.5">Rentas morosas, cuotas de mantenimiento y pagarés con Monitor LFPIORPI.</p>
                            <span class="inline-block mt-2 px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-900 text-[10px] font-mono">Solución: Angel Inmuebles</span>
                        </div>
                    </div>
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition" onclick="triggerChatWithPain('Crédito automotriz, mensualidades vencidas y recargos CFF Art. 17-A y 21')">
                        <div class="p-2 rounded bg-amber-500/10 text-amber-400 mt-0.5"><i data-lucide="car" class="w-4 h-4"></i></div>
                        <div>
                            <div class="text-sm font-semibold text-slate-200">Financieras de Autos & Leasing</div>
                            <p class="text-xs text-slate-400 mt-0.5">Mensualidades atrasadas, promesas de pago y actualización CFF 17-A/21.</p>
                            <span class="inline-block mt-2 px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-900 text-[10px] font-mono">Solución: Angel + Recargos CFF</span>
                        </div>
                    </div>
                    <div class="flex items-start gap-3 p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition" onclick="triggerChatWithPain('Honorarios de despacho contable, CFDI 4.0, Anexo 24 y multas SAT')">
                        <div class="p-2 rounded bg-purple-500/10 text-purple-400 mt-0.5"><i data-lucide="briefcase" class="w-4 h-4"></i></div>
                        <div>
                            <div class="text-sm font-semibold text-slate-200">Despachos Contables & SAT</div>
                            <p class="text-xs text-slate-400 mt-0.5">Honorarios impagos, conciliación Anexo 24, timbrado CFDI 4.0 y sellos SHA-256.</p>
                            <span class="inline-block mt-2 px-2 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-900 text-[10px] font-mono">Solución: Paquete Enterprise</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Official Anchors Banner -->
        <div class="max-w-4xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="glass-panel p-4 rounded-xl border border-blue-500/30 text-center">
                <span class="text-xs uppercase font-mono text-blue-400 font-semibold tracking-wider block mb-1">VOZ IA (ANCLA)</span>
                <span class="text-2xl font-bold font-mono text-white">$0.25 <span class="text-xs text-slate-400 font-sans font-normal">USD / min</span></span>
                <p class="text-[11px] text-slate-400 mt-1">Llamada + STT + LLM + TTS + Motor Legal + Grok Bot</p>
            </div>
            <div class="glass-panel p-4 rounded-xl border border-emerald-500/30 text-center">
                <span class="text-xs uppercase font-mono text-emerald-400 font-semibold tracking-wider block mb-1">WHATSAPP (ANCLA)</span>
                <span class="text-2xl font-bold font-mono text-white">$0.20 <span class="text-xs text-slate-400 font-sans font-normal">USD / msg</span></span>
                <p class="text-[11px] text-slate-400 mt-1">Mensaje + Motor Legal fail-closed + Grok Bot</p>
            </div>
            <div class="glass-panel p-4 rounded-xl border border-amber-500/30 text-center">
                <span class="text-xs uppercase font-mono text-amber-400 font-semibold tracking-wider block mb-1">ARK LEDGER (ANCLA)</span>
                <span class="text-2xl font-bold font-mono text-white">Desde $6,000 <span class="text-xs text-slate-400 font-sans font-normal">MXN</span></span>
                <p class="text-[11px] text-slate-400 mt-1">Cálculo CFF, CFDI 4.0, Sello SHA-256 + QR</p>
            </div>
        </div>

        <!-- The Bundle (Focal Point) -->
        <div id="bundle" class="max-w-4xl mx-auto">
            <div class="glass-panel rounded-2xl p-1 glow-amber relative overflow-hidden">
                <div class="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl"></div>
                
                <div class="bg-slate-950/80 rounded-xl p-8 md:p-10 relative">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                        <div>
                            <span class="px-2.5 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono uppercase font-bold tracking-wider">Propuesta Oficial Octubre 2026</span>
                            <h2 class="text-2xl font-bold text-white mt-2 mb-1">Paquete Enterprise — El Bundle Total ARK</h2>
                            <p class="text-slate-400 text-sm max-w-md">Cobranza Multicanal con IA por uso real + Cierre Fiscal y Contable inmutable con sello SHA-256.</p>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold text-amber-500 font-mono">Uso Real + Add-on</div>
                            <div class="text-xs text-slate-400 mt-1">Mínimo sugerido: <strong>$8,000 – $12,000 MXN/mes</strong></div>
                        </div>
                    </div>

                    <div class="grid md:grid-cols-3 gap-6 mb-8">
                        <!-- Starter -->
                        <div class="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="message-circle" class="w-5 h-5 text-emerald-400"></i>
                                <h3 class="font-semibold text-sm">Paquete Starter</h3>
                            </div>
                            <div class="text-xs font-mono text-emerald-400 mb-2">Desde $0.15–0.20 / msg</div>
                            <p class="text-xs text-slate-400">WhatsApp + SMS + Email + Motor Legal. Ideal para despachos chicos e inmobiliarias.</p>
                        </div>
                        <!-- Professional -->
                        <div class="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="phone-call" class="w-5 h-5 text-blue-400"></i>
                                <h3 class="font-semibold text-sm">Paquete Professional</h3>
                            </div>
                            <div class="text-xs font-mono text-blue-400 mb-2">$0.25/min voz + mensajes</div>
                            <p class="text-xs text-slate-400">Todo lo digital + Voz IA en tiempo real. Softphone auditado y Copilot para operadores.</p>
                        </div>
                        <!-- Enterprise -->
                        <div class="p-4 rounded-lg bg-slate-900/50 border border-amber-500/40 bg-amber-950/10">
                            <div class="flex items-center gap-2 mb-2">
                                <i data-lucide="shield-check" class="w-5 h-5 text-amber-400"></i>
                                <h3 class="font-semibold text-sm text-white">Paquete Enterprise</h3>
                            </div>
                            <div class="text-xs font-mono text-amber-400 mb-2">Voz + Msg + $6k–$10k MXN</div>
                            <p class="text-xs text-slate-400">Cobranza IA + Ark Ledger completo. Papel de trabajo SHA-256 + QR y timbrado CFDI 4.0.</p>
                        </div>
                    </div>

                    <!-- Commercial Conditions Notice -->
                    <div class="mb-8 p-4 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                        <div class="font-semibold text-slate-300 flex items-center gap-1.5 mb-1.5">
                            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i> Condiciones Comerciales Rápidas:
                        </div>
                        <p>• <strong>Facturación:</strong> Mensual por uso real (minutos y mensajes consumidos). Sin costo de setup ni licencias de arranque.</p>
                        <p>• <strong>Mínimo recomendado:</strong> $8,000 – $12,000 MXN mensuales para asegurar viabilidad del onboarding.</p>
                        <p>• <strong>Plazo sugerido:</strong> Contratos de 3 o 6 meses recomendados. Grok Bot y Motor Legal fail-closed siempre incluidos sin cargo extra.</p>
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

        // 3D Vortex Canvas Animation
        (function initVortex() {
            const canvas = document.getElementById('vortexCanvas');
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

                // 3D Spiral Arms
                for (let arm = 0; arm < 3; arm++) {
                    ctx.beginPath();
                    ctx.strokeStyle = arm === 0 ? 'rgba(56, 189, 248, 0.28)' : (arm === 1 ? 'rgba(99, 102, 241, 0.24)' : 'rgba(16, 185, 129, 0.2)');
                    ctx.lineWidth = 1.4;
                    for (let r = 8; r < 140; r += 4) {
                        const theta = arm * (Math.PI * 2 / 3) + (r * 0.035) - time * 2;
                        const x = Math.cos(theta) * r;
                        const y = Math.sin(theta) * r * 0.52; // 3D Tilt perspective
                        if (r === 8) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }

                // Core Vortex Glow
                const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 75);
                grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
                grad.addColorStop(0.4, 'rgba(99, 102, 241, 0.15)');
                grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, 75, 0, Math.PI * 2);
                ctx.fill();

                // Swirling Particles
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

export { renderPublicLandingHtml, renderLandingPageHtml, renderFeaturesHtml, renderFunctionsHtml, renderPublicLandingPageHtml } from "./landingPage";
