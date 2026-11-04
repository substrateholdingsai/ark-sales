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
        "621111", "621112", "621211", "621511", "622111", "621491", "621399",
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

# Palabras clave y coordenadas estratégicas para Futura Capital en Quintana Roo y Riviera Maya (Turismo Médico & Médicos Americanos)
FUTURA_GEO_CLUSTERS = [
    # 1. Cancún — Zona Médica Hospitalaria (Galenia / Amerimed / Hospiten / Av. Bonampak)
    {"query": "cirugia plastica", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621112"},
    {"query": "clinica", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621111"},
    {"query": "dental", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621211"},
    {"query": "bariatrica", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621112"},
    {"query": "fertilidad", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621491"},

    # 2. Cancún — Puerto Cancún & Zona Hotelera (Turismo Médico Internacional & Estética)
    {"query": "dental clinic", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "621211"},
    {"query": "plastic surgery", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "621112"},
    {"query": "medical center", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "622111"},
    {"query": "estetica", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "621399"},

    # 3. Playa del Carmen — Corredor Turístico & Hospiten Riviera Maya
    {"query": "dental", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621211"},
    {"query": "cirugia plastica", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621112"},
    {"query": "clinica", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621111"},
    {"query": "dermatologia", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621112"},

    # 4. Tulum — Aldea Zamá / La Veleta / Wellness Corredor
    {"query": "clinica", "coords": "20.2100,-87.4650", "radio": 4000, "scian_default": "621111"},
    {"query": "wellness", "coords": "20.2100,-87.4650", "radio": 4000, "scian_default": "621399"},
    {"query": "dental", "coords": "20.2100,-87.4650", "radio": 4000, "scian_default": "621211"},

    # 5. Cozumel — Zona San Miguel / Costamed
    {"query": "clinica", "coords": "20.5050,-86.9500", "radio": 4000, "scian_default": "621111"},
    {"query": "dental", "coords": "20.5050,-86.9500", "radio": 4000, "scian_default": "621211"},
]

# Palabras clave y coordenadas estratégicas para Ark Ledger (Despachos Contables y Fiscalistas)
ARK_LEDGER_GEO_CLUSTERS = [
    # 1. Mérida — Zona Norte / Altabrisa / San Ramón Norte / City Center (Alta densidad de firmas contables)
    {"query": "despacho contable", "coords": "21.0185,-89.5850", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "21.0185,-89.5850", "radio": 5000, "scian_default": "541211"},
    {"query": "asesoria fiscal", "coords": "21.0185,-89.5850", "radio": 5000, "scian_default": "541110"},
    {"query": "auditoria fiscal", "coords": "21.0185,-89.5850", "radio": 5000, "scian_default": "541212"},
    {"query": "consultoria fiscal", "coords": "21.0450,-89.6150", "radio": 5000, "scian_default": "541211"},

    # 2. Mérida — Paseo Montejo / Campestre / García Ginerés / Centro (Firmas tradicionales y auditores)
    {"query": "despacho contable", "coords": "20.9850,-89.6180", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "20.9850,-89.6180", "radio": 5000, "scian_default": "541211"},
    {"query": "auditoria", "coords": "20.9850,-89.6180", "radio": 5000, "scian_default": "541212"},
    {"query": "asesoria fiscal", "coords": "20.9850,-89.6180", "radio": 5000, "scian_default": "541110"},
    {"query": "contabilidad", "coords": "20.9850,-89.6180", "radio": 5000, "scian_default": "541211"},

    # 3. CDMX — Benito Juárez / Insurgentes Sur / Del Valle
    {"query": "despacho contable", "coords": "19.3850,-99.1650", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.3732,-99.1793", "radio": 5000, "scian_default": "541211"},
    # 4. CDMX — Cuauhtémoc / Reforma / Polanco
    {"query": "auditoria fiscal", "coords": "19.4326,-99.1550", "radio": 5000, "scian_default": "541212"},
    {"query": "asesoria fiscal", "coords": "19.4335,-99.1950", "radio": 5000, "scian_default": "541110"},
    # 5. Guadalajara & Zapopan — Puerta de Hierro / Providencia
    {"query": "despacho contable", "coords": "20.6950,-103.3850", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "20.7100,-103.4120", "radio": 5000, "scian_default": "541211"},
    # 6. Monterrey & San Pedro Garza García — Valle Oriente / Obispado
    {"query": "despacho contable", "coords": "25.6570,-100.3650", "radio": 5000, "scian_default": "541211"},
    {"query": "contabilidad", "coords": "25.6710,-100.3400", "radio": 5000, "scian_default": "541211"},
    {"query": "asesoria fiscal", "coords": "25.6420,-100.3250", "radio": 5000, "scian_default": "541110"},
    # 7. Querétaro — Centro Sur / Bernardo Quintana
    {"query": "despacho contable", "coords": "20.5930,-100.3920", "radio": 5000, "scian_default": "541211"},
    # 8. Puebla — Angelópolis / Juárez
    {"query": "despacho contable", "coords": "19.0300,-98.2350", "radio": 5000, "scian_default": "541211"},
]


def parse_ubicacion(item: dict) -> tuple[Optional[str], Optional[str]]:
    municipio = (item.get("Municipio") or item.get("ciudad") or "").strip()
    entidad = (item.get("Entidad") or item.get("estado") or "").strip()
    if municipio and entidad:
        return municipio, entidad

    raw_ubi = str(item.get("Ubicacion") or "").upper().strip()
    if not raw_ubi:
        return municipio or None, entidad or None

    # Detectar principales clusters turísticos y ciudades clave
    if "CANCUN" in raw_ubi or "BENITO JUAREZ" in raw_ubi:
        return "Cancún", "Quintana Roo"
    if "PLAYA DEL CARMEN" in raw_ubi or "SOLIDARIDAD" in raw_ubi:
        return "Playa del Carmen", "Quintana Roo"
    if "TULUM" in raw_ubi:
        return "Tulum", "Quintana Roo"
    if "COZUMEL" in raw_ubi:
        return "Cozumel", "Quintana Roo"
    if "ISLA MUJERES" in raw_ubi:
        return "Isla Mujeres", "Quintana Roo"
    if "CHETUMAL" in raw_ubi or "OTHON P. BLANCO" in raw_ubi or "OTHÓN P. BLANCO" in raw_ubi:
        return "Chetumal", "Quintana Roo"
    if "MERIDA" in raw_ubi or "MÉRIDA" in raw_ubi:
        return "Mérida", "Yucatán"
    if "PROGRESO" in raw_ubi:
        return "Progreso", "Yucatán"
    if "VALLADOLID" in raw_ubi:
        return "Valladolid", "Yucatán"

    parts = [p.strip() for p in raw_ubi.split(",") if p.strip()]
    if len(parts) >= 2:
        return parts[0].title(), parts[-1].title()
    if len(parts) == 1:
        return parts[0].title(), entidad or None
    return municipio or None, entidad or None


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

        clee = str(item.get("CLEE") or "").strip()
        denue_id = str(item.get("Id") or "").strip()
        nombre = item.get("Nombre") or item.get("razon_social", "")
        lead_id_kwargs = {}
        if clee:
            lead_id_kwargs["lead_id"] = f"lead_clee_{clee}"
        elif denue_id:
            lead_id_kwargs["lead_id"] = f"lead_denue_{denue_id}"
        elif raw_email:
            import hashlib
            lead_id_kwargs["lead_id"] = f"lead_m_{hashlib.sha256(raw_email.lower().encode('utf-8')).hexdigest()[:16]}"
        elif nombre and raw_tel:
            import hashlib
            lead_id_kwargs["lead_id"] = f"lead_nt_{hashlib.sha256(f'{nombre}_{raw_tel}'.lower().encode('utf-8')).hexdigest()[:16]}"

        ciudad_norm, estado_norm = parse_ubicacion(item)

        return RawLead(
            **lead_id_kwargs,
            razon_social=nombre,
            rfc=item.get("RFC"),
            actividad=item.get("Actividad") or item.get("actividad") or item.get("Nombre_Act") or "",
            scian_code=code,
            empleados_rango=item.get("Estrato") or item.get("empleados_rango"),
            ciudad=ciudad_norm,
            estado=estado_norm,
            lat=float(item["Latitud"]) if item.get("Latitud") else item.get("lat"),
            lon=float(item["Longitud"]) if item.get("Longitud") else item.get("lon"),
            sitio_web=item.get("Sitio_Web") or item.get("sitio_web"),
            telefono=raw_tel,
            email=raw_email,
            tenant_id=tenant_id,
            source="denue",
            raw=item,
        )
