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

