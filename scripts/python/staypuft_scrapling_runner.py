# scripts/python/staypuft_scrapling_runner.py
"""
StayPuft Autonomous Research Runner con Scrapling Engine
========================================================
Propósito:
  Investiga prospectos (despachos contables, clínicas, empresas) utilizando
  el motor de extracción y parsing Scrapling. Localiza teléfonos, WhatsApp
  verificable (formato E.164 IFT), software contable y tamaño de empresa.

Características:
  - Extracción de enlaces profundos 'wa.me/' y 'tel:'.
  - Normalización estricta IFT de 10 dígitos (+52...).
  - Detección de tecnologías fiscales (Contpaqi, Aspel, SAT, CFDI).
  - Destilación de texto limpio y seguro sin scripts ni anuncios.
  - Reporte compatible con la migración 0026 y acceso total StayPuft.
"""

import os
import re
import sys
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
import httpx
from scrapling import Selector, Fetcher

# ------------------------------------------------------------------------------
# LOGGING PROFESIONAL
# ------------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("ARK.STAYPUFT_SCRAPLING")

# ------------------------------------------------------------------------------
# CONFIGURACIÓN
# ------------------------------------------------------------------------------
ARK_SALES_API = os.getenv("ARK_SALES_API", "https://sales.arksystems.site/api/internal")
STAYPUFT_API_KEY = os.getenv("STAYPUFT_API_KEY", "staypuft_live_prod_key_77a91b2c4e6f8d0")
DEFAULT_TIMEOUT = float(os.getenv("SCRAPLING_TIMEOUT", "20.0"))

TECH_KEYWORDS = ["contpaqi", "aspel", "microsip", "coi", "noi", "adminpaq", "cfdi", "sat", "sap", "odoo"]
ROLE_KEYWORDS = ["socio", "directora", "director", "fundador", "titular", "contador", "contadora", "fiscalista"]


# ------------------------------------------------------------------------------
# NORMALIZADOR TELEFÓNICO IFT (REGLA CANÓNICA)
# ------------------------------------------------------------------------------
def normalize_mexican_phone(raw: Optional[str]) -> Tuple[Optional[str], bool]:
    """
    Normaliza y valida números nacionales de México según norma IFT:
    - 10 dígitos nacionales exactos.
    - No inicia con '0' ni '1'.
    - Normaliza prefijos internacionales +52 y 521 -> +52{10_digitos}.
    Retorna (formatted_phone_or_null, is_valid).
    """
    if not raw or not isinstance(raw, str):
        return None, False

    cleaned = raw.strip()
    if not cleaned or cleaned.lower() in ("-", "null", "none", "n/a"):
        return None, False

    digits = re.sub(r"\D", "", cleaned)
    if not digits:
        return None, False

    national_digits = ""
    if len(digits) == 13 and digits.startswith("521"):
        national_digits = digits[3:]
    elif len(digits) == 12 and digits.startswith("52"):
        national_digits = digits[2:]
    elif len(digits) == 10:
        national_digits = digits
    else:
        return None, False

    if len(national_digits) != 10 or national_digits.startswith("0") or national_digits.startswith("1"):
        return None, False

    return f"+52{national_digits}", True


# ------------------------------------------------------------------------------
# MOTOR DE EXTRACCIÓN SCRAPLING
# ------------------------------------------------------------------------------
class ScraplingProspectResearcher:
    def __init__(self, api_url: str = ARK_SALES_API, api_key: str = STAYPUFT_API_KEY):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.http_client = httpx.Client(
            base_url=self.api_url,
            headers={
                "X-StayPuft-Key": self.api_key,
                "Content-Type": "application/json",
                "User-Agent": "ArkSystems-StayPuft/2.0 (Autonomous B2B Researcher)"
            },
            timeout=DEFAULT_TIMEOUT
        )
        self.web_client = httpx.Client(
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "es-MX,es;q=0.9,en;q=0.8"
            },
            follow_redirects=True,
            timeout=DEFAULT_TIMEOUT
        )

    def extract_from_html(self, html_text: str, source_url: str = "") -> Dict[str, Any]:
        """
        Aplica selectores Scrapling para extraer enlaces WhatsApp, teléfonos,
        software contable y tamaño.
        """
        sel = Selector(content=html_text, url=source_url or "", adaptive=True)

        found_whatsapp = None
        fuente_telefono = "ninguno"
        telefono_url = source_url or None

        # 1. Buscar enlaces con protocolo wa.me o whatsapp.com
        wa_nodes = sel.css('a[href*="wa.me"]::attr(href)')
        wa_nodes += sel.css('a[href*="whatsapp.com/send"]::attr(href)')
        wa_nodes += sel.css('a[href*="api.whatsapp.com"]::attr(href)')
        wa_links = [getattr(n, "text", str(n)) for n in wa_nodes]

        for link in wa_links:
            # Extraer posibles dígitos del link
            match = re.search(r"(?:phone=|wa\.me/|send\?phone=)([0-9+]+)", link)
            if match:
                phone_candidate, is_valid = normalize_mexican_phone(match.group(1))
                if is_valid:
                    found_whatsapp = phone_candidate
                    fuente_telefono = "website"
                    telefono_url = link
                    break

        # 2. Si no hubo wa.me, buscar enlaces tel:
        found_phone = found_whatsapp
        if not found_phone:
            tel_nodes = sel.css('a[href^="tel:"]::attr(href)')
            tel_links = [getattr(n, "text", str(n)) for n in tel_nodes]
            for tlink in tel_links:
                raw_tel = tlink.replace("tel:", "").strip()
                phone_candidate, is_valid = normalize_mexican_phone(raw_tel)
                if is_valid:
                    found_phone = phone_candidate
                    fuente_telefono = "website"
                    telefono_url = tlink
                    break

        # 3. Extraer texto limpio para heurística
        text_nodes = sel.css("p::text, span::text, div::text, li::text, h1::text, h2::text, h3::text")
        all_text = " ".join([getattr(n, "text", str(n)) for n in text_nodes]).lower()

        # Si aún no hay teléfono, buscar patrones telefónicos mexicanos de 10 dígitos en el texto
        if not found_phone:
            # Patrones comunes: (999) 123 4567, 999-123-4567, 999 123 4567
            phone_matches = re.findall(r"(?:(?:\+?52\s*)?(?:\(?\d{2,3}\)?[\s.-]*)?\d{3,4}[\s.-]*\d{4})", all_text)
            for pm in phone_matches:
                p_cand, is_valid = normalize_mexican_phone(pm)
                if is_valid:
                    found_phone = p_cand
                    fuente_telefono = "website"
                    break

        # 4. Detección de Tecnologías Contables / Fiscales
        detected_tech = [tech for tech in TECH_KEYWORDS if tech in all_text]

        # 5. Estimación de Tamaño
        role_hits = sum(1 for role in ROLE_KEYWORDS if role in all_text)
        if role_hits >= 6:
            estimated_size = "21-50"
        elif role_hits >= 3:
            estimated_size = "6-20"
        else:
            estimated_size = "1-5"

        is_wa_valid = bool(found_whatsapp and found_whatsapp.startswith("+52") and len(found_whatsapp) == 13)

        return {
            "telefono": found_phone,
            "whatsapp": found_whatsapp,
            "whatsapp_valid": is_wa_valid,
            "fuente_telefono": fuente_telefono,
            "telefono_url": telefono_url,
            "software_detectado": detected_tech,
            "tamano": estimated_size,
            "confidence": 90 if (found_whatsapp and detected_tech) else 75 if found_phone else 60
        }

    def research_firm(self, firm_name: str, city: str = "Mérida, Yucatán", website: Optional[str] = None) -> Dict[str, Any]:
        """
        Ejecuta el ciclo de investigación para un despacho o empresa.
        """
        logger.info(f"🔎 Investigando despacho '{firm_name}' en {city}...")

        # A) Si tenemos website directo, descargamos con Scrapling
        if website and website.startswith("http"):
            try:
                logger.info(f"🌐 Extrayendo sitio web oficial: {website}")
                res = self.web_client.get(website)
                if res.status_code == 200:
                    data = self.extract_from_html(res.text, source_url=website)
                    if data.get("whatsapp") or data.get("telefono"):
                        return data
            except Exception as e:
                logger.warning(f"⚠️ Error al acceder al website oficial: {e}")

        # B) Búsqueda en DuckDuckGo HTML sin bloquearse
        query = f'"{firm_name}" {city} telefono whatsapp contadores'
        search_url = f"https://html.duckduckgo.com/html/?q={httpx.URL(query).raw_path.decode()}"
        try:
            logger.info(f"🦆 Consultando motor de búsqueda: {query}")
            res = self.web_client.get(search_url)
            if res.status_code == 200:
                data = self.extract_from_html(res.text, source_url=search_url)
                if data.get("fuente_telefono") == "website":
                    data["fuente_telefono"] = "directorio"
                return data
        except Exception as e:
            logger.error(f"❌ Error en búsqueda web: {e}")

        return {
            "telefono": None,
            "whatsapp": None,
            "whatsapp_valid": False,
            "fuente_telefono": "ninguno",
            "telefono_url": None,
            "software_detectado": [],
            "tamano": "1-5",
            "confidence": 50
        }

    def process_lead(self, lead_id: str, firm_name: str, city: str = "Mérida, Yucatán", website: Optional[str] = None) -> bool:
        """
        Investiga un lead y reporta los datos a Ark Sales Worker.
        """
        result = self.research_firm(firm_name, city=city, website=website)

        payload = {
            "tamano_estimado": result["tamano"],
            "tamano": result["tamano"],
            "telefono": result["telefono"],
            "whatsapp": result["whatsapp"],
            "whatsapp_valid": result["whatsapp_valid"],
            "fuente_telefono": result["fuente_telefono"],
            "telefono_url": result["telefono_url"],
            "software_detectado": result["software_detectado"],
            "confianza": result["confidence"],
            "resumen": f"Investigación autónoma StayPuft + Scrapling: Tel {result['telefono'] or 'N/D'}, WhatsApp {result['whatsapp'] or 'N/D'}, Software {', '.join(result['software_detectado']) or 'N/D'}."
        }

        try:
            enrich_url = f"/leads/{lead_id}/enrich"
            res = self.http_client.post(enrich_url, json=payload)
            if res.status_code == 200:
                logger.info(f"✅ Lead '{lead_id}' enriquecido exitosamente. WhatsApp: {result['whatsapp'] or 'No hallado'}")
                return True
            else:
                logger.error(f"❌ Error al enriquecer lead '{lead_id}': HTTP {res.status_code} - {res.text}")
                return False
        except Exception as e:
            logger.error(f"💥 Error al comunicar con Worker Ark Sales: {e}")
            return False

    def batch_enrich_cohort(self, cohort_slug: str = "ark_ledger_despachos", limit: int = 5) -> Dict[str, Any]:
        """
        Consulta leads pendientes sin WhatsApp de la cohorte en vivo y los enriquece.
        """
        logger.info(f"📋 Consultando cohorte '{cohort_slug}' (sin_whatsapp=true, limit={limit})...")
        try:
            res = self.http_client.get(f"/leads?cohort={cohort_slug}&sin_whatsapp=true&limit={limit}")
            if res.status_code != 200:
                logger.error(f"❌ Error al consultar leads: HTTP {res.status_code} - {res.text}")
                return {"success": False, "error": res.text}
            data = res.json()
            leads = data.get("leads", [])
            logger.info(f"🎯 Se obtuvieron {len(leads)} prospectos para enriquecer.")

            summary = {"processed": 0, "enriched_with_whatsapp": 0, "failed": 0}
            for lead in leads:
                lead_id = lead["lead_id"]
                nombre = lead["nombre"]
                ciudad = lead.get("ciudad") or "Mérida, Yucatán"
                summary["processed"] += 1
                logger.info(f"[{summary['processed']}/{len(leads)}] Procesando {lead_id}: {nombre}")
                ok = self.process_lead(lead_id, nombre, city=ciudad)
                if ok:
                    summary["enriched_with_whatsapp"] += 1
                else:
                    summary["failed"] += 1
            return {"success": True, "summary": summary}
        except Exception as e:
            logger.error(f"💥 Error en batch_enrich_cohort: {e}")
            return {"success": False, "error": str(e)}


# ------------------------------------------------------------------------------
# PUNTO DE ENTRADA CLI
# ------------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="StayPuft Scrapling Researcher CLI")
    parser.add_argument("--lead-id", help="ID del lead a enriquecer en Ark Sales")
    parser.add_argument("--firm-name", help="Razón social o nombre comercial del despacho")
    parser.add_argument("--city", default="Mérida, Yucatán", help="Plaza o ciudad")
    parser.add_argument("--website", help="URL del sitio web del prospecto")
    parser.add_argument("--batch-cohort", help="Enriquecer lote de leads de una cohorte (ej. ark_ledger_despachos)")
    parser.add_argument("--limit", type=int, default=5, help="Límite del lote")
    parser.add_argument("--test-html", action="store_true", help="Ejecutar prueba de parseo local")

    args = parser.parse_args()

    researcher = ScraplingProspectResearcher()

    if args.test_html:
        sample_html = """
        <html>
          <body>
            <h1>Despacho Contable Maya Peninsular</h1>
            <p>Especialistas en auditoría SAT y asesoría fiscal.</p>
            <p>Utilizamos sistemas Contpaqi y Aspel para tu contabilidad.</p>
            <a href="https://wa.me/529991234567">Envíanos un WhatsApp directo</a>
            <p>Teléfono de oficina: (999) 920-1122</p>
          </body>
        </html>
        """
        extracted = researcher.extract_from_html(sample_html, "https://despachomaya.com")
        print("\n=== Resultado de Prueba Scrapling Extractor ===")
        print(json.dumps(extracted, indent=2, ensure_ascii=False))
        sys.exit(0)

    if args.batch_cohort:
        res = researcher.batch_enrich_cohort(cohort_slug=args.batch_cohort, limit=args.limit)
        print("\n=== Resumen de Enriquecimiento por Lote ===")
        print(json.dumps(res, indent=2, ensure_ascii=False))
        sys.exit(0 if res.get("success") else 1)

    if args.lead_id and args.firm_name:
        success = researcher.process_lead(args.lead_id, args.firm_name, city=args.city, website=args.website)
        sys.exit(0 if success else 1)

    print("Uso: python staypuft_scrapling_runner.py --test-html | --batch-cohort ark_ledger_despachos --limit 5 | --lead-id ID --firm-name 'Nombre'")
