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
import math

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