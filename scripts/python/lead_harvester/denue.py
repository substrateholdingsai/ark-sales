"""DENUE (INEGI) harvester."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import AsyncIterator, Optional

import httpx

from .base import BaseHarvester
from .models import RawLead

BASE_URL = "https://www.inegi.org.mx/app/api/denue/v1/consulta/"

PROFILES_SCIAN: dict[str, list[str]] = {
    "ark": ["541210", "531110", "531210", "522250", "561490"],
    "futura_capital": [
        "531210", "531311", "523920",
        "621111", "621112", "621211", "621511", "622111",
        "484111", "484121", "493111", "488511",
        "721111", "721190", "531110", "551110",
    ],
    "ark_ledger": [
        "541211",  # Despachos de contabilidad y auditoría
        "541212",  # Auditoría para efectos fiscales
        "541219",  # Otros servicios de contabilidad y teneduría de libros
        "541110",  # Bufetes jurídicos y asesoría fiscal
        "561490",  # Agencias de cobranza y servicios de nómina/maquila
    ],
}

PROFILES_ENTIDADES: dict[str, list[str]] = {
    "ark": ["0"],
    "futura_capital": ["31", "09", "19", "14", "23"],
    "ark_ledger": ["0"],
}

# Palabras clave y coordenadas estratégicas para Futura Capital en Yucatán
FUTURA_GEO_CLUSTERS = [
    # Mérida Norte (Zona Médica Faro del Mayab / Christus Muguerza / MB Medical Tower / Temozón)
    {"query": "clinica", "coords": "21.0185,-89.6123", "radio": 5000, "scian_default": "621111"},
    {"query": "medica", "coords": "21.0421,-89.6013", "radio": 5000, "scian_default": "621112"},
    {"query": "consultorio", "coords": "21.0421,-89.6013", "radio": 5000, "scian_default": "621111"},
    {"query": "inmobiliaria", "coords": "21.0340,-89.5980", "radio": 5000, "scian_default": "531210"},
    {"query": "bienes raices", "coords": "21.0185,-89.6123", "radio": 5000, "scian_default": "531210"},
    # Corredor Tamanché / Mérida-Progreso (Logistic Park)
    {"query": "logistica", "coords": "21.1349,-89.6458", "radio": 5000, "scian_default": "493111"},
    {"query": "bodega", "coords": "21.1349,-89.6458", "radio": 5000, "scian_default": "493111"},
    # Puerto de Progreso (Logística Portuaria y Autotransporte)
    {"query": "transporte", "coords": "21.2812,-89.6650", "radio": 5000, "scian_default": "484111"},
    {"query": "almacen", "coords": "21.2812,-89.6650", "radio": 5000, "scian_default": "493111"},
    {"query": "aduana", "coords": "21.2812,-89.6650", "radio": 5000, "scian_default": "488511"},
]

# Palabras clave y coordenadas estratégicas para Ark Ledger (Despachos Contables y Fiscalistas)
ARK_LEDGER_GEO_CLUSTERS = [
    # CDMX — Benito Juárez / Insurgentes Sur / Del Valle
    {"query": "despacho contable", "coords": "19.3850,-99.1650", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.3732,-99.1793", "radio": 5000, "scian_default": "541211"},
    # CDMX — Cuauhtémoc / Reforma / Polanco
    {"query": "auditoria fiscal", "coords": "19.4326,-99.1550", "radio": 5000, "scian_default": "541212"},
    {"query": "asesoria fiscal", "coords": "19.4335,-99.1950", "radio": 5000, "scian_default": "541110"},
    # Guadalajara & Zapopan — Puerta de Hierro / Providencia
    {"query": "despacho contable", "coords": "20.6950,-103.3850", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "20.7100,-103.4120", "radio": 5000, "scian_default": "541211"},
    # Monterrey & San Pedro Garza García — Valle Oriente / Obispado
    {"query": "despacho contable", "coords": "25.6570,-100.3650", "radio": 5000, "scian_default": "541211"},
    {"query": "contabilidad", "coords": "25.6710,-100.3400", "radio": 5000, "scian_default": "541211"},
    {"query": "asesoria fiscal", "coords": "25.6420,-100.3250", "radio": 5000, "scian_default": "541110"},
    # Mérida — Paseo Montejo / Altabrisa
    {"query": "despacho contable", "coords": "20.9850,-89.6180", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "21.0185,-89.5850", "radio": 5000, "scian_default": "541211"},
    # Querétaro — Centro Sur / Bernardo Quintana
    {"query": "despacho contable", "coords": "20.5930,-100.3920", "radio": 5000, "scian_default": "541211"},
    # Puebla — Angelópolis / Juárez
    {"query": "despacho contable", "coords": "19.0300,-98.2350", "radio": 5000, "scian_default": "541211"},
]


class DenueHarvester(BaseHarvester):
    source_name = "denue"
    rate_limit = 2.0

    def __init__(
        self,
        token: Optional[str] = None,
        fixture_path: Optional[str] = None,
        profile: str = "ark",
        entidades: Optional[list[str]] = None,
        page_size: int = 100,
    ) -> None:
        super().__init__()
        self.token = token or os.getenv("INEGI_TOKEN", "")
        self.fixture_path = fixture_path or os.getenv("DENUE_FIXTURE_PATH")
        self.profile = profile if profile in PROFILES_SCIAN else "ark"
        self.entidades = entidades or PROFILES_ENTIDADES.get(self.profile, ["0"])
        self.page_size = max(1, page_size)

    async def health_check(self) -> bool:
        if self.fixture_path:
            return Path(self.fixture_path).exists()
        return bool(self.token)

    async def harvest(self) -> AsyncIterator[RawLead]:
        if self.fixture_path:
            async for lead in self._from_fixture():
                yield lead
            return
        async for lead in self._from_api():
            yield lead

    async def _from_fixture(self) -> AsyncIterator[RawLead]:
        data = json.loads(Path(self.fixture_path).read_text(encoding="utf-8"))
        for item in data:
            yield self._normalize(item)

    async def _from_api(self) -> AsyncIterator[RawLead]:
        if not self.token:
            raise RuntimeError("INEGI_TOKEN not set")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            if self.profile in ("futura_capital", "ark_ledger"):
                # Consulta geográfica con endpoints probados y optimizados
                clusters = FUTURA_GEO_CLUSTERS if self.profile == "futura_capital" else ARK_LEDGER_GEO_CLUSTERS
                seen_ids: set[str] = set()
                for cluster in clusters:
                    await self._throttle()
                    q = cluster["query"]
                    coords = cluster["coords"]
                    radio = cluster["radio"]
                    scian_def = cluster["scian_default"]
                    url = f"{BASE_URL}Buscar/{q}/{coords}/{radio}/{self.token}"
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            continue
                        payload = resp.json()
                        if not isinstance(payload, list):
                            continue
                        for item in payload:
                            lead_key = item.get("CLEE") or item.get("Id") or f"{item.get('Nombre')}_{item.get('Telefono')}"
                            if lead_key in seen_ids:
                                continue
                            seen_ids.add(lead_key)
                            yield self._normalize(item, scian_def)
                    except Exception:
                        continue
            else:
                target_scians = PROFILES_SCIAN.get(self.profile, PROFILES_SCIAN["ark"])
                for scian in target_scians:
                    await self._throttle()
                    url = f"{BASE_URL}BuscarAreaAct/{scian}/0/0/1/{self.page_size}/{self.token}"
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            continue
                        payload = resp.json()
                        if not isinstance(payload, list):
                            continue
                        for item in payload:
                            yield self._normalize(item, scian)
                    except Exception:
                        continue

    def _normalize(self, item: dict, scian: Optional[str] = None) -> RawLead:
        code = scian or item.get("Codigo_Actividad") or item.get("scian") or item.get("Clase_actividad")
        raw_tel = (item.get("Telefono") or item.get("telefono") or "").strip() or None
        raw_email = (item.get("Correo_e") or item.get("email") or "").strip() or None
        if self.profile == "futura_capital":
            tenant_id = "acc_futura_capital"
        elif self.profile == "ark_ledger":
            tenant_id = "acc_ark_ledger"
        else:
            tenant_id = item.get("tenant_id")
        return RawLead(
            razon_social=item.get("Nombre") or item.get("razon_social", ""),
            rfc=item.get("RFC"),
            actividad=item.get("Actividad") or item.get("actividad") or item.get("Nombre_Act") or "",
            scian_code=code,
            empleados_rango=item.get("Estrato") or item.get("empleados_rango"),
            ciudad=item.get("Municipio") or item.get("ciudad"),
            estado=item.get("Entidad") or item.get("estado"),
            lat=float(item["Latitud"]) if item.get("Latitud") else item.get("lat"),
            lon=float(item["Longitud"]) if item.get("Longitud") else item.get("lon"),
            sitio_web=item.get("Sitio_Web") or item.get("sitio_web"),
            telefono=raw_tel,
            email=raw_email,
            tenant_id=tenant_id,
            source="denue",
            raw=item,
        )
