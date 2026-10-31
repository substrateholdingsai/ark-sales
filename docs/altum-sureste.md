# 📄 altum-sureste.md

- **Versión:** 1.0.0
- **Instancia:** ALTUM SURESTE
- **Cliente / Tenant:** ALTUM Real Estate · Sureste & Caribe Mexicano
- **Tipo de Huésped:** `service` (asesoría premium) + vocabulario extendido de `retail`
- **Sistema:** ALTUM — real estate caribeño contemporáneo
- **Fecha:** 2026-10-31
- **Regiones:** Riviera Maya · Mérida · Tulum · Holbox · Bacalar · Cozumel
- **Filosofía:** cada propiedad tiene una línea de horizonte y una línea de agua

> **ALTUM no vende propiedades. Presenta destinos.**
> Elevado y profundo. Luz y cenote. Arena y selva.
> La arquitectura del Caribe mexicano no decora: respira.

---

## 1 · Manifiesto

El Caribe mexicano no es postal turística: es **geografía viva**. Cal maya que resplandece al mediodía,
cenotes de azul imposible, selva que abraza la piedra, arena que se extiende como lienzo,
coral que colorea el atardecer.

ALTUM traduce esa geografía a un lenguaje visual de **lujo silencioso y contemporáneo**.
No caemos en el cliché bohemio de Tulum. No usamos hamacas, macramé ni calaveras decorativas.
Honramos el lugar con **proporción, materialidad y luz**.

**Modo dominante: claro-first.** La luz vende propiedades. El modo oscuro se reserva
para el dashboard de portafolio del inversionista (sesiones largas de análisis financiero).

**Regla ornamental: Regla del 8% caribeño.** La greca maya, la textura de chukum
y el coral aparecen como acento y ritmo arquitectónico. El resto es cal, arena,
espacio negativo y proporción de villa.

---

## 2 · Tokens de color

Sistema **claro-dominante** con variante **oscuro selva** para dashboard de portafolio.

### 2.1 · Paleta núcleo clara (default)

| Rol | Token | HEX | HSL | Tailwind | Uso |
|---|---|---:|---|---|---|
| Fondo maestro | `bg-primary` | `#F7F4ED` | `hsl(40 33% 95%)` | `bg-altum-cal` | **Cal maya** — fondo general |
| Lienzo | `bg-canvas` | `#EFE7D5` | `hsl(40 46% 88%)` | `bg-altum-arena` | **Arena caribe** — secciones alternas |
| Superficie | `bg-surface` | `#FFFDF7` | `hsl(50 100% 98%)` | `bg-altum-muro` | **Muro** — tarjetas, fichas |
| Borde cálido | `border-line` | `#D9C9B0` | `hsl(36 27% 77%)` | `border-altum-chukum` | **Chukum** — bordes, hairlines |

### 2.2 · Acentos

| Rol | Token | HEX | HSL | Tailwind | Contraste sobre cal |
|---|---|---:|---|---|---|
| Acento primario | `accent-500` | `#0E6B7A` | `hsl(187 80% 27%)` | `bg-altum-cenote` | `5.62:1` AA (texto grande) |
| Acento oscuro (texto seguro) | `accent-dk` | `#094F5B` | `hsl(187 82% 19%)` | `text-altum-cenote-dk` | `8.38:1` AAA ✅ |
| Acento luminoso (hover) | `accent-hi` | `#2FB8CC` | `hsl(187 65% 49%)` | `bg-altum-cenote-hi` | Para botones sobre selva |
| Texto sobre cenote | `accent-fg` | `#FFFFFF` | `hsl(0 0% 100%)` | `text-altum-cenote-fg` | `6.17:1` AA ✅ |
| Acento secundario | `coral-500` | `#C9573F` | `hsl(11 55% 52%)` | `bg-altum-coral` | `3.89:1` AA-large ⚠️ |
| Coral oscuro (texto seguro) | `coral-dk` | `#9E3F2C` | `hsl(11 57% 39%)` | `text-altum-coral-dk` | `5.97:1` AA ✅ |
| Ámbar miel | `ambar-500` | `#C89B3C` | `hsl(41 57% 51%)` | `bg-altum-ambar` | Solo decorativo |
| Ámbar oscuro | `ambar-dk` | `#8A6B1F` | `hsl(41 64% 33%)` | `text-altum-ambar-dk` | Para texto |

### 2.3 · Paleta oscura (dashboard portafolio / sesión larga)

| Rol | Token | HEX | HSL | Tailwind |
|---|---|---:|---|---|
| Fondo maestro | `bg-primary-dk` | `#0F1E1A` | `hsl(156 32% 9%)` | `bg-altum-selva` |
| Lienzo oscuro | `bg-canvas-dk` | `#1A2F28` | `hsl(156 29% 14%)` | `bg-altum-selva-2` |
| Superficie elevada | `bg-surface-dk` | `#24382F` | `hsl(156 23% 18%)` | `bg-altum-selva-3` |
| Borde oscuro | `border-line-dk` | `#304035` | `hsl(156 15% 22%)` | `border-altum-selva-b` |
| Texto primario | `text-primary-dk` | `#F7F4ED` | `hsl(40 33% 95%)` | `text-altum-cal` |
| Texto secundario | `text-secondary-dk` | `#D9C9B0` | `hsl(36 27% 77%)` | `text-altum-chukum` |

### 2.4 · Textos claros (sobre fondos cal/arena/muro)

| Rol | Token | HEX | Contraste sobre cal |
|---|---|---:|---|
| Texto principal | `text-primary` | `#1A2B3B` | `13.16:1` AAA ✅ |
| Texto secundario | `text-secondary` | `#3E4F5C` | `7.72:1` AAA ✅ |
| Texto muted | `text-muted` | `#6B7682` | `4.21:1` AA-large |

### 2.5 · Semáforo de estado inmobiliario

| Estado | HEX | Regla visual | Uso |
|---|---|---|---|
| Disponible | `#2E8B6F` | Fondo badge semitransparente + texto verde oscuro | Propiedad activa |
| Reservada | `#C89B3C` | Fondo badge semitransparente + texto ámbar oscuro | Apartada, en proceso |
| Vendida | `#6B7682` | Badge gris neutro (nunca rojo — es éxito, no error) | Cerrada exitosamente |
| Preventa | `#0E6B7A` | Fondo badge cenote semitransparente | En desarrollo |
| Próximamente | `#3A7D5C` | Badge verde selva semitransparente | Futuro lanzamiento |

### 2.6 · Tabla de contraste WCAG verificada (cálculo real)

| Combinación | Ratio | Nivel | Uso permitido |
|---|---:|---|---|
| Grafito `#1A2B3B` / Cal `#F7F4ED` | **13.16:1** | AAA | Texto principal |
| Grafito 2 `#3E4F5C` / Cal `#F7F4ED` | **7.72:1** | AAA | Texto secundario |
| Grafito 3 `#6B7682` / Cal `#F7F4ED` | **4.21:1** | AA-large | Texto pequeño mínimo |
| Cenote `#0E6B7A` / Cal `#F7F4ED` | **5.62:1** | AA | Solo texto ≥18px o bold |
| Cenote dk `#094F5B` / Cal `#F7F4ED` | **8.38:1** | AAA | ✅ Texto pequeño cenote |
| Coral `#C9573F` / Cal `#F7F4ED` | **3.89:1** | AA-large | ⚠️ Solo decorativo |
| Coral dk `#9E3F2C` / Cal `#F7F4ED` | **5.97:1** | AA | ✅ Texto coral pequeño |
| Blanco / Cenote `#0E6B7A` (botón) | **6.17:1** | AA | ✅ Texto sobre botón cenote |
| Blanco / Cenote dk (hover) | **9.21:1** | AAA | ✅ |
| Blanco / Coral `#C9573F` (botón grande) | **4.27:1** | AA-large | Solo en CTA ≥24px |
| Blanco / Ambar `#C89B3C` (badge) | **2.56:1** | FAIL | ❌ Nunca. Usar semitransparente |
| Cal `#F7F4ED` / Selva `#0F1E1A` | **15.66:1** | AAA | Texto oscuro sobre selva |
| Cenote bright `#2FB8CC` / Selva `#0F1E1A` | **7.25:1** | AAA | Acento sobre selva |
| Chukum `#D9C9B0` / Selva `#0F1E1A` | **10.59:1** | AAA | Texto claro sobre selva |
| Verde selva `#3A7D5C` / Cal `#F7F4ED` | **4.48:1** | AA-large | Al límite, evitar texto pequeño |
| Verde selva dk `#1F4F3B` / Cal `#F7F4ED` | **8.54:1** | AAA | ✅ Verde texto seguro |

### 2.7 · Regla WCAG explícita

- Sobre `accent-500` cenote `#0E6B7A`: **texto blanco** `#FFFFFF` en botones (6.17:1 AA).
- **Nunca** usar coral claro `#C9573F` como texto pequeño sobre cal (falla AA).
- **Nunca** usar ámbar `#C89B3C` como fondo con texto blanco (falla con 2.56:1).
- Badges de estado: **siempre fondo semitransparente + texto del color oscuro** (no sólidos con texto blanco).
- En dashboard oscuro: texto `#F7F4ED` sobre selva `#0F1E1A` da 15.66:1 AAA — excelente para sesión larga.
- En modo claro: verde selva para texto debe ser el gemelo oscuro `#1F4F3B`.

### 2.8 · Tailwind config

```js
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        altum: {
          cal: "#F7F4ED",
          arena: "#EFE7D5",
          muro: "#FFFDF7",
          chukum: "#D9C9B0",
          cenote: "#0E6B7A",
          "cenote-dk": "#094F5B",
          "cenote-hi": "#2FB8CC",
          coral: "#C9573F",
          "coral-dk": "#9E3F2C",
          ambar: "#C89B3C",
          "ambar-dk": "#8A6B1F",
          grafito: "#1A2B3B",
          "grafito-2": "#3E4F5C",
          "grafito-3": "#6B7682",
          selva: "#0F1E1A",
          "selva-2": "#1A2F28",
          "selva-3": "#24382F",
          "selva-b": "#304035",
          disp: "#2E8B6F",
          "disp-dk": "#1F4F3B",
          reserv: "#C89B3C",
          vend: "#6B7682",
          prev: "#0E6B7A",
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        villa: '0 20px 50px -12px rgba(26, 43, 59, 0.18)',
        ficha: '0 4px 20px -4px rgba(26, 43, 59, 0.10)',
        selva: '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
      },
    },
  },
}
```

---

## 3 · Tríada tipográfica

| Rol | Fuente | Peso | Uso |
|---|---|---:|---|
| Display | `Fraunces` | 600–700 | Titulares editoriales, nombre de villa, hero |
| Cuerpo / UI | `Inter` | 400–500 | Listados, descripciones, filtros, navegación |
| Mono | `JetBrains Mono` | 400–500 | **Obligatoria con `tabular-nums`**: m², precios, coordenadas GPS, folios catastrales |

### Formato de datos inmobiliarios

- **Precio en listado completo:** `$12,500,000 MXN` o `$625,000 USD` (con comas, sin centavos)
- **Precio en KPI cards dashboard:** `$12.5M MXN` (formato compacto)
- **m²:** separador de miles `1,240 m² terreno · 480 m² construidos`
- **Coordenadas GPS:** mono puro `20.2153° N, 87.4546° W`
- **Folio catastral:** mono puro sin separadores `CAT-QR-2024-008741`
- **Precio/m²:** `$10,080 MXN/m²`

### Escala tipográfica

| Elemento | Tamaño | Peso | Line-height | Fuente |
|---|---|---:|---|---|
| H1 hero | 3.5rem / 56px | 700 | 1.05 | Fraunces |
| H2 sección | 2.25rem / 36px | 600 | 1.15 | Fraunces |
| H3 ficha propiedad | 1.5rem / 24px | 600 | 1.25 | Fraunces |
| Cuerpo | 1rem / 16px | 400 | 1.6 | Inter |
| Precio | 1.25rem / 20px | 500 | 1.2 | JetBrains Mono |
| Dato mono (m²/GPS) | 0.875rem / 14px | 500 | 1.4 | JetBrains Mono |
| Label | 0.75rem / 12px | 500 uppercase | 1.3 | Inter |

### CSS tipográfico base

```css
:root {
  --altum-font-display: "Fraunces", Georgia, serif;
  --altum-font-body: Inter, Helvetica, Arial, sans-serif;
  --altum-font-mono: "JetBrains Mono", "IBM Plex Mono", Consolas, monospace;
}
.altum-display { font-family: var(--altum-font-display); font-weight: 700; letter-spacing: -0.02em; }
.altum-body    { font-family: var(--altum-font-body); font-weight: 400; }
.altum-label   { font-family: var(--altum-font-body); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; font-size: 0.75rem; }
.altum-mono    { font-family: var(--altum-font-mono); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.altum-price   { font-family: var(--altum-font-mono); font-weight: 500; font-variant-numeric: tabular-nums; }
```

---

## 4 · Metáfora de operación

### 4.1 · Vocabulario del tenant

| Concepto genérico | Vocabulario ALTUM |
|---|---|
| Property / real estate | `propiedad` o `residencia` |
| Listing / catalog entry | `pieza` (elevado, editorial) |
| Villa | `villa` (cuando aplica) |
| Lot / land | `parcela` o `lote` |
| Pre-construction | `en desarrollo` o `preventa` |
| Showing / tour | `recorrido privado` |
| Portfolio | `portafolio` |
| Broker / agent | `asesor ALTUM` |
| Closing | `escrituración` |
| Title deed | `título de propiedad` |
| Appraisal | `avalúo` |
| Appraisal value | `valor catastral` |
| Amenities | `amenidades` |
| View / outlook | `línea de horizonte` |
| Waterfront / cenote access | `línea de agua` |
| ROI / investment return | `rendimiento` |

### 4.2 · Metáforas permitidas (éticas, no cliché)

- **Horizonte**: el cielo sobre el Caribe, la vista desde la villa
- **Línea de agua**: acceso al mar, cenote o piscina infinita
- **Greca maya escalonada**: como ritmo arquitectónico abstracto, nunca como glifo sagrado literal
- **Chukum / estuco**: textura cálida de fondo, materialidad local
- **Arena y cal**: materiales base del Caribe mexicano
- **Selva**: la vegetación que abraza la arquitectura
- **Cenote**: la profundidad, el azul imposible
- **Coral**: acento cálido, atardecer, flora marina

### 4.3 · Lo que NUNCA hacemos (ética cultural)

❌ **Prohibido:**
- Iconografía sagrada maya literal (glifos ceremoniales, deidades, códices)
- Cliché Tulum-bohemio (macramé, hamacas, sombreros, atrapasueños)
- Calaveras decorativas (Día de Muertos no es identidad caribeña)
- Fotos stock genéricas de "paraíso tropical"
- Tipografía "tiki" o "tropical kitsch"
- Azul aguamarina saturado tipo anuncio turístico
- Gradientes de arcoíris playeros
- Sombreros de palma como logo

✅ **Permitido:**
- Geometría maya abstracta como ritmo
- Texturas de chukum, cal y arena
- Proporción de villa contemporánea mexicana
- Fotografía editorial de alta calidad
- Azul profundo cenote (no aguamarina)
- Coral como acento cálido

### 4.4 · Flujo del visitante

1. **Portada** — hero con pieza estrella del mes, paisaje + arquitectura
2. **Regiones** — Riviera Maya, Mérida, Tulum, Holbox, Bacalar, Cozumel
3. **Listado curado** — propiedades con filtros (región, tipo, precio, m², estado)
4. **Ficha de propiedad** — galería, amenidades, mapa, asesor asignado
5. **Recorrido privado** — agendamiento con asesor ALTUM
6. **Portafolio** (dashboard privado, modo oscuro) — inversiones, rendimiento, escrituraciones

---

## 5 · Capa artística

### 5.1 · Ética visual

ALTUM honra la **arquitectura contemporánea del Caribe mexicano**:
volumetría limpia, materiales locales, integración con la selva,
proporción humana, luz natural.

No vendemos escapismo. Vendemos **destinos con identidad**.

### 5.2 · Anatomía de componentes

```css
:root {
  --altum-cal: #F7F4ED;
  --altum-arena: #EFE7D5;
  --altum-muro: #FFFDF7;
  --altum-chukum: #D9C9B0;
  --altum-cenote: #0E6B7A;
  --altum-cenote-dk: #094F5B;
  --altum-coral: #C9573F;
  --altum-coral-dk: #9E3F2C;
  --altum-grafito: #1A2B3B;
  --altum-grafito-2: #3E4F5C;
  --altum-radius: 4px;
}

/* Tarjeta de propiedad / ficha */
.altum-ficha {
  background: var(--altum-muro);
  border: 1px solid var(--altum-chukum);
  border-radius: var(--altum-radius);
  box-shadow: 0 4px 20px -4px rgba(26, 43, 59, 0.10);
  overflow: hidden;
}
.altum-ficha__imagen { aspect-ratio: 4/3; object-fit: cover; }
.altum-ficha__precio {
  font-family: var(--altum-font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--altum-cenote-dk);
}

/* Botón primario cenote */
.altum-btn-primary {
  background: var(--altum-cenote);
  color: #FFFFFF;
  border: none;
  border-radius: 4px;
  padding: 14px 28px;
  font-weight: 500;
  transition: background 200ms ease;
}
.altum-btn-primary:hover { background: var(--altum-cenote-dk); }

/* Botón coral (solo para CTA grandes ≥24px, por contraste) */
.altum-btn-coral {
  background: var(--altum-coral);
  color: #FFFFFF;
  border-radius: 4px;
  padding: 14px 28px;
  font-weight: 500;
}
.altum-btn-coral:hover { background: var(--altum-coral-dk); }

/* Botón secundario outline */
.altum-btn-secondary {
  background: transparent;
  color: var(--altum-cenote-dk);
  border: 1.5px solid var(--altum-cenote-dk);
  border-radius: 4px;
  padding: 12px 24px;
}

/* Badge de estado — siempre semitransparente, nunca sólido */
.altum-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-family: var(--altum-font-mono);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}
.altum-badge--disp    { background: rgba(46,139,111,0.12); color: #1F4F3B; border: 1px solid rgba(46,139,111,0.3); }
.altum-badge--reserv  { background: rgba(200,155,60,0.14); color: #8A6B1F; border: 1px solid rgba(200,155,60,0.3); }
.altum-badge--vend    { background: rgba(107,118,130,0.12); color: #3E4F5C; border: 1px solid rgba(107,118,130,0.3); }
.altum-badge--prev    { background: rgba(14,107,122,0.12); color: #094F5B; border: 1px solid rgba(14,107,122,0.3); }

/* Hero con foto + overlay */
.altum-hero {
  position: relative;
  min-height: 80vh;
  background-size: cover;
  background-position: center;
}
.altum-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(15, 30, 26, 0.1) 0%,
    rgba(15, 30, 26, 0.65) 70%,
    rgba(15, 30, 26, 0.9) 100%
  );
}

/* Fondo chukum texturizado */
.altum-textura-chukum {
  background-color: var(--altum-arena);
  background-image: url("/assets/altum/texture-chukum.svg");
  background-size: 256px 256px;
}

/* Divisor horizonte */
.altum-horizonte {
  height: 48px;
  background-image: url("/assets/altum/divider-horizonte.svg");
  background-repeat: no-repeat;
  background-position: center;
}

/* Navegación con blur */
.altum-nav {
  background: rgba(247, 244, 237, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--altum-chukum);
}

/* Dark mode — dashboard portafolio */
.altum-dark { background: #0F1E1A; color: #F7F4ED; }
.altum-dark .altum-card { background: #1A2F28; border-color: #304035; }
```

### 5.3 · Voz de marca

Editorial, serena, sofisticada. Como una revista de arquitectura de alta gama.
Habla del destino, no de la venta. Sin exclamaciones, sin urgencia artificial.

Modelos:
- "Villa Altum · Tulum. 4 recámaras, 620 m², línea de agua privada."
- "La selva abraza la piedra. El mar define el horizonte."
- "Riviera Maya · Holbox · Bacalar · Mérida. Seis destinos, una visión."
- "Su asesor ALTUM: María Fernández, +10 años en la región."
- "Escrituración ágil. Título de propiedad inscrito en el Registro Público."

### 5.4 · Do / Don't

| Do | Don't |
|---|---|
| Usar cenote como acento primario, coral solo para CTA grandes | Mezclar azul aguamarina saturado + verde lima = cliché turístico |
| Badges semitransparentes con texto del color oscuro | Badges sólidos con texto blanco (fallan contraste) |
| Fraunces para titulares editoriales | Fraunces en párrafos largos (difícil de leer) |
| Mono tabular para m², precios, GPS, folios | Usar Inter proporcional para datos numéricos |
| Geometría maya abstracta como ritmo | Glifos mayas sagrados literales |
| Proporción de villa contemporánea | Decoración bohemio-chic (macramé, hamacas) |
| Luz natural en fotografía de propiedades | Stock photos saturadas de "paraíso" |
| Coral oscuro `#9E3F2C` como texto pequeño | Coral claro `#C9573F` como texto pequeño |
| Ámbar como acento decorativo | Ámbar como fondo con texto blanco |
| Modo oscuro solo para dashboard de portafolio | Modo oscuro forzado en el listado público |

### 5.5 · Inventario de assets ALTUM

**Técnico mínimo:** `favicon.svg` · `logo-lockup.svg` · `pattern-greca.svg` · `manifest.json`

**Kit artístico vectorial:** `texture-chukum.svg` · `texture-arena.svg` · `texture-selva.svg` ·
`monogram-altum.svg` · `divider-horizonte.svg` · `og-image.svg` · `sprite-real-estate.svg`

**Sprite gremial (8 iconos 24×24, stroke 1.7, currentColor):**
- `villa` — residencia
- `cenote` — acceso a agua
- `horizonte` — vista al mar
- `parcela` — terreno
- `brújula` — navegación/región
- `llave` — escrituración/entrega
- `mapa` — ubicación
- `inversión` — portafolio/rendimiento

**Capa raster SEO/PWA:** `og-image.png` · `twitter-card.png` · `apple-touch-icon.png` ·
`favicon-32/16.png` · `android-chrome-192/512.png` (maskable-safe 72%) · `favicon.ico` ·
`site.webmanifest` · `robots.txt` · `meta-tags.html` · modo `--alert` para nuevas propiedades en preventa.

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ALTUM SURESTE — Fábrica Vectorial · Real Estate Caribe Mexicano
Stdlib pura: math, random, pathlib, json, argparse. Cero Pillow/Cairo.
"""

import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import argparse
import json
import math
import random
from pathlib import Path

XML = '<?xml version="1.0" encoding="UTF-8"?>\n'
_rng = random.Random(20261031)
NOISE_SEED = _rng.randint(1000, 9999)

# ── Paleta ALTUM SURESTE ──
CAL       = "#F7F4ED"
ARENA     = "#EFE7D5"
MURO      = "#FFFDF7"
CHUKUM    = "#D9C9B0"
CENOTE    = "#0E6B7A"
CENOTE_DK = "#094F5B"
CENOTE_HI = "#2FB8CC"
CORAL     = "#C9573F"
CORAL_DK  = "#9E3F2C"
AMBAR     = "#C89B3C"
AMBAR_DK  = "#8A6B1F"
GRAFITO   = "#1A2B3B"
GRAFITO_2 = "#3E4F5C"
SELVA     = "#0F1E1A"
SELVA_2   = "#1A2F28"
SELVA_B   = "#304035"


# ══════════════ MOTIVO ALTUM: horizonte + línea de agua ══════════════
def _motivo_altum(cx, cy, size):
    """Monograma: horizonte arriba (villa) + línea de agua abajo (cenote)."""
    s = size
    # Línea de horizonte
    horizon_y = cy - s * 0.1
    # Villa estilizada (volumen arquitectónico minimalista)
    villa = f"""
      <path d="M{cx - s*0.35} {horizon_y} L{cx - s*0.35} {cy - s*0.35} L{cx - s*0.1} {cy - s*0.35} L{cx - s*0.1} {horizon_y} Z"
            fill="none" stroke="{CENOTE_DK}" stroke-width="{max(1, s*0.03)}" stroke-linejoin="miter"/>
      <path d="M{cx - s*0.05} {horizon_y} L{cx - s*0.05} {cy - s*0.45} L{cx + s*0.35} {cy - s*0.45} L{cx + s*0.35} {horizon_y} Z"
            fill="none" stroke="{CENOTE_DK}" stroke-width="{max(1, s*0.03)}" stroke-linejoin="miter"/>
      <line x1="{cx - s*0.25}" y1="{cy - s*0.2}" x2="{cx - s*0.15}" y2="{cy - s*0.2}"
            stroke="{CORAL_DK}" stroke-width="{max(1, s*0.025)}"/>
      <line x1="{cx + s*0.05}" y1="{cy - s*0.25}" x2="{cx + s*0.25}" y2="{cy - s*0.25}"
            stroke="{CORAL_DK}" stroke-width="{max(1, s*0.025)}"/>
    """
    # Línea de agua (cenote/mar) con onda sutil
    water_y = cy + s * 0.25
    water = f"""
      <path d="M{cx - s*0.4} {water_y} Q{cx - s*0.2} {water_y - s*0.05}, {cx} {water_y} T{cx + s*0.4} {water_y}"
            fill="none" stroke="{CENOTE_HI}" stroke-width="{max(1, s*0.025)}" stroke-linecap="round"/>
      <path d="M{cx - s*0.35} {water_y + s*0.08} Q{cx - s*0.15} {water_y + s*0.03}, {cx + s*0.05} {water_y + s*0.08} T{cx + s*0.35} {water_y + s*0.08}"
            fill="none" stroke="{CENOTE}" stroke-width="{max(1, s*0.02)}" stroke-linecap="round" opacity="0.6"/>
    """
    return villa + water


# ══════════════ FAVICON (viewBox 64, rx=14) ══════════════
FAVICON_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="favBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{MURO}"/>
      <stop offset="1" stop-color="{ARENA}"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#favBg)"/>
  <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="none" stroke="{CHUKUM}" stroke-width="1"/>
  <g transform="translate(32 34) scale(0.7)">
    {_motivo_altum(0, 0, 50)}
  </g>
</svg>
"""


# ══════════════ LOGO LOCKUP (~640×160) ══════════════
LOGO_LOCKUP_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="640" height="160">
  <g transform="translate(32 32) scale(1.5)">
    <rect width="64" height="64" rx="14" fill="{MURO}"/>
    <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="none" stroke="{CHUKUM}" stroke-width="1"/>
    <g transform="translate(32 34) scale(0.7)">
      {_motivo_altum(0, 0, 50)}
    </g>
  </g>

  <text x="150" y="82" font-family="Fraunces, Georgia, serif" font-size="58"
        font-weight="700" letter-spacing="0" fill="{GRAFITO}">ALTUM</text>
  <text x="152" y="118" font-family="Inter, Helvetica, Arial, sans-serif" font-size="18"
        font-weight="500" letter-spacing="6" fill="{CENOTE_DK}">SURESTE</text>
  <text x="152" y="142" font-family="'JetBrains Mono', Consolas, monospace" font-size="11"
        letter-spacing="2" fill="{GRAFITO_2}">RIVIERA MAYA · MÉRIDA · TULUM · HOLBOX · BACALAR</text>
  <line x1="150" y1="126" x2="590" y2="126" stroke="{CHUKUM}" stroke-width="1"/>
</svg>
"""


# ══════════════ MONOGRAMA ALTUM ══════════════
MONOGRAM_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="mnBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{MURO}"/>
      <stop offset="1" stop-color="{ARENA}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="58" fill="url(#mnBg)" stroke="{CHUKUM}" stroke-width="2"/>
  <circle cx="64" cy="64" r="48" fill="none" stroke="{CHUKUM}" stroke-width="1" opacity="0.5"/>
  <g transform="translate(64 68) scale(1.05)">
    {_motivo_altum(0, 0, 50)}
  </g>
</svg>
"""


# ══════════════ PATRÓN GRECA MAYA ABSTRACTA (ritmo arquitectónico) ══════════════
def build_pattern_greca() -> str:
    """Greca escalonada como ritmo arquitectónico abstracto. NO es glifo sagrado literal."""
    # Greca escalonada simple: espiral de 3 pasos
    def greca(x0, y0, s, color, op):
        p = [
            (0, 0), (4, 0), (4, 1), (3, 1), (3, 2), (2, 2), (2, 3), (1, 3), (1, 2), (0, 2)
        ]
        pts = " ".join(f"{x0 + px * s:.1f},{y0 + py * s:.1f}" for px, py in p)
        return (
            f'<polyline points="{pts}" fill="none" stroke="{color}" '
            f'stroke-width="{s * 0.5:.1f}" opacity="{op}" stroke-linejoin="miter"/>'
        )
    grecas = []
    # 2 grecas por tile, alternando color
    grecas.append(greca(4, 10, 5, CENOTE_DK, 0.09))
    grecas.append(greca(36, 10, 5, CORAL_DK, 0.08))
    cuerpo = "\n    ".join(grecas)
    return XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 40" width="64" height="40">
  <g>
    {cuerpo}
  </g>
</svg>
"""


# ══════════════ TEXTURA CHUKUM (estuco maya, feTurbulence) ══════════════
TEXTURE_CHUKUM_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <filter id="chukum" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" seed="{NOISE_SEED}" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.83
                                                  0 0 0 0 0.77
                                                  0 0 0 0 0.66
                                                  0 0 0 0.14 0" result="t"/>
      <feComposite in="t" in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  <rect width="256" height="256" fill="{ARENA}"/>
  <rect width="256" height="256" filter="url(#chukum)"/>
</svg>
"""


# ══════════════ TEXTURA ARENA (grano fino caribeño) ══════════════
TEXTURE_ARENA_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <filter id="arena" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.8" numOctaves="2" seed="{NOISE_SEED + 3}" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.88
                                                  0 0 0 0 0.84
                                                  0 0 0 0 0.74
                                                  0 0 0 0.10 0" result="t"/>
      <feComposite in="t" in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  <rect width="256" height="256" fill="{CAL}"/>
  <rect width="256" height="256" filter="url(#arena)"/>
</svg>
"""


# ══════════════ TEXTURA SELVA (oscuro, para dashboard) ══════════════
TEXTURE_SELVA_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <filter id="selva" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="{NOISE_SEED + 7}" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.06
                                                  0 0 0 0 0.12
                                                  0 0 0 0 0.10
                                                  0 0 0 0.35 0" result="t"/>
      <feComposite in="t" in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  <rect width="256" height="256" fill="{SELVA}"/>
  <rect width="256" height="256" filter="url(#selva)"/>
</svg>
"""


# ══════════════ DIVISOR HORIZONTE (línea de horizonte con sol) ══════════════
DIVIDER_HORIZONTE_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 60" width="600" height="60">
  <line x1="0" y1="30" x2="250" y2="30" stroke="{CHUKUM}" stroke-width="1.5"/>
  <line x1="350" y1="30" x2="600" y2="30" stroke="{CHUKUM}" stroke-width="1.5"/>
  <!-- sol / luna naciente -->
  <circle cx="300" cy="30" r="16" fill="none" stroke="{AMBAR}" stroke-width="2"/>
  <circle cx="300" cy="30" r="10" fill="{AMBAR}" opacity="0.35"/>
  <circle cx="300" cy="30" r="5" fill="{CORAL_DK}"/>
  <!-- ondas de agua debajo -->
  <path d="M220 45 Q260 40, 300 45 T380 45" fill="none" stroke="{CENOTE_HI}" stroke-width="1.2" opacity="0.5"/>
  <path d="M240 50 Q270 47, 300 50 T360 50" fill="none" stroke="{CENOTE}" stroke-width="1" opacity="0.35"/>
</svg>
"""


# ══════════════ OG IMAGE (1200×630, safe zone 100px) ══════════════
OG_IMAGE_SVG = XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="ogBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{MURO}"/>
      <stop offset="1" stop-color="{ARENA}"/>
    </linearGradient>
    <filter id="ogArena" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="31" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.88  0 0 0 0 0.84  0 0 0 0 0.74  0 0 0 0.08 0"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#ogBg)"/>
  <rect width="1200" height="630" filter="url(#ogArena)"/>

  <!-- marco -->
  <rect x="40" y="40" width="1120" height="550" fill="none" stroke="{CHUKUM}" stroke-width="1"/>

  <!-- monograma grande -->
  <g transform="translate(120 180) scale(2)">
    <circle cx="64" cy="64" r="58" fill="{MURO}" stroke="{CHUKUM}" stroke-width="2"/>
    <g transform="translate(64 68) scale(1.05)">
      {_motivo_altum(0, 0, 50)}
    </g>
  </g>

  <!-- tipografía -->
  <text x="430" y="270" font-family="Fraunces, Georgia, serif" font-size="100"
        font-weight="700" letter-spacing="-2" fill="{GRAFITO}">ALTUM</text>
  <text x="432" y="322" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24"
        font-weight="500" letter-spacing="10" fill="{CENOTE_DK}">SURESTE</text>
  <line x1="430" y1="348" x2="900" y2="348" stroke="{CHUKUM}" stroke-width="1"/>
  <text x="432" y="388" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20"
        fill="{GRAFITO_2}">Real Estate · Caribe Mexicano</text>

  <!-- destinos -->
  <text x="432" y="440" font-family="'JetBrains Mono', Consolas, monospace" font-size="14"
        letter-spacing="2" fill="{GRAFITO_2}">RIVIERA MAYA · MÉRIDA · TULUM · HOLBOX · BACALAR · COZUMEL</text>

  <!-- KPIs simuladas -->
  <g transform="translate(430 480)">
    <rect width="200" height="72" fill="{MURO}" stroke="{CHUKUM}" rx="4"/>
    <text x="16" y="26" font-family="Inter, sans-serif" font-size="10" letter-spacing="2" fill="{GRAFITO_2}">PIEZAS CURADAS</text>
    <text x="16" y="54" font-family="Fraunces, serif" font-size="26" font-weight="700" fill="{GRAFITO}">148</text>
  </g>
  <g transform="translate(650 480)">
    <rect width="200" height="72" fill="{MURO}" stroke="{CHUKUM}" rx="4"/>
    <text x="16" y="26" font-family="Inter, sans-serif" font-size="10" letter-spacing="2" fill="{GRAFITO_2}">PORTAFOLIO MXN</text>
    <text x="16" y="54" font-family="Fraunces, serif" font-size="26" font-weight="700" fill="{GRAFITO}">$4.2B</text>
  </g>
  <g transform="translate(870 480)">
    <rect width="200" height="72" fill="{MURO}" stroke="{CHUKUM}" rx="4"/>
    <text x="16" y="26" font-family="Inter, sans-serif" font-size="10" letter-spacing="2" fill="{GRAFITO_2}">ASESORES ALTUM</text>
    <text x="16" y="54" font-family="Fraunces, serif" font-size="26" font-weight="700" fill="{GRAFITO}">24</text>
  </g>

  <!-- greca decorativa lateral -->
  <g transform="translate(1040 120)" opacity="0.4">
    <polyline points="0,0 24,0 24,8 16,8 16,16 8,16 8,24 0,24" fill="none" stroke="{CENOTE_DK}" stroke-width="2"/>
    <polyline points="0,40 24,40 24,48 16,48 16,56 8,56 8,64 0,64" fill="none" stroke="{CORAL_DK}" stroke-width="2"/>
    <polyline points="0,80 24,80 24,88 16,88 16,96 8,96 8,104 0,104" fill="none" stroke="{AMBAR_DK}" stroke-width="2"/>
  </g>

  <text x="1160" y="588" font-family="'JetBrains Mono', Consolas, monospace" font-size="11"
        letter-spacing="2" fill="{GRAFITO_2}" text-anchor="end">altumsureste.mx</text>
</svg>
"""


# ══════════════ SPRITE REAL ESTATE (8 iconos, 192×24) ══════════════
SPRITE_ICONS = [
    # villa / residencia
    ("villa",
     """<path d="M3 21h18"/>
     <path d="M5 21V9l7-6 7 6v12"/>
     <path d="M9 21v-6h6v6"/>"""),
    # cenote / acceso a agua
    ("cenote",
     """<circle cx="12" cy="12" r="9"/>
     <path d="M3 12h18"/>
     <path d="M6 15c2 1 4 1 6 0s4-1 6 0"/>
     <path d="M6 18c2 1 4 1 6 0s4-1 6 0"/>"""),
    # horizonte / vista al mar
    ("horizonte",
     """<path d="M2 16h20"/>
     <path d="M2 20h20"/>
     <circle cx="12" cy="10" r="3"/>
     <path d="M6 16v-3l4-3 4 3v3"/>"""),
    # parcela / terreno
    ("parcela",
     """<rect x="3" y="6" width="18" height="14" rx="1"/>
     <path d="M3 13h18M9 6v14M15 6v14"/>
     <path d="M3 6l4-3M21 6l-4-3"/>"""),
    # brújula / navegación
    ("brújula",
     """<circle cx="12" cy="12" r="9"/>
     <path d="M15 9l-2 6-4 2 2-6z"/>
     <path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>"""),
    # llave / escrituración
    ("llave",
     """<circle cx="8" cy="15" r="4"/>
     <path d="M11 12l6-6"/>
     <path d="M14 9l2-2M16 7l2-2"/>
     <path d="M15 6l3 3"/>"""),
    # mapa / ubicación
    ("mapa",
     """<path d="M9 3l-6 3v15l6-3 6 3 6-3V3l-6 3z"/>
     <path d="M9 3v15M15 6v15"/>"""),
    # inversión / rendimiento
    ("inversión",
     """<path d="M3 20l5-5 4 4 8-9"/>
     <path d="M15 10h5v5"/>
     <path d="M3 20h18"/>"""),
]


def build_sprite_real_estate() -> str:
    groups = []
    for i, (icon_id, paths) in enumerate(SPRITE_ICONS):
        x = i * 24
        groups.append(
            f'<g id="{icon_id}" transform="translate({x} 0)" fill="none" '
            f'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" '
            f'stroke-linejoin="round">\n    {paths}\n  </g>'
        )
    body = "\n  ".join(groups)
    return XML + f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 24" width="192" height="24" style="color:{CENOTE_DK}">
  {body}
</svg>
"""


# ══════════════ HELPERS ══════════════
def write_asset(out_dir: Path, name: str, content: str) -> Path:
    path = out_dir / name
    if not content.endswith("\n"):
        content += "\n"
    path.write_text(content, encoding="utf-8")
    return path


def kb(size_bytes: int) -> float:
    return round(size_bytes / 1024, 2)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ALTUM SURESTE vector forge — Real Estate Caribe Mexicano (stdlib pura)."
    )
    parser.add_argument("--out", default="assets/altum",
                        help="Directorio de salida. Ej.: assets/altum")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    assets = [
        ("favicon.svg", FAVICON_SVG),
        ("logo-lockup.svg", LOGO_LOCKUP_SVG),
        ("monogram-altum.svg", MONOGRAM_SVG),
        ("pattern-greca.svg", build_pattern_greca()),
        ("texture-chukum.svg", TEXTURE_CHUKUM_SVG),
        ("texture-arena.svg", TEXTURE_ARENA_SVG),
        ("texture-selva.svg", TEXTURE_SELVA_SVG),
        ("divider-horizonte.svg", DIVIDER_HORIZONTE_SVG),
        ("og-image.svg", OG_IMAGE_SVG),
        ("sprite-real-estate.svg", build_sprite_real_estate()),
    ]

    records = []
    for name, content in assets:
        path = write_asset(out_dir, name, content)
        size = path.stat().st_size
        records.append({"path": name, "bytes": size, "kb": kb(size)})

    # validación pattern <4KB
    p_rec = next(r for r in records if r["path"] == "pattern-greca.svg")
    pattern_ok = p_rec["bytes"] < 4096

    manifest = {
        "schema": "bobs.asset-manifest.v1",
        "system": "ALTUM SURESTE",
        "slug": "altum-sureste",
        "cliente": "ALTUM Real Estate · Sureste & Caribe Mexicano",
        "huesped": "service",
        "kind": "vector-forge",
        "stdlib_only": True,
        "noise_seed": NOISE_SEED,
        "files": records,
        "total_bytes": sum(r["bytes"] for r in records),
        "total_kb": round(sum(r["bytes"] for r in records) / 1024, 2),
        "checks": {"pattern_greca_under_4kb": pattern_ok},
    }

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    manifest_size = manifest_path.stat().st_size

    print("\n🌊 ALTUM SURESTE — Fábrica Vectorial · Real Estate Caribe")
    print(f"📁 Salida: {out_dir.resolve()}")
    print("─" * 58)
    for record in records:
        flag = "  ✓<4KB" if record["path"] == "pattern-greca.svg" and pattern_ok else ""
        print(f"{record['path']:<28} {record['kb']:>8.2f} KB{flag}")
    print("─" * 58)
    print(f"{'manifest.json':<28} {kb(manifest_size):>8.2f} KB")
    print(f"{'TOTAL SVG':<28} {manifest['total_kb']:>8.2f} KB")
    print("✓ Ético: geometría maya abstracta, sin cliché bohemio-chic")
    print("✓ Dualidad: horizonte (altura) + línea de agua (profundidad)")
    print("✅ Listo. Zero Pillow. Zero dependencias externas.\n")


if __name__ == "__main__":
    main()

scripts/generate_seo_assets.py

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ALTUM SURESTE — Capa Raster SEO / Social / PWA · Real Estate Caribe Mexicano
Pillow justificado: crawlers de WhatsApp/FB/LinkedIn/X no rasterizan SVG.
Supersampling 4× + downscale LANCZOS. Fallback tipográfico en cascada que nunca truena.
"""

import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

import argparse
import json
from datetime import datetime, timezone
from html import escape
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("❌ Pillow requerido para la capa raster.\nInstala con: python -m pip install Pillow")
    raise SystemExit(1)

SCALE = 4

# ── Paleta ALTUM RGB ──
CAL       = (247, 244, 237)
ARENA     = (239, 231, 213)
MURO      = (255, 253, 247)
CHUKUM    = (217, 201, 176)
CENOTE    = (14, 107, 122)
CENOTE_DK = (9, 79, 91)
CENOTE_HI = (47, 184, 204)
CORAL     = (201, 87, 63)
CORAL_DK  = (158, 63, 44)
AMBAR     = (200, 155, 60)
AMBAR_DK  = (138, 107, 31)
GRAFITO   = (26, 43, 59)
GRAFITO_2 = (62, 79, 92)
SELVA     = (15, 30, 26)

FONT_CANDIDATES = {
    "display": [
        "/usr/share/fonts/truetype/fraunces/Fraunces-Bold.ttf",
        "/usr/share/fonts/truetype/fraunces/Fraunces-SemiBold.ttf",
        "/usr/share/fonts/truetype/playfair/PlayfairDisplay-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "C:/Windows/Fonts/georgiab.ttf",
    ],
    "body": [
        "/usr/share/fonts/truetype/inter/Inter-Medium.ttf",
        "/usr/share/fonts/truetype/inter/Inter-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "C:/Windows/Fonts/arial.ttf",
    ],
    "mono": [
        "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Medium.ttf",
        "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/cour.ttf",
    ],
}


def ss(v): return int(round(v * SCALE))
def ensure_dir(p: Path) -> Path: p.mkdir(parents=True, exist_ok=True); return p
def kb(path: Path) -> float: return round(path.stat().st_size / 1024, 2)


def load_font(kind, size):
    size = max(1, int(size))
    for fp in FONT_CANDIDATES.get(kind, []):
        try:
            return ImageFont.truetype(fp, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    try:
        if outline is None:
            draw.rounded_rectangle(box, radius=radius, fill=fill)
        else:
            draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=max(1, width))
    except AttributeError:
        draw.rectangle(box, fill=fill, outline=outline, width=max(1, width))


def text_length(draw, text, font):
    try:
        return draw.textlength(text, font=font)
    except AttributeError:
        return draw.textsize(text, font=font)[0]


def text_bbox(draw, text, font):
    try:
        return draw.textbbox((0, 0), text, font=font)
    except AttributeError:
        w, h = draw.textsize(text, font=font)
        return (0, 0, w, h)


def draw_motivo(draw, cx, cy, size):
    """Monograma ALTUM: villa (horizonte) + línea de agua."""
    s = size
    horizon_y = cy - s * 0.1
    sw = max(1, int(round(s * 0.03)))
    sw_thin = max(1, int(round(s * 0.025)))

    # Villa 1 (volumen bajo izquierdo)
    v1 = [
        (cx - s * 0.35, horizon_y),
        (cx - s * 0.35, cy - s * 0.35),
        (cx - s * 0.1, cy - s * 0.35),
        (cx - s * 0.1, horizon_y),
    ]
    draw.polygon(v1, outline=CENOTE_DK)
    draw.line([v1[0], v1[1]], fill=CENOTE_DK, width=sw)
    draw.line([v1[1], v1[2]], fill=CENOTE_DK, width=sw)
    draw.line([v1[2], v1[3]], fill=CENOTE_DK, width=sw)

    # Villa 2 (volumen alto derecho)
    v2 = [
        (cx - s * 0.05, horizon_y),
        (cx - s * 0.05, cy - s * 0.45),
        (cx + s * 0.35, cy - s * 0.45),
        (cx + s * 0.35, horizon_y),
    ]
    draw.line([v2[0], v2[1]], fill=CENOTE_DK, width=sw)
    draw.line([v2[1], v2[2]], fill=CENOTE_DK, width=sw)
    draw.line([v2[2], v2[3]], fill=CENOTE_DK, width=sw)

    # Ventanas coral
    draw.line([(cx - s * 0.25, cy - s * 0.2), (cx - s * 0.15, cy - s * 0.2)],
              fill=CORAL_DK, width=sw_thin)
    draw.line([(cx + s * 0.05, cy - s * 0.25), (cx + s * 0.25, cy - s * 0.25)],
              fill=CORAL_DK, width=sw_thin)

    # Línea de agua (cenote)
    water_y = int(cy + s * 0.25)
    # onda superior
    wave_top = [(cx - s * 0.4, water_y)]
    for i in range(1, 20):
        x = cx - s * 0.4 + (s * 0.8 * i / 19)
        y = water_y + 5 * math.sin(i * 0.8)
        wave_top.append((x, y))
    for i in range(len(wave_top) - 1):
        draw.line([wave_top[i], wave_top[i + 1]], fill=CENOTE_HI, width=max(1, sw_thin))


def draw_monogram(draw, x, y, size):
    """Monograma circular ALTUM."""
    r = size / 2
    cx, cy = x + r, y + r
    draw.ellipse([x, y, x + size, y + size], fill=MURO, outline=CHUKUM, width=max(1, ss(1)))
    inner_r = r * 0.83
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
                 outline=CHUKUM, width=max(1, ss(0.5)))
    draw_motivo(draw, cx, cy + size * 0.02, size * 0.92)


def make_og(domain_text="altumsureste.mx"):
    width, height = ss(1200), ss(630)
    # fondo gradiente cal → arena
    img = Image.new("RGB", (width, height), CAL)
    draw = ImageDraw.Draw(img)
    for i in range(height):
        t = i / height
        c = tuple(int(CAL[k] + (ARENA[k] - CAL[k]) * t) for k in range(3))
        draw.line([(0, i), (width, i)], fill=c)

    # textura de arena sutil
    try:
        from PIL import Image as _Image
        noise = _Image.effect_noise((max(1, width // 8), max(1, height // 8)), 22).convert("L")
        noise = noise.resize((width, height), _Image.LANCZOS)
        overlay = Image.new("RGBA", (width, height), (*AMBAR, 0))
        overlay.putalpha(noise.point(lambda p: int(p * 0.06)))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)
    except Exception:
        pass

    # marco
    draw.rectangle([ss(40), ss(40), ss(1160), ss(590)], outline=CHUKUM, width=max(1, ss(1)))

    # monograma
    draw_monogram(draw, ss(120), ss(180), ss(220))

    # tipografía
    f_title = load_font("display", ss(100))
    f_sub = load_font("body", ss(24))
    f_label = load_font("mono", ss(14))
    f_kpi_label = load_font("body", ss(10))
    f_kpi_value = load_font("display", ss(26))
    f_mono = load_font("mono", ss(11))

    draw.text((ss(430), ss(200)), "ALTUM", font=f_title, fill=GRAFITO)
    draw.text((ss(432), ss(300)), "SURESTE", font=f_sub, fill=CENOTE_DK)
    draw.line([ss(430), ss(330), ss(900), ss(330)], fill=CHUKUM, width=max(1, ss(1)))
    draw.text((ss(432), ss(360)), "Real Estate · Caribe Mexicano", font=f_sub, fill=GRAFITO_2)

    draw.text((ss(432), ss(410)), "RIVIERA MAYA · MÉRIDA · TULUM · HOLBOX · BACALAR · COZUMEL",
              font=f_label, fill=GRAFITO_2)

    # KPIs simuladas
    kpis = [("PIEZAS CURADAS", "148"), ("PORTAFOLIO MXN", "$4.2B"), ("ASESORES ALTUM", "24")]
    kx = ss(430)
    for label, value in kpis:
        rounded_rect(draw, [kx, ss(460), kx + ss(200), ss(530)], ss(4), fill=MURO, outline=CHUKUM, width=max(1, ss(1)))
        draw.text((kx + ss(16), ss(472)), label, font=f_kpi_label, fill=GRAFITO_2)
        draw.text((kx + ss(16), ss(495)), value, font=f_kpi_value, fill=GRAFITO)
        kx += ss(220)

    # grecas decorativas laterales
    for i, color in enumerate([CENOTE_DK, CORAL_DK, AMBAR_DK]):
        gy = ss(120) + i * ss(60)
        pts = [(ss(1040), gy), (ss(1064), gy), (ss(1064), gy + ss(8)),
               (ss(1056), gy + ss(8)), (ss(1056), gy + ss(16)),
               (ss(1048), gy + ss(16)), (ss(1048), gy + ss(24)),
               (ss(1040), gy + ss(24))]
        draw.line(pts, fill=color, width=max(1, ss(2)))

    # watermark
    draw.text((ss(1160), ss(575)), domain_text, font=f_mono, fill=GRAFITO_2, anchor="ra")

    return img.resize((1200, 630), Image.LANCZOS)


def make_icon(size, maskable=False):
    canvas = ss(size)
    img = Image.new("RGB", (canvas, canvas), CAL)
    draw = ImageDraw.Draw(img)

    if not maskable:
        radius = max(2, int(round(14 * size / 64 * SCALE)))
        rounded_rect(draw, [0, 0, canvas - 1, canvas - 1], radius, fill=CAL,
                     outline=CHUKUM, width=max(1, int(round(1 * SCALE))))

    ratio = 0.72 if maskable else 0.82
    mark_size = int(canvas * ratio)
    x = (canvas - mark_size) // 2
    y = (canvas - mark_size) // 2

    if size <= 32:
        # versión simplificada: solo villa (horizonte)
        draw_motivo(draw, x + mark_size / 2, y + mark_size / 2, mark_size * 0.8)
    else:
        draw_monogram(draw, x, y, mark_size)

    return img.resize((size, size), Image.LANCZOS)


def draw_pill(draw, x, y, text, font, fill=None, outline=None, text_fill=GRAFITO, pad_x=18):
    px = ss(pad_x)
    h = ss(44)
    tw = int(text_length(draw, text, font))
    bbox = text_bbox(draw, text, font)
    th = bbox[3] - bbox[1]
    box = [x, y, x + tw + 2 * px, y + h]
    rounded_rect(draw, box, h // 2, fill=fill if fill is not None else MURO,
                 outline=outline, width=max(1, ss(1.5)) if outline else 0)
    draw.text((x + px, y + (h - th) // 2 - bbox[1]), text, font=font, fill=text_fill)
    return x + tw + 2 * px


def wrap_lines(draw, text, font, max_width, max_lines=3):
    words, lines, current = text.split(), [], ""
    for w in words:
        test = (current + " " + w).strip()
        if text_length(draw, test, font) <= max_width:
            current = test
        else:
            if current:
                lines.append(current); current = w
            else:
                lines.append(w); current = ""
            if len(lines) == max_lines:
                break
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and " ".join(lines) != text:
        last = lines[-1]
        while last and text_length(draw, last + "…", font) > max_width:
            last = last[:-1]
        lines[-1] = last + "…"
    return lines


def make_alert_card(args):
    """Tarjeta de nueva propiedad / preventa."""
    width, height = ss(1200), ss(630)
    # fondo gradiente cal → arena
    img = Image.new("RGB", (width, height), CAL)
    draw = ImageDraw.Draw(img)
    for i in range(height):
        t = i / height
        c = tuple(int(CAL[k] + (ARENA[k] - CAL[k]) * t) for k in range(3))
        draw.line([(0, i), (width, i)], fill=c)

    # textura sutil
    try:
        noise = Image.effect_noise((max(1, width // 8), max(1, height // 8)), 22).convert("L")
        noise = noise.resize((width, height), Image.LANCZOS)
        overlay = Image.new("RGBA", (width, height), (*AMBAR, 0))
        overlay.putalpha(noise.point(lambda p: int(p * 0.05)))
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(img)
    except Exception:
        pass

    # marco
    draw.rectangle([ss(40), ss(40), ss(1160), ss(590)], outline=CHUKUM, width=max(1, ss(1)))

    # banda cenote superior (marca de preventa)
    draw.rectangle([ss(40), ss(40), ss(1160), ss(76)], fill=CENOTE_DK)
    f_status = load_font("mono", ss(12))
    draw.text((ss(68), ss(50)), "NUEVA PIEZA · PREVENTA", font=f_status, fill=CAL)
    draw.text((ss(1140), ss(50)), args.folio, font=f_status, fill=ARENA, anchor="ra")

    # monograma
    draw_monogram(draw, ss(100), ss(150), ss(180))

    # titular
    f_title = load_font("display", ss(58))
    lines = wrap_lines(draw, args.title, f_title, ss(820), max_lines=3)
    ty = ss(170)
    for line in lines:
        draw.text((ss(340), ty), line, font=f_title, fill=GRAFITO)
        ty += ss(70)

    # pills de características simuladas
    f_pill = load_font("mono", ss(16))
    x = ss(340)
    y = ss(420)
    pills = [("TULUM", CENOTE_DK), ("VILLA", CORAL_DK), ("620 m²", GRAFITO_2)]
    for label, color in pills:
        x = draw_pill(draw, x, y, label, f_pill, outline=CHUKUM, text_fill=color)
        x += ss(14)

    # footer
    f_mono = load_font("mono", ss(18))
    draw.line([ss(340), ss(500), ss(960), ss(500)], fill=CHUKUM, width=max(1, ss(1)))
    draw.text((ss(340), ss(530)), f"{args.channel} · {args.date}", font=f_mono, fill=GRAFITO_2)

    # watermark
    f_wm = load_font("display", ss(38))
    draw.text((ss(1160), ss(555)), "ALTUM", font=f_wm, fill=CHUKUM, anchor="ra")

    return img.resize((1200, 630), Image.LANCZOS)


def absolute_url(domain, base_path, filename):
    base = base_path.strip("/")
    domain = domain.rstrip("/")
    return f"{domain}/{base}/{filename}" if base else f"{domain}/{filename}"


def write_metadata(args, out_dir):
    if not args.web_root:
        return []
    web_root = ensure_dir(Path(args.web_root))
    written = []

    manifest = {
        "name": args.name,
        "short_name": args.short_name,
        "start_url": args.start_url,
        "scope": "/",
        "display": "standalone",
        "background_color": "#F7F4ED",
        "theme_color": "#0E6B7A",
        "icons": [
            {"src": absolute_url(args.domain, args.base_path, "android-chrome-192.png"),
             "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": absolute_url(args.domain, args.base_path, "android-chrome-512.png"),
             "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
            {"src": absolute_url(args.domain, args.base_path, "apple-touch-icon.png"),
             "sizes": "180x180", "type": "image/png"},
        ],
    }
    p = web_root / "site.webmanifest"
    p.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(p)

    robots = "User-agent: *\nDisallow: /api/v1/\nDisallow: /asesor/\n"
    if args.sitemap:
        robots += f"Sitemap: {args.sitemap}\n"
    p = web_root / "robots.txt"
    p.write_text(robots, encoding="utf-8")
    written.append(p)

    canonical = args.domain.rstrip("/") + "/"
    og = absolute_url(args.domain, args.base_path, "og-image.png")
    tw = absolute_url(args.domain, args.base_path, "twitter-card.png")
    f32 = absolute_url(args.domain, args.base_path, "favicon-32.png")
    f16 = absolute_url(args.domain, args.base_path, "favicon-16.png")
    ap = absolute_url(args.domain, args.base_path, "apple-touch-icon.png")
    man = args.domain.rstrip("/") + "/site.webmanifest"

    svg_link = ""
    if args.svg_favicon:
        svg_link = f'<link rel="icon" type="image/svg+xml" href="{escape(args.svg_favicon)}">\n'

    meta_html = f"""<!-- ALTUM SURESTE · Real Estate Caribe Mexicano — meta generado -->
<meta name="theme-color" content="#0E6B7A">
<link rel="manifest" href="{escape(man)}">
{svg_link}<link rel="icon" type="image/png" sizes="32x32" href="{escape(f32)}">
<link rel="icon" type="image/png" sizes="16x16" href="{escape(f16)}">
<link rel="apple-touch-icon" sizes="180x180" href="{escape(ap)}">
<link rel="canonical" href="{escape(canonical)}">

<meta property="og:type" content="website">
<meta property="og:site_name" content="{escape(args.short_name)}">
<meta property="og:title" content="{escape(args.name)}">
<meta property="og:description" content="{escape(args.description)}">
<meta property="og:url" content="{escape(canonical)}">
<meta property="og:image" content="{escape(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="ALTUM SURESTE — Real Estate Caribe Mexicano">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(args.name)}">
<meta name="twitter:description" content="{escape(args.description)}">
<meta name="twitter:image" content="{escape(tw)}">
<meta name="twitter:image:alt" content="ALTUM SURESTE — Real Estate Caribe Mexicano">
"""
    p = web_root / "meta-tags.html"
    p.write_text(meta_html, encoding="utf-8")
    written.append(p)
    return written


def print_summary(paths, title):
    print(f"\n🌴 {title}")
    print("─" * 58)
    total = 0
    for p in paths:
        s = p.stat().st_size
        total += s
        print(f"{p.name:<32} {s / 1024:>8.2f} KB")
    print("─" * 58)
    print(f"{'TOTAL':<32} {total / 1024:>8.2f} KB")
    print("✅ Capa raster lista. Supersampling 4× + LANCZOS.\n")


def run_static(args):
    out_dir = ensure_dir(Path(args.out))

    og = make_og(args.domain.split("//")[-1].rstrip("/"))
    og_p = out_dir / "og-image.png"; og.save(og_p, format="PNG", optimize=True)
    tw_p = out_dir / "twitter-card.png"; og.copy().save(tw_p, format="PNG", optimize=True)

    make_icon(180, False).save(out_dir / "apple-touch-icon.png", "PNG", optimize=True)
    make_icon(32, False).save(out_dir / "favicon-32.png", "PNG", optimize=True)
    make_icon(16, False).save(out_dir / "favicon-16.png", "PNG", optimize=True)
    make_icon(192, True).save(out_dir / "android-chrome-192.png", "PNG", optimize=True)
    make_icon(512, True).save(out_dir / "android-chrome-512.png", "PNG", optimize=True)

    ico = make_icon(48, False)
    ico.save(out_dir / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    paths = [
        out_dir / "og-image.png", out_dir / "twitter-card.png",
        out_dir / "apple-touch-icon.png", out_dir / "favicon-32.png",
        out_dir / "favicon-16.png", out_dir / "android-chrome-192.png",
        out_dir / "android-chrome-512.png", out_dir / "favicon.ico",
    ]
    paths.extend(write_metadata(args, out_dir))
    print_summary(paths, "ALTUM SURESTE — Static SEO / Social / PWA")


def run_alert(args):
    if not args.date:
        args.date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    out_path = Path(args.out)
    if out_path.suffix.lower() == ".png":
        ensure_dir(out_path.parent); target = out_path
    else:
        ensure_dir(out_path); target = out_path / "preventa-card.png"
    card = make_alert_card(args)
    card.save(target, format="PNG", optimize=True)
    print_summary([target], f"ALTUM — Preventa Card · {args.channel}")


def main():
    ap = argparse.ArgumentParser(
        description="ALTUM SURESTE raster forge — OG, Twitter, favicons, PWA y tarjetas de preventa."
    )
    ap.add_argument("--out", default="assets/altum-seo")
    ap.add_argument("--web-root", default=None)
    ap.add_argument("--domain", default="https://altumsureste.mx")
    ap.add_argument("--name", default="ALTUM SURESTE · Real Estate Caribe Mexicano")
    ap.add_argument("--short-name", default="ALTUM SURESTE")
    ap.add_argument("--description",
        default="Propiedades curadas en Riviera Maya, Mérida, Tulum, Holbox, Bacalar y Cozumel. Lujo silencioso, arquitectura contemporánea.")
    ap.add_argument("--base-path", default="/assets/altum-seo")
    ap.add_argument("--start-url", default="/")
    ap.add_argument("--sitemap", default="")
    ap.add_argument("--svg-favicon", default="")

    ap.add_argument("--alert", action="store_true", help="Genera tarjeta de nueva propiedad / preventa")
    ap.add_argument("--channel", default="Tulum")
    ap.add_argument("--severity", default="info")
    ap.add_argument("--title", default="Villa Altum Tulum · 4 recámaras con vista al cenote")
    ap.add_argument("--date", default="")
    ap.add_argument("--folio", default="ALT-2026-000000")

    args = ap.parse_args()
    if args.alert:
        run_alert(args)
    else:
        run_static(args)


if __name__ == "__main__":
    main()