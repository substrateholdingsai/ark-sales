#!/usr/bin/env python3
"""
Pipeline de Rescate, Verificación y Cuarentena Reversible de Leads (Futura Capital)
Versión 2.0 - Endurecido con Doble Score (Actionability vs Confidence) y Trazabilidad de Evidencia.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import random
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import phonenumbers
from rapidfuzz import fuzz

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ARK.FUTURA_ENRICH")

GENERIC_NAMES = {
    "clinica dental",
    "psicologa clinica",
    "psicologia clinica",
    "osteoporosis",
    "consultorio medico",
    "consultorio dental",
    "medico general",
    "laboratorio",
    "clinica medica",
    "dentista",
    "consultorio",
}

DISCARD_EMAILS = {
    "harvest.arksystems.local",
    "example.com",
    "noreply",
    "sincorreo",
    "noemail",
    "wixpress.com",
    "sentry.io",
    "cloudflare.com",
}


def clean_phone(raw: str) -> Optional[str]:
    """Valida y normaliza un teléfono a formato E.164 internacional para México (+52...)."""
    if not raw or not raw.strip():
        return None
    cleaned = re.sub(r"[^\d+]", "", raw.strip())
    try:
        parsed = phonenumbers.parse(cleaned, "MX")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    
    # Heurística para México si tiene 10 dígitos directos
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+52{digits}"
    elif len(digits) == 11 and digits.startswith("1"):  # +52 1 ...
        return f"+52{digits[1:]}"
    elif len(digits) == 12 and digits.startswith("52"):
        return f"+{digits}"
    return None


def extract_emails(text: str) -> List[str]:
    """Extrae emails reales descartando dominios placeholder y técnicos."""
    regex = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
    matches = re.findall(regex, text)
    valid = []
    for m in matches:
        m_lower = m.lower()
        if any(d in m_lower for d in DISCARD_EMAILS):
            continue
        if m_lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".svg", ".js", ".css")):
            continue
        valid.append(m)
    return list(dict.fromkeys(valid))


def extract_doctor_name(text: str) -> Optional[str]:
    """Identifica nombres con título médico en el texto o snippets."""
    regex = r"\b(?:Dr\.|Dra\.|Doctor|Doctora|Cirujano|Especialista)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3})\b"
    m = re.search(regex, text)
    if m:
        return m.group(0).strip()
    return None


class LeadEnricher:
    def __init__(self, serper_key: Optional[str] = None):
        self.serper_key = serper_key or os.getenv("SERPER_API_KEY")
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
            },
            timeout=20.0,
            follow_redirects=True,
        )

    async def close(self):
        await self.client.aclose()

    async def search_serper(self, query: str) -> List[Dict[str, Any]]:
        """Consulta Serper Places si está configurado."""
        if not self.serper_key:
            return []
        try:
            url = "https://google.serper.dev/places"
            res = await self.client.post(
                url,
                headers={"X-API-KEY": self.serper_key, "Content-Type": "application/json"},
                json={"q": query, "gl": "mx", "hl": "es"},
            )
            if res.status_code == 200:
                data = res.json()
                return data.get("places", [])
        except Exception as e:
            logger.warning(f"Error consultando Serper: {e}")
        return []

    async def search_doctoralia(self, account_name: str, city: Optional[str]) -> Dict[str, Any]:
        """Consulta directa en Doctoralia México."""
        clean_acc = re.sub(r"[^\w\s]", " ", account_name).strip()
        q = f"{clean_acc} {city or ''}".strip()
        url = f"https://www.doctoralia.com.mx/buscar?q={httpx.URL(q)}"
        res_data = {"profile_url": None, "doctor": None, "phone": None, "raw_phone": None}
        try:
            res = await self.client.get(url, timeout=15.0)
            if res.status_code == 200:
                html = res.text
                links = re.findall(r'href="(/clinicas/[^"]+|/medicos/[^"]+|/perfil/[^"]+)"', html)
                if links:
                    full_link = f"https://www.doctoralia.com.mx{links[0]}"
                    res_data["profile_url"] = full_link
                    prof_res = await self.client.get(full_link, timeout=12.0)
                    if prof_res.status_code == 200:
                        p_html = prof_res.text
                        phones = re.findall(r"(?:\+?52\s*)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}", p_html)
                        for ph in phones:
                            clean = clean_phone(ph)
                            if clean:
                                res_data["phone"] = clean
                                res_data["raw_phone"] = ph
                                break
                        res_data["doctor"] = extract_doctor_name(p_html)
        except Exception as e:
            logger.warning(f"Error consultando Doctoralia: {e}")
        return res_data

    async def search_duckduckgo(self, query: str) -> Tuple[str, List[str]]:
        """Búsqueda pública por DuckDuckGo HTML sin requerir API key."""
        search_url = f"https://html.duckduckgo.com/html/?q={httpx.URL(query)}"
        try:
            res = await self.client.get(search_url)
            if res.status_code == 200:
                html = res.text
                # Extraer enlaces
                links = re.findall(r'href="(https?://[^"&]+)"', html)
                cleaned_links = [l for l in links if not "duckduckgo.com" in l and not "yandex" in l]
                return html, cleaned_links
        except Exception as e:
            logger.warning(f"Error en DDG search: {e}")
        return "", []

    async def crawl_official_site(self, url: str) -> Dict[str, Any]:
        """Crawl ligero de una página web oficial encontrada."""
        data: Dict[str, Any] = {"phone": None, "emails": [], "whatsapp": None, "doctor": None}
        try:
            res = await self.client.get(url, timeout=12.0)
            if res.status_code == 200:
                html = res.text
                # WhatsApp
                wa_match = re.search(r"(?:wa\.me|api\.whatsapp\.com/send\?phone=)(\+?\d{10,13})", html)
                if wa_match:
                    data["whatsapp"] = clean_phone(wa_match.group(1))

                # Tel: link
                tel_match = re.search(r'href=["\']tel:([^"\']+)["\']', html)
                if tel_match:
                    data["phone"] = clean_phone(tel_match.group(1))

                data["emails"] = extract_emails(html)
                data["doctor"] = extract_doctor_name(html)
        except Exception:
            pass
        return data

    async def investigate_lead(self, account_name: str, city: Optional[str]) -> Dict[str, Any]:
        """Investigación en cascada para un lead."""
        normalized_city = city or "Mérida, Yucatán"
        query = f'"{account_name}" {normalized_city} telefono'.strip()

        evidence_items: List[Dict[str, Any]] = []
        found_data = {
            "phone": None,
            "raw_phone": None,
            "email": None,
            "whatsapp": None,
            "doctor_name": None,
            "website": None,
            "source_type": "unknown",
            "source_url": None,
        }

        # Nivel 1: Serper si hay API Key
        places = await self.search_serper(f"{account_name} {normalized_city}")
        if places:
            top = places[0]
            top_title = top.get("title", "")
            raw_phone = top.get("phoneNumber")
            website = top.get("website")
            source_url = f"https://www.google.com/maps/place/?q=place_id:{top.get('placeId')}" if top.get("placeId") else None

            sim = fuzz.token_set_ratio(top_title.lower(), account_name.lower())
            if sim >= 70:
                phone_norm = clean_phone(raw_phone)
                if phone_norm:
                    found_data["phone"] = phone_norm
                    found_data["raw_phone"] = raw_phone
                    evidence_items.append({
                        "field": "phone",
                        "raw": raw_phone,
                        "normalized": phone_norm,
                        "source_type": "google_places",
                        "source_url": source_url,
                        "confidence": int(sim),
                    })
                if website:
                    found_data["website"] = website
                    evidence_items.append({
                        "field": "website",
                        "raw": website,
                        "normalized": website,
                        "source_type": "google_places",
                        "source_url": source_url,
                        "confidence": int(sim),
                    })

        # Nivel 2: Doctoralia México directo
        if not found_data["phone"] or not found_data["website"]:
            doc_res = await self.search_doctoralia(account_name, city)
            if doc_res.get("phone") and not found_data["phone"]:
                found_data["phone"] = doc_res["phone"]
                found_data["raw_phone"] = doc_res.get("raw_phone") or doc_res["phone"]
                evidence_items.append({
                    "field": "phone",
                    "raw": doc_res.get("raw_phone") or doc_res["phone"],
                    "normalized": doc_res["phone"],
                    "source_type": "doctoralia",
                    "source_url": doc_res.get("profile_url"),
                    "confidence": 85,
                })
            if doc_res.get("profile_url") and not found_data["website"]:
                found_data["website"] = doc_res["profile_url"]
                evidence_items.append({
                    "field": "website",
                    "raw": doc_res["profile_url"],
                    "normalized": doc_res["profile_url"],
                    "source_type": "doctoralia",
                    "source_url": doc_res["profile_url"],
                    "confidence": 85,
                })
            if doc_res.get("doctor") and not found_data["doctor_name"]:
                found_data["doctor_name"] = doc_res["doctor"]
                evidence_items.append({
                    "field": "doctor_name",
                    "raw": doc_res["doctor"],
                    "normalized": doc_res["doctor"],
                    "source_type": "doctoralia",
                    "source_url": doc_res.get("profile_url"),
                    "confidence": 80,
                })

        # Nivel 3: DuckDuckGo HTML / Redes si aún falta teléfono o web
        if not found_data["phone"] or not found_data["website"]:
            html, links = await self.search_duckduckgo(query)
            if html:
                # Buscar teléfono en snippets de texto
                phone_candidates = re.findall(r"(?:\+?52\s*)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}", html)
                for pc in phone_candidates:
                    norm = clean_phone(pc)
                    if norm and not found_data["phone"]:
                        found_data["phone"] = norm
                        found_data["raw_phone"] = pc
                        evidence_items.append({
                            "field": "phone",
                            "raw": pc,
                            "normalized": norm,
                            "source_type": "search_snippet",
                            "source_url": f"https://html.duckduckgo.com/html/?q={query}",
                            "confidence": 65,
                        })
                        break

                # Buscar perfil de Doctoralia o web oficial en links
                for link in links:
                    if "doctoralia.com.mx/perfil/" in link or ("doctoralia.com.mx" in link and not "/buscar" in link):
                        found_data["website"] = link
                        evidence_items.append({
                            "field": "website",
                            "raw": link,
                            "normalized": link,
                            "source_type": "doctoralia",
                            "source_url": link,
                            "confidence": 75,
                        })
                        break
                    elif not any(x in link for x in ["facebook.com", "instagram.com", "linkedin.com", "inegi.org", "directorios"]):
                        if not found_data["website"]:
                            found_data["website"] = link
                            evidence_items.append({
                                "field": "website",
                                "raw": link,
                                "normalized": link,
                                "source_type": "official_website",
                                "source_url": link,
                                "confidence": 70,
                            })

                doc_name = extract_doctor_name(html)
                if doc_name and not found_data["doctor_name"]:
                    found_data["doctor_name"] = doc_name
                    evidence_items.append({
                        "field": "doctor_name",
                        "raw": doc_name,
                        "normalized": doc_name,
                        "source_type": "search_snippet",
                        "source_url": f"https://html.duckduckgo.com/html/?q={query}",
                        "confidence": 60,
                    })

        # Nivel 3: Si se encontró sitio web, hacer crawl ligero para rescatar correo y WhatsApp
        if found_data["website"] and ("http://" in found_data["website"] or "https://" in found_data["website"]):
            crawl_res = await self.crawl_official_site(found_data["website"])
            if crawl_res.get("whatsapp") and not found_data["whatsapp"]:
                found_data["whatsapp"] = crawl_res["whatsapp"]
                evidence_items.append({
                    "field": "whatsapp",
                    "raw": crawl_res["whatsapp"],
                    "normalized": crawl_res["whatsapp"],
                    "source_type": "official_website",
                    "source_url": found_data["website"],
                    "confidence": 85,
                })
            if crawl_res.get("emails"):
                first_email = crawl_res["emails"][0]
                if not found_data["email"]:
                    found_data["email"] = first_email
                    evidence_items.append({
                        "field": "email",
                        "raw": first_email,
                        "normalized": first_email,
                        "source_type": "official_website",
                        "source_url": found_data["website"],
                        "confidence": 80,
                    })

        # ── CÁLCULO DE SCORES (Actionability vs Confidence) ──
        # Actionability
        act_score = 0
        if found_data["phone"]:
            act_score += 50
        if found_data["email"]:
            act_score += 40
        if found_data["whatsapp"]:
            act_score += 30
        if found_data["doctor_name"]:
            act_score += 10
        if found_data["website"]:
            act_score += 10
        act_score = min(100, act_score)

        # Confidence
        acc_lower = account_name.lower().strip()
        conf_score = 50  # Base
        is_generic = acc_lower in GENERIC_NAMES or len(acc_lower.split()) <= 2
        if is_generic:
            conf_score -= 25
        else:
            conf_score += 15

        if city and city.strip() and city != "-":
            conf_score += 15

        if found_data["website"]:
            # Verificar si el dominio contiene alguna palabra de la razón social
            words = [w for w in acc_lower.split() if len(w) > 3 and w not in {"clinica", "consultorio", "dental", "especialidades"}]
            if any(w in found_data["website"].lower() for w in words):
                conf_score += 20
        
        conf_score = max(0, min(100, conf_score))

        # Clasificación final
        if act_score >= 40 and conf_score >= 60:
            decision = "enriched"
        elif act_score >= 40 and conf_score < 60:
            decision = "needs_review"
        else:
            decision = "quarantined"

        return {
            "decision": decision,
            "actionability_score": act_score,
            "confidence_score": conf_score,
            "data": found_data,
            "evidence": evidence_items,
        }


def get_candidate_leads(limit: int, tenant_id: str) -> List[Dict[str, Any]]:
    """Consulta los leads fantasma directamente desde Cloudflare D1 en formato JSON."""
    sql = (
        f"SELECT c.id as contact_id, c.account_id, c.name as contact_name, c.email, c.phone, "
        f"a.name as account_name, a.city, a.scian_code, a.tenant_id "
        f"FROM sales_contacts c JOIN sales_accounts a ON a.id = c.account_id "
        f"WHERE a.tenant_id = '{tenant_id}' "
        f"AND LOWER(c.email) LIKE '%@harvest.arksystems.local' "
        f"AND (c.phone IS NULL OR TRIM(c.phone) = '' OR c.phone = '-') "
        f"LIMIT {limit};"
    )

    cmd = f'npx wrangler d1 execute ark-sales-db --remote --json --command "{sql}"'
    env = os.environ.copy()
    env["CLOUDFLARE_ACCOUNT_ID"] = "ccab12c2e99a74d45eda626cb81c5c0c"

    logger.info(f"Consultando Cloudflare D1 para {tenant_id} (límite {limit})...")
    res = subprocess.run(cmd, capture_output=True, text=True, env=env, shell=True)

    stdout = res.stdout or ""
    if "[" in stdout and "]" in stdout:
        try:
            start = stdout.find("[")
            end = stdout.rfind("]") + 1
            data = json.loads(stdout[start:end])
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) and "results" in data[0]:
                results = data[0]["results"]
                if isinstance(results, list):
                    return results
        except Exception as e:
            logger.warning(f"Error parseando JSON de stdout: {e}")

    return []


def apply_d1_updates(results: List[Dict[str, Any]], run_id: str):
    """Aplica las actualizaciones de enriquecimiento, cuarentena y evidencia a Cloudflare D1."""
    env = os.environ.copy()
    env["CLOUDFLARE_ACCOUNT_ID"] = "ccab12c2e99a74d45eda626cb81c5c0c"

    logger.info(f"Aplicando actualizaciones a Cloudflare D1 para {len(results)} registros...")
    for item in results:
        contact_id = item["contact_id"]
        account_id = item["account_id"]
        tenant_id = item["tenant_id"]
        decision = item["decision"]
        act_score = item["actionability_score"]
        conf_score = item["confidence_score"]
        data = item["data"]

        if decision == "enriched":
            updates = []
            if data["phone"]:
                updates.append(f"phone = '{data['phone']}'")
                updates.append(f"raw_phone = '{data.get('raw_phone') or data['phone']}'")
            if data["email"]:
                updates.append(f"email = '{data['email']}'")
            if data["whatsapp"]:
                updates.append(f"whatsapp_url = '{data['whatsapp']}'")
            if data["doctor_name"]:
                updates.append(f"name = '{data['doctor_name']}'")
                updates.append("title = 'Titular / Director Médico'")

            updates.append("enrichment_status = 'enriched'")
            updates.append(f"actionability_score = {act_score}")
            updates.append(f"confidence_score = {conf_score}")
            updates.append(f"enrichment_run_id = '{run_id}'")
            updates.append("updated_at = CURRENT_TIMESTAMP")

            sql = f"UPDATE sales_contacts SET {', '.join(updates)} WHERE id = '{contact_id}';"
            subprocess.run(["npx", "wrangler", "d1", "execute", "ark-sales-db", "--remote", "--command", sql], env=env, shell=True)

        elif decision == "needs_review":
            sql = f"""
            UPDATE sales_contacts 
            SET enrichment_status = 'needs_review',
                actionability_score = {act_score},
                confidence_score = {conf_score},
                enrichment_run_id = '{run_id}',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = '{contact_id}';
            """
            subprocess.run(["npx", "wrangler", "d1", "execute", "ark-sales-db", "--remote", "--command", sql], env=env, shell=True)

        else:  # quarantined
            sql = f"""
            UPDATE sales_contacts 
            SET enrichment_status = 'quarantined',
                quarantined_at = CURRENT_TIMESTAMP,
                quarantine_reason = 'sin_contacto_digital_verificable',
                actionability_score = {act_score},
                confidence_score = {conf_score},
                enrichment_run_id = '{run_id}',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = '{contact_id}';
            """
            subprocess.run(["npx", "wrangler", "d1", "execute", "ark-sales-db", "--remote", "--command", sql], env=env, shell=True)

        # Insertar evidencias
        for ev in item.get("evidence", []):
            ev_id = f"ev_{int(time.time()*1000)}_{random.randint(100, 999)}"
            ins_ev = f"""
            INSERT INTO sales_enrichment_evidence (id, tenant_id, contact_id, account_id, source_type, source_url, field_name, raw_value, normalized_value, confidence_score, run_id)
            VALUES ('{ev_id}', '{tenant_id}', '{contact_id}', '{account_id}', '{ev['source_type']}', '{ev.get('source_url') or ''}', '{ev['field']}', '{ev.get('raw') or ''}', '{ev.get('normalized') or ''}', {ev.get('confidence', 0)}, '{run_id}');
            """
            subprocess.run(["npx", "wrangler", "d1", "execute", "ark-sales-db", "--remote", "--command", ins_ev], env=env, shell=True)


async def main():
    parser = argparse.ArgumentParser(description="Pipeline de Rescate y Cuarentena de Leads Futura Capital")
    parser.add_argument("--tenant", default="acc_futura_capital", help="Tenant ID a procesar")
    parser.add_argument("--limit", type=int, default=25, help="Límite de registros para piloto")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Modo simulación sin escribir en D1 (default)")
    parser.add_argument("--apply", action="store_true", help="Aplica escrituras reales en D1")
    parser.add_argument("--run-id", default=None, help="ID opcional para la corrida")
    args = parser.parse_args()

    # Si se pasa --apply, dry_run pasa a False
    is_dry_run = not args.apply

    run_id = args.run_id or f"futura_enrich_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    logger.info(f"=== INICIANDO PIPELINE: Run ID: {run_id} | Tenant: {args.tenant} | Modo: {'DRY-RUN (Simulación)' if is_dry_run else 'APPLY (Escritura Real)'} ===")

    candidates = get_candidate_leads(args.limit, args.tenant)
    if not candidates:
        logger.warning("No se encontraron leads pendientes para procesar.")
        return

    logger.info(f"Candidatos obtenidos para procesar: {len(candidates)}")
    if candidates:
        logger.info(f"Sample candidate keys: {list(candidates[0].keys())}")
        logger.info(f"Sample candidate data: {candidates[0]}")

    enricher = LeadEnricher()
    processed_results: List[Dict[str, Any]] = []

    rescatados = 0
    needs_review = 0
    cuarentena = 0

    reports_dir = Path("reports")
    reports_dir.mkdir(parents=True, exist_ok=True)
    report_file = reports_dir / f"{run_id}.jsonl"

    try:
        with report_file.open("w", encoding="utf-8") as rf:
            for idx, c in enumerate(candidates, 1):
                account_name = c.get("account_name") or "Sin Nombre"
                city = c.get("city")
                logger.info(f"[{idx}/{len(candidates)}] Investigando: '{account_name}' ({city or 'Sin Ciudad'})...")

                result = await enricher.investigate_lead(account_name, city)
                combined = {
                    "run_id": run_id,
                    "contact_id": c["contact_id"],
                    "account_id": c["account_id"],
                    "tenant_id": c["tenant_id"],
                    "account_name": account_name,
                    "city": city,
                    "decision": result["decision"],
                    "actionability_score": result["actionability_score"],
                    "confidence_score": result["confidence_score"],
                    "data": result["data"],
                    "evidence": result["evidence"],
                }

                processed_results.append(combined)
                rf.write(json.dumps(combined, ensure_ascii=False) + "\n")
                rf.flush()

                dec = result["decision"]
                if dec == "enriched":
                    rescatados += 1
                    logger.info(f"   --> RESCATADO: Tel: {result['data']['phone']} | Score: {result['actionability_score']}/{result['confidence_score']}")
                elif dec == "needs_review":
                    needs_review += 1
                    logger.info(f"   --> REVISIÓN REQUERIDA: Tel: {result['data']['phone']} | Score: {result['actionability_score']}/{result['confidence_score']}")
                else:
                    cuarentena += 1
                    logger.info(f"   --> CUARENTENA: Sin datos suficientes | Score: {result['actionability_score']}/{result['confidence_score']}")

                # Jitter respetuoso entre 1.0 y 2.0 segundos
                await asyncio.sleep(random.uniform(1.0, 2.0))

    finally:
        await enricher.close()

    total = len(candidates)
    pct_rescate = (rescatados / total * 100) if total else 0.0

    summary = {
        "run_id": run_id,
        "tenant_id": args.tenant,
        "total_procesados": total,
        "rescatados_enriquecidos": rescatados,
        "requieren_revision": needs_review,
        "enviados_a_cuarentena": cuarentena,
        "tasa_de_rescate_pct": round(pct_rescate, 1),
        "modo": "DRY-RUN (Simulación)" if is_dry_run else "APPLY (Actualizado en D1)",
        "reporte_jsonl": str(report_file),
    }

    print("\n" + "="*60)
    print("           RESUMEN OPERATIVO DEL PILOTO")
    print("="*60)
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print("="*60 + "\n")

    if not is_dry_run:
        apply_d1_updates(processed_results, run_id)
        logger.info("Cambios y evidencias persistidos exitosamente en Cloudflare D1.")
    else:
        logger.info("Modo Dry-Run completado: No se modificó ningún dato en D1. Revisa el reporte JSONL.")


if __name__ == "__main__":
    asyncio.run(main())
