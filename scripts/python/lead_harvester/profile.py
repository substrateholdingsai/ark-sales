"""HTTP Profiling gratuito (sin LLM)."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

import httpx

PATS_SOFTWARE = {
    "CONTPAQi": r"contpaq",
    "COI": r"\bcoi\b",
    "Aspel": r"aspel",
    "Shopify": r"shopify",
    "WooCommerce": r"woocommerce",
    "WordPress": r"wp-content|wordpress",
}
PATS_DOLOR = {
    "DOLOR_SAT": r"\bsat\b|multas.*sat|contingencia.*fiscal",
    "DOLOR_MOROSIDAD": r"cartera.*vencida|morosidad|cobranza",
    "DOLOR_CFDI": r"cfdi|facturaci[oó]n.*electr[oó]nica|timbrado",
}
PATS_FUTURA = {
    "SENAL_BROKER_INMOBILIARIO": r"preventa|lotes.*inversi[oó]n|asesor.*inmobiliario|\bampi\b|bienes.*ra[ií]ces|desarrollos.*yucat[aá]n",
    "SENAL_SALUD_ESPECIALISTA": r"especialidades.*m[eé]dicas|cl[ií]nica|cirug[ií]a|consultorio.*m[eé]dico|hospital|laboratorio.*cl[ií]nico",
    "SENAL_LOGISTICA_CEDIS": r"bodega.*industrial|\bcedis\b|almacenaje|log[ií]stica|distribuci[oó]n|puerto.*progreso|parque.*industrial|carga.*pesada",
    "SENAL_INVERSION_PATRIMONIAL": r"plusval[ií]a|rendimiento|rentas.*vacacionales|fractional|patrimonio|hotel.*boutique|airbnb",
}
PATS_TAMANO = {
    "1-5": r"microempresa|1.*a.*5.*empleados",
    "6-20": r"peque[nñ]a.*empresa|6.*a.*20.*empleados",
    "21-50": r"mediana.*empresa|21.*a.*50.*empleados",
    "50+": r"gran.*empresa|m[aá]s.*de.*50.*empleados|corporativo",
}

RE_WHATSAPP = re.compile(
    r"(?:wa\.me/|api\.whatsapp\.com/send\?[^\"'>]*phone=)\+?(\d{10,13})",
    re.IGNORECASE,
)
RE_TEL = re.compile(r"href=[\"']tel:([+\d\-\s()]{10,20})[\"']", re.IGNORECASE)
RE_MAILTO = re.compile(
    r"href=[\"']mailto:([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)[\"']",
    re.IGNORECASE,
)


@dataclass
class ProfileResult:
    dominio: str
    software_usado: list[str] = field(default_factory=list)
    senales_dolor: list[str] = field(default_factory=list)
    senales_futura: list[str] = field(default_factory=list)
    telefonos_detectados: list[str] = field(default_factory=list)
    emails_detectados: list[str] = field(default_factory=list)
    tamano_estimado: str = "desconocido"
    observaciones: list[dict] = field(default_factory=list)
    errores: list[str] = field(default_factory=list)


class HTTPProfiler:
    def __init__(self, timeout: float = 10.0):
        self.client = httpx.AsyncClient(timeout=timeout, follow_redirects=True)

    async def profile_company(self, dominio: str) -> ProfileResult:
        res = ProfileResult(dominio=dominio)
        try:
            html = await self._fetch(f"https://{dominio}")
            res.software_usado = self._detect(html, PATS_SOFTWARE)
            res.senales_dolor = self._detect(html, PATS_DOLOR)
            res.senales_futura = self._detect(html, PATS_FUTURA)
            res.telefonos_detectados = self._extract_phones(html)
            res.emails_detectados = self._extract_emails(html)
            res.tamano_estimado = self._tamano(html) or "desconocido"
            for sw in res.software_usado:
                res.observaciones.append({
                    "signal_code": "SOFTWARE_CONTABLE",
                    "value_text": sw,
                    "confidence": 0.9,
                    "evidence_url": f"https://{dominio}",
                })
            for d in res.senales_dolor:
                res.observaciones.append({
                    "signal_code": d,
                    "value_text": "Detectado en homepage",
                    "confidence": 0.8,
                    "evidence_url": f"https://{dominio}",
                })
            for sf in res.senales_futura:
                res.observaciones.append({
                    "signal_code": sf,
                    "value_text": "Detectado en sitio web corporativo",
                    "confidence": 0.85,
                    "evidence_url": f"https://{dominio}",
                })
            for phone in res.telefonos_detectados[:2]:
                res.observaciones.append({
                    "signal_code": "WHATSAPP_CORPORATIVO",
                    "value_text": phone,
                    "confidence": 0.95,
                    "evidence_url": f"https://{dominio}",
                })
            for mail in res.emails_detectados[:2]:
                res.observaciones.append({
                    "signal_code": "EMAIL_CORPORATIVO",
                    "value_text": mail,
                    "confidence": 0.95,
                    "evidence_url": f"https://{dominio}",
                })
            if res.tamano_estimado != "desconocido":
                res.observaciones.append({
                    "signal_code": "TAMANO_EMPLEADOS",
                    "value_text": res.tamano_estimado,
                    "confidence": 0.7,
                    "evidence_url": f"https://{dominio}",
                })
        except Exception as e:
            res.errores.append(str(e))
        return res

    async def _fetch(self, url: str) -> str:
        try:
            r = await self.client.get(url, headers={"User-Agent": "ArkSales-Harvester/1.0"})
            r.raise_for_status()
            return r.text
        except Exception:
            return ""

    def _detect(self, html: str, pats: dict) -> list[str]:
        low = html.lower()
        return [k for k, p in pats.items() if re.search(p, low, re.IGNORECASE)]

    def _extract_phones(self, html: str) -> list[str]:
        found: list[str] = []
        for m in RE_WHATSAPP.findall(html):
            digits = re.sub(r"\D", "", m)
            if len(digits) >= 10 and digits not in found:
                found.append(digits)
        for m in RE_TEL.findall(html):
            digits = re.sub(r"\D", "", m)
            if len(digits) >= 10 and digits not in found:
                found.append(digits)
        return found

    def _extract_emails(self, html: str) -> list[str]:
        found: list[str] = []
        for m in RE_MAILTO.findall(html):
            clean = m.strip().lower()
            if clean and clean not in found:
                found.append(clean)
        return found

    def _tamano(self, html: str) -> Optional[str]:
        low = html.lower()
        for k, p in PATS_TAMANO.items():
            if re.search(p, low, re.IGNORECASE):
                return k
        return None

    async def close(self):
        await self.client.aclose()
