export function renderPublicLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARK Sales · El CRM pensado para Agentes AI</title>
    <meta name="description" content="Ark Sales: El CRM agéntico y multi-tenant pensado para Agentes AI. 100% autónomo para prospectar, llamar con voz, enviar propuestas y cobrar vía SPEI; cómodo, visual y fácil de usar para humanos.">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #020617; color: #f8fafc; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(51, 65, 85, 0.45);
        }
        .glass-card {
            background: rgba(30, 41, 59, 0.35);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(71, 85, 105, 0.3);
        }
        .glow-blue { box-shadow: 0 0 35px rgba(59, 130, 246, 0.2); }
        .glow-emerald { box-shadow: 0 0 35px rgba(16, 185, 129, 0.2); }
        .grid-bg {
            background-image: linear-gradient(rgba(51, 65, 85, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(51, 65, 85, 0.12) 1px, transparent 1px);
            background-size: 36px 36px;
        }
        @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.6; }
            100% { transform: scale(2.2); opacity: 0; }
        }
        .agent-active::before {
            content: ''; position: absolute; left: 0; top: 0; width: 8px; height: 8px;
            background: #10b981; border-radius: 50%;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
    </style>
</head>
<body class="grid-bg min-h-screen flex flex-col selection:bg-blue-600 selection:text-white">

    <!-- Top Navigation Bar -->
    <nav class="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md sticky top-0 z-40">
        <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <i data-lucide="bot" class="text-white w-5 h-5"></i>
                </div>
                <div>
                    <span class="font-extrabold text-lg tracking-tight">ARK <span class="text-blue-400">SALES</span></span>
                    <span class="text-[9px] uppercase font-mono px-2 py-0.5 ml-2 bg-blue-900/60 text-blue-300 rounded border border-blue-700/50 hidden sm:inline-block">Agentic CRM Core</span>
                </div>
            </div>
            
            <div class="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <div class="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
                    <div class="relative w-2 h-2">
                        <div class="absolute inset-0 bg-emerald-500 rounded-full agent-active"></div>
                        <div class="relative w-2 h-2 bg-emerald-500 rounded-full"></div>
                    </div>
                    <span class="text-slate-400 font-mono text-xs">Llama 3.3 70B · Tool Calling Activo</span>
                </div>
                
                <a href="#pilares" class="text-slate-400 hover:text-white transition-colors hidden sm:inline">Arquitectura</a>
                <a href="#capacidades" class="text-slate-400 hover:text-white transition-colors hidden sm:inline">Capacidades</a>

                <a href="/crm" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white text-xs font-semibold transition-all">
                    <i data-lucide="layout-dashboard" class="w-3.5 h-3.5 text-amber-400"></i>
                    <span>Acceso CRM</span>
                </a>
                
                <a href="/superadmin" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600/50 hover:border-blue-400 bg-gradient-to-r from-blue-950/80 to-indigo-950/80 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20">
                    <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-blue-400"></i>
                    <span>Super Admin</span>
                </a>

                <button onclick="window.__ARK_SALES_OPEN && window.__ARK_SALES_OPEN()" class="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5">
                    <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                    <span>Hablar con Agente</span>
                </button>
            </div>
        </div>
    </nav>

    <!-- Main Hero -->
    <main class="flex-grow max-w-6xl mx-auto px-4 py-12 md:py-16 w-full">
        <div class="text-center max-w-4xl mx-auto mb-14">
            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-300 text-xs font-medium mb-6 backdrop-blur-sm">
                <i data-lucide="sparkles" class="w-3.5 h-3.5 text-blue-400 animate-pulse"></i>
                <span>El CRM pensado para Agentes AI · Multi-Tenant · 100% Autónomo</span>
            </div>
            
            <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-[1.12]">
                El CRM pensado para Agentes AI.<br>
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">Autónomo para la máquina, cómodo y fácil de usar para humanos.</span>
            </h1>
            
            <p class="text-base sm:text-lg text-slate-300 mb-8 leading-relaxed max-w-3xl mx-auto">
                Olvídate de los CRMs pasivos donde tu equipo pierde horas capturando datos. <strong>Ark Sales</strong> es una fábrica comercial autónoma en la que agentes de inteligencia artificial orquestan llamadas telefónicas, despachan propuestas en HTML, emiten cobros bancarios SPEI y cierran ventas para cualquier marca en piloto automático.
            </p>

            <div class="flex flex-wrap items-center justify-center gap-4 text-xs font-mono mb-10">
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
                    <i data-lucide="phone-outgoing" class="w-3.5 h-3.5 text-blue-400"></i> Telefonía VoIP Telnyx
                </div>
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
                    <i data-lucide="mail-check" class="w-3.5 h-3.5 text-indigo-400"></i> Resend HTML Multi-Tenant
                </div>
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
                    <i data-lucide="credit-card" class="w-3.5 h-3.5 text-emerald-400"></i> Conekta SPEI STP (18 dígitos)
                </div>
                <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 text-slate-300">
                    <i data-lucide="cpu" class="w-3.5 h-3.5 text-cyan-400"></i> Llama 3.3 70B + Durable Objects
                </div>
            </div>

            <!-- 3D VORTEX PORTAL CTA (Interactive Physics Vortex) -->
            <div class="relative max-w-xl mx-auto my-8 group">
                <div class="relative rounded-3xl p-[2px] bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-[0_0_50px_rgba(37,99,235,0.3)] group-hover:shadow-[0_0_80px_rgba(56,189,248,0.55)] transition-all duration-500">
                    <div class="relative bg-slate-950/95 rounded-[22px] p-7 text-center backdrop-blur-2xl overflow-hidden border border-slate-800/80">
                        <canvas id="vortexCanvasLanding" class="absolute inset-0 w-full h-full pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity"></canvas>
                        
                        <div class="relative z-10 flex flex-col items-center">
                            <!-- Glowing Agentic Vortex Eye Core -->
                            <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-600/30 to-indigo-500/20 border border-cyan-400/50 flex items-center justify-center mb-4 shadow-[0_0_35px_rgba(56,189,248,0.45)] relative group-hover:scale-110 transition-transform">
                                <i data-lucide="orbit" class="w-8 h-8 text-cyan-300 animate-spin" style="animation-duration: 9s;"></i>
                                <div class="absolute inset-0 rounded-2xl bg-cyan-400/15 blur-md animate-pulse"></div>
                            </div>
                            
                            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-cyan-400/40 text-cyan-300 font-mono text-[11px] uppercase tracking-widest mb-2 shadow-sm">
                                <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                <span>Vórtice 3D · Puesto de Mando Soberano</span>
                            </div>
                            
                            <h3 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2">
                                Consola Super Admin & Pipeline Agéntico
                            </h3>
                            <p class="text-xs sm:text-sm text-slate-300 mb-6 max-w-md mx-auto leading-relaxed">
                                Supervisa el pipeline omni-tenant, configura plantillas de correo, lanza campañas de voz con IA y controla la cobranza bancaria en tiempo real.
                            </p>

                            <div class="flex flex-wrap items-center justify-center gap-3 w-full">
                                <a href="/superadmin" class="flex-1 min-w-[170px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-5 rounded-xl text-xs transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2">
                                    <i data-lucide="shield-alert" class="w-4 h-4"></i>
                                    <span>Entrar a Super Admin</span>
                                </a>
                                <a href="/crm" class="flex-1 min-w-[150px] bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-slate-600 font-semibold py-3 px-5 rounded-xl text-xs transition-all flex items-center justify-center gap-2">
                                    <i data-lucide="layout-dashboard" class="w-4 h-4 text-amber-400"></i>
                                    <span>Abrir Tablero CRM</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- SECCIÓN: LOS 3 PILARES -->
        <section id="pilares" class="mb-20">
            <div class="text-center mb-10">
                <span class="text-xs font-mono text-blue-400 uppercase tracking-widest font-semibold block mb-1">Filosofía de Producto</span>
                <h2 class="text-2xl sm:text-3xl font-extrabold text-white">Diseñado para la Simbiosis Humano-Agente</h2>
                <p class="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto mt-2">Los agentes hacen el trabajo operativo pesado; los humanos toman las decisiones estratégicas con total visibilidad y confort.</p>
            </div>

            <div class="grid md:grid-cols-3 gap-6">
                <!-- Pilar 1 -->
                <div class="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400 group-hover:scale-110 transition-transform">
                        <i data-lucide="bot" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-base font-bold text-white mb-2">1. Pensado para Agentes AI</h3>
                    <p class="text-xs text-slate-300 leading-relaxed">
                        No requiere intervención humana para avanzar leads. Los agentes tienen herramientas ejecutivas reales (Tool Calling) para consultar el catálogo dinámico, llamar por teléfono, enviar contratos y emitir CLABEs de cobro en milisegundos.
                    </p>
                    <div class="mt-4 pt-3 border-t border-slate-800/80 font-mono text-[11px] text-blue-400 flex items-center gap-1.5">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Capacidad de acción real (Tool Calling)
                    </div>
                </div>

                <!-- Pilar 2 -->
                <div class="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 group-hover:scale-110 transition-transform">
                        <i data-lucide="user-check" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-base font-bold text-white mb-2">2. Cómodo y Fácil para Humanos</h3>
                    <p class="text-xs text-slate-300 leading-relaxed">
                        Interfaz visual intuitiva con pipeline Kanban interactivo, historial cronológico de actividades, bandeja de trabajo de tareas pendientes, búsqueda instantánea y acceso seguro soberano sin fricciones.
                    </p>
                    <div class="mt-4 pt-3 border-t border-slate-800/80 font-mono text-[11px] text-emerald-400 flex items-center gap-1.5">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Cero curva de aprendizaje para el equipo
                    </div>
                </div>

                <!-- Pilar 3 -->
                <div class="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-all">
                    <div class="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400 group-hover:scale-110 transition-transform">
                        <i data-lucide="layers" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-base font-bold text-white mb-2">3. Multi-Tenant y Multi-Marca</h3>
                    <p class="text-xs text-slate-300 leading-relaxed">
                        Construido con cero código rígido. Vende cualquier producto o servicio (SaaS, inmobiliario, consultoría, BPO, legal) bajo marcas distintas con plantillas independientes, catálogo configurable y cobros particionados.
                    </p>
                    <div class="mt-4 pt-3 border-t border-slate-800/80 font-mono text-[11px] text-indigo-400 flex items-center gap-1.5">
                        <i data-lucide="check" class="w-3.5 h-3.5"></i> Arquitectura White-Label lista para escalar
                    </div>
                </div>
            </div>
        </section>

        <!-- SECCIÓN: CAPACIDADES TÉCNICAS DEL MOTOR -->
        <section id="capacidades" class="mb-20">
            <div class="text-center mb-10">
                <span class="text-xs font-mono text-cyan-400 uppercase tracking-widest font-semibold block mb-1">Capacidades del Stack</span>
                <h2 class="text-2xl sm:text-3xl font-extrabold text-white">La Caja de Herramientas del Agente</h2>
                <p class="text-slate-400 text-xs sm:text-sm max-w-xl mx-auto mt-2">Todo lo que un vendedor de élite necesita, automatizado a nivel de protocolo.</p>
            </div>

            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Capacidad 1: Voz -->
                <div class="glass-panel rounded-xl p-5 hover:bg-slate-900/50 transition-all">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                            <i data-lucide="phone-call" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm text-white">Voz AI Saliente con Telnyx</h3>
                            <span class="text-[10px] font-mono text-slate-400">PSTN México (+52) & E.164</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Llamadas telefónicas de cortesía y campañas de prospección salientes con voz en español neutro, detección de máquina contestadora y análisis de transcript en vivo.
                    </p>
                </div>

                <!-- Capacidad 2: Correo -->
                <div class="glass-panel rounded-xl p-5 hover:bg-slate-900/50 transition-all">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                            <i data-lucide="mail" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm text-white">Motor de Correo Resend</h3>
                            <span class="text-[10px] font-mono text-slate-400">Plantillas HTML Multi-Tenant</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Despacho formal de propuestas y contratos mediante plantillas prediseñadas con interpolación dinámica de variables (nombre, despacho, inversión, vigencia).
                    </p>
                </div>

                <!-- Capacidad 3: Cobro SPEI Conekta -->
                <div class="glass-panel rounded-xl p-5 hover:bg-slate-900/50 transition-all">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                            <i data-lucide="receipt" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm text-white">Cobranza SPEI STP Conekta</h3>
                            <span class="text-[10px] font-mono text-slate-400">CLABE 18 Dígitos & Checkout</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Emisión instantánea de CLABEs interbancarias STP para transferencias B2B libres de comisiones abusivas. Al confirmarse el pago, la oportunidad pasa a ganado sola.
                    </p>
                </div>

                <!-- Capacidad 4: Llama 3.3 70B & DO -->
                <div class="glass-panel rounded-xl p-5 hover:bg-slate-900/50 transition-all">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                            <i data-lucide="brain-circuit" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm text-white">Llama 3.3 70B & Durable Objects</h3>
                            <span class="text-[10px] font-mono text-slate-400">Memoria Conversacional V8</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Cada lead tiene un Durable Object persistente que retiene el contexto del diálogo, historial de llamadas y objeciones superadas a través de cualquier canal.
                    </p>
                </div>

                <!-- Capacidad 5: Soberanía de Datos -->
                <div class="glass-panel rounded-xl p-5 hover:bg-slate-900/50 transition-all">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                            <i data-lucide="shield-check" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm text-white">Autenticación Soberana</h3>
                            <span class="text-[10px] font-mono text-slate-400">PBKDF2-SHA256 & JWT HS256</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Cero dependencias de SaaS de login externos. Control de acceso por roles (admin/vendedor) y bitácora de auditoría inmutable en Cloudflare D1.
                    </p>
                </div>

                <!-- Capacidad 6: Entrega Federada -->
                <div class="glass-panel rounded-xl p-5 hover:bg-slate-900/50 transition-all">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                            <i data-lucide="network" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm text-white">Entrega Federada (LEAD_INGEST_V3)</h3>
                            <span class="text-[10px] font-mono text-slate-400">Colas & Outbox Pattern</span>
                        </div>
                    </div>
                    <p class="text-xs text-slate-400 leading-relaxed">
                        Sincronización tolerante a fallos hacia sistemas de aprovisionamiento, ERPs o clientes hermanos. Si el destino está caído, el Outbox reintenta automáticamente.
                    </p>
                </div>
            </div>
        </section>

        <!-- CTA INTERACTIVO: HABLAR CON EL AGENTE -->
        <section class="max-w-4xl mx-auto mb-16">
            <div class="glass-panel rounded-3xl p-8 md:p-12 text-center relative overflow-hidden border border-blue-500/30 glow-blue">
                <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/30">
                    <i data-lucide="bot" class="w-8 h-8 text-white"></i>
                </div>
                <h2 class="text-3xl font-extrabold text-white mb-3">Experimenta el CRM Agéntico en Vivo</h2>
                <p class="text-slate-300 text-sm max-w-lg mx-auto mb-8">
                    Chatea en este momento con nuestro orquestador agéntico. Observa cómo diagnostica necesidades comerciales, consulta el catálogo y prepara tu orden de cierre.
                </p>
                <div class="flex flex-wrap items-center justify-center gap-4">
                    <button onclick="window.__ARK_SALES_OPEN && window.__ARK_SALES_OPEN()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2">
                        <i data-lucide="message-square" class="w-4 h-4"></i> Iniciar Conversación Ahora
                    </button>
                    <a href="/crm" class="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold py-3 px-6 rounded-xl text-sm transition-all flex items-center gap-2">
                        <i data-lucide="layout-dashboard" class="w-4 h-4 text-amber-400"></i> Ver Interfaz CRM
                    </a>
                </div>
            </div>
        </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-800 bg-slate-950 py-8 mt-auto">
        <div class="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500">
            <div class="flex items-center gap-2">
                <span class="font-bold text-slate-300">ARK Sales</span> · El CRM pensado para Agentes AI
            </div>
            <div class="flex items-center gap-6">
                <a href="/crm" class="text-slate-400 hover:text-white transition-colors">Tablero CRM</a>
                <a href="/superadmin" class="text-slate-400 hover:text-white transition-colors">Super Admin</a>
                <a href="/api/catalog" target="_blank" class="text-slate-400 hover:text-white transition-colors font-mono">Catálogo D1</a>
            </div>
            <div class="flex items-center gap-2 font-mono text-[11px]">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span class="text-slate-400">v2.1.0-agentic · Multi-Tenant</span>
            </div>
        </div>
    </footer>

    <!-- Widget Script Injection -->
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
