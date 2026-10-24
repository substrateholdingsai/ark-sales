# 🎨 ARK PULSE · Design System Canon (v1.0) — Ark Sales

> **Canon Oficial de Diseño Visual para Ark Sales y el Motor de Adquisición Agéntica**  
> *"No vendemos software. Vendemos infraestructura operativa para el despacho contable mexicano."*

---

## 1. Fundamentos & Filosofía Visual

* **Concepto:** **Precisión Criptográfica y Soberanía Operativa.** Una interfaz oscura, modular y de alta densidad de información que proyecta autoridad técnica frente a contadores, auditores y directores de despacho.
* **Tono:** Profesional, técnico, sobrio y agéntico en tiempo real.
* **El Foco Ámbar (The Golden Bundle):** El color **Ámbar (`#f59e0b`)** representa el núcleo comercial y la solución integral. Se reserva para el **Bundle Total ($997 MXN/mes)**, llamadas a la acción primarias (CTA) y el agente Closer.
* **Señalización por Dolor:** Cada vertical tiene un color semántico asignado para reflejar de forma inequívoca el enrutamiento agéntico.

---

## 2. Paleta de Color Oficial

### 🌌 Base Slate (Estructura Dark Profunda)
| Token | Hex | Tailwind | Uso Principal |
| :--- | :--- | :--- | :--- |
| `slate-950` | `#020617` | `bg-slate-950` | Fondo general de la aplicación (`body`, base de paneles) |
| `slate-900` | `#0f172a` | `bg-slate-900` | Fondos de tarjetas, inputs, barras de estado |
| `slate-800` | `#1e293b` | `border-slate-800` | Bordes primarios, líneas divisorias, retícula |
| `slate-700` | `#334155` | `border-slate-700` | Bordes en hover, botones secundarios |
| `slate-400` | `#94a3b8` | `text-slate-400` | Texto secundario, descripciones y subtítulos |
| `slate-100` | `#f1f5f9` | `text-slate-100` | Texto de lectura principal y titulares |

### ⚡ Acentos Agénticos y Enrutamiento por Dolor
| Especialista / Solución | Color Token | Hex | Badge / Borde | Significado |
| :--- | :--- | :--- | :--- | :--- |
| **Arquitecto del Bundle (Closer)** | `amber-500` | `#f59e0b` | `bg-amber-950/50 text-amber-400 border-amber-900` | **El Bundle Total ($997 MXN/mes)**, cierre integral, máximo valor |
| **Especialista en Riesgo (Fiscal)**| `rose-400` | `#f43f5e` | `bg-rose-950/50 text-rose-400 border-rose-900` | **Ark Ledger**, auditorías SAT, multas, sellado SHA-256 |
| **Especialista en Flujo (Cobranza)**| `blue-500` | `#3b82f6` | `bg-blue-950/50 text-blue-400 border-blue-900` | **Ark Angel**, liquidez, cobranza automatizada por WhatsApp |
| **Tienda Digital (Ecommerce)** | `purple-500`| `#a855f7` | `bg-purple-950/50 text-purple-400 border-purple-900`| **Ark Commerce**, catálogo digital, pasarelas de pago |
| **Estado Agéntico Activo** | `emerald-500`| `#10b981` | `bg-emerald-500 text-emerald-400` | Indicador de conexión en tiempo real del LLM (Llama 3.3) |

---

## 3. Tipografía Oficial

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

1. **UI & Titulares (`Inter`):**
   * Tipografía sans-serif neutral para navegación, encabezados y párrafos explicativos.
   * `font-family: 'Inter', -apple-system, sans-serif;`
2. **Datos & Finanzas (`JetBrains Mono`):**
   * Tipografía monoespaciada de alta precisión para precios en MXN, modelos de IA (`Llama 3.3 70B · Online`), hashes criptográficos SHA-256, contratos de datos `LEAD_INGEST_V3` y tags de agentes.
   * `font-family: 'JetBrains Mono', monospace;`

---

## 4. Efectos, Texturas y Microanimaciones

### 1. Panel de Cristal (`glass-panel`)
```css
.glass-panel {
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(51, 65, 85, 0.5);
}
```

### 2. Cuadrícula Neural Fiscal (`grid-bg`)
```css
.grid-bg {
    background-image: 
        linear-gradient(rgba(51, 65, 85, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(51, 65, 85, 0.1) 1px, transparent 1px);
    background-size: 40px 40px;
}
```

### 3. Glow Ámbar Focal para el Bundle (`glow-amber`)
```css
.glow-amber {
    box-shadow: 0 0 35px rgba(245, 158, 11, 0.18);
}
```

### 4. Pulso de Estado Agéntico en Tiempo Real (`agent-active`)
```css
@keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
}

.agent-active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 8px;
    height: 8px;
    background: #10b981;
    border-radius: 50%;
    animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
}
```

---

## 5. Componentes Clave

### 5.1 Barra de Navegación con Telemetría Agéntica
* Muestra el isotipo hexagonal de ARK.
* Incluye un badge dinámico con el estado de Workers AI:
  ```html
  <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
      <div class="relative w-2 h-2">
          <div class="absolute inset-0 bg-emerald-500 rounded-full agent-active"></div>
          <div class="relative w-2 h-2 bg-emerald-500 rounded-full"></div>
      </div>
      <span class="text-slate-400 font-mono text-xs">Llama 3.3 70B · Online</span>
  </div>
  ```

### 5.2 Visualizador de Enrutamiento por Dolor
Un módulo interactivo que ejemplifica cómo la conversación se reclasifica automáticamente hacia el especialista correcto:
* Entrada de usuario -> Flecha -> Badge del Agente Asignado (Riesgo / Flujo / Closer).

### 5.3 Tarjeta Focal del Bundle ARK Total ($997 MXN/mes)
* Borde de acento ámbar (`border-amber-500/50`) con resplandor difuso.
* Desglose de los 3 pilares: **Ark Ledger**, **Ark Angel**, **Ark Commerce**.
* Botón principal con gradiente ámbar y microinteracción de avance (`hover:translate-x-1`).

---

## 6. Generador de Textura: `forge_ark_pulse_texture.py`

Ubicación: [`scripts/python/forge_ark_pulse_texture.py`](file:///c:/Users/PAV/Desktop/e-commerce/ark-sales/scripts/python/forge_ark_pulse_texture.py)

Genera la textura de fondo `ark_pulse_bg.png` (1200×800) utilizada en encabezados, PDFs de cotización y propuestas comerciales:
* **Cuadrícula:** Cuadrícula de 40px en color `#1e293b`.
* **Nodos Agénticos:** Nodos interconectados simulando el grafo de decisión entre D1, Cloudflare Queues y Workers AI.
* **Nodo Maestro Ámbar:** El nodo primario representa el Closer (Bundle $997 MXN) con doble halo concéntrico.

### Ejecución:
```bash
python scripts/python/forge_ark_pulse_texture.py
```

---

## 7. Plantilla HTML de Referencia (Standalone)

```html
<!DOCTYPE html>
<html lang="es-MX">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARK Sales · Infraestructura Agéntica para Despachos</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #020617; color: #f8fafc; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .glass-panel {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(51, 65, 85, 0.5);
        }
        .glow-amber { box-shadow: 0 0 20px rgba(245, 158, 11, 0.15); }
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
                <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
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
            
            <!-- Visualizador de Enrutamiento por Dolor -->
            <div class="glass-panel rounded-xl p-6 max-w-2xl mx-auto text-left">
                <p class="text-xs font-mono text-slate-500 mb-4 uppercase tracking-wider">Enrutamiento por Dolor en Tiempo Real</p>
                <div class="space-y-3">
                    <div class="flex items-center gap-3 text-sm">
                        <i data-lucide="message-square" class="w-4 h-4 text-slate-400"></i>
                        <span class="text-slate-300">"Tengo multas del SAT y no entiendo el CFDI 4.0"</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-600 mx-2"></i>
                        <span class="px-2 py-0.5 rounded bg-rose-950/50 text-rose-400 border border-rose-900 text-xs font-mono">Agente: Riesgo</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm">
                        <i data-lucide="message-square" class="w-4 h-4 text-slate-400"></i>
                        <span class="text-slate-300">"Mis clientes no pagan y necesito una tienda"</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-600 mx-2"></i>
                        <span class="px-2 py-0.5 rounded bg-blue-950/50 text-blue-400 border border-blue-900 text-xs font-mono">Agente: Flujo</span>
                    </div>
                    <div class="flex items-center gap-3 text-sm">
                        <i data-lucide="message-square" class="w-4 h-4 text-slate-400"></i>
                        <span class="text-slate-300">"Todo es un caos, necesito control total"</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-600 mx-2"></i>
                        <span class="px-2 py-0.5 rounded bg-amber-950/50 text-amber-400 border border-amber-900 text-xs font-mono">Agente: Closer (Bundle)</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- The Bundle (Focal Point $997 MXN/mes) -->
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
                        <button class="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 group">
                            Solicitar Diagnóstico Gratuito
                            <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                        </button>
                        <button class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 px-6 rounded-lg transition-all border border-slate-700">
                            Ver Documentación Técnica
                        </button>
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

    <!-- Chat Widget Inyectado -->
    <script src="/widget.js" defer></script>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>
```
