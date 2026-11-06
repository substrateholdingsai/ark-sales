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
    # DENUE no tiene un SCIAN que identifique por sí solo prestamistas por app.
    "fintech_credit_app": [],
}

PROFILES_ENTIDADES: dict[str, list[str]] = {
    "ark": ["0"],
    "futura_capital": ["31", "09", "19", "14", "23", "04"],
    "ark_ledger": ["0"],
    "fintech_credit_app": ["0"],
}

FINTECH_PLAZA_CENTERS = {
    "cdmx": "19.4326,-99.1332",
    "monterrey": "25.6866,-100.3161",
    "guadalajara": "20.6597,-103.3496",
    "queretaro": "20.5888,-100.3899",
    "puebla": "19.0414,-98.2063",
    "merida": "20.9674,-89.5926",
    "tijuana": "32.5149,-117.0382",
    "leon": "21.1220,-101.6820",
}
FINTECH_PLAZA_ALIASES = {"mty": "monterrey", "gdl": "guadalajara"}
FINTECH_SEARCH_TERMS = (
    "prestamos personales",
    "prestamo en linea",
    "credito digital",
    "fintech credito",
    "SOFOM",
)
FINTECH_GEO_CLUSTERS = [
    {
        "query": term,
        "coords": coords,
        "radio": 15000,
        "scian_default": None,
        "plaza": plaza,
    }
    for plaza, coords in FINTECH_PLAZA_CENTERS.items()
    for term in FINTECH_SEARCH_TERMS
]

# Palabras clave y coordenadas estratégicas para Futura Capital en Quintana Roo y Riviera Maya (Prioridad: Riviera Maya & Tulum)
FUTURA_GEO_CLUSTERS = [
    # 1. Tulum — Aldea Zamá / La Veleta / Wellness Corredor
    {"query": "clinica", "coords": "20.2100,-87.4650", "radio": 5000, "scian_default": "621111"},
    {"query": "wellness", "coords": "20.2100,-87.4650", "radio": 5000, "scian_default": "621399"},
    {"query": "dental", "coords": "20.2100,-87.4650", "radio": 5000, "scian_default": "621211"},
    {"query": "doctor", "coords": "20.2100,-87.4650", "radio": 5000, "scian_default": "621111"},
    {"query": "cirugia", "coords": "20.2100,-87.4650", "radio": 5000, "scian_default": "621112"},

    # 2. Playa del Carmen — Corredor Turístico & Hospiten Riviera Maya
    {"query": "dental", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621211"},
    {"query": "cirugia plastica", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621112"},
    {"query": "clinica", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621111"},
    {"query": "dermatologia", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621112"},
    {"query": "plastic surgery", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "621112"},
    {"query": "medical center", "coords": "20.6350,-87.0750", "radio": 5000, "scian_default": "622111"},

    # 3. Cozumel — Zona San Miguel / Costamed
    {"query": "clinica", "coords": "20.5050,-86.9500", "radio": 5000, "scian_default": "621111"},
    {"query": "dental", "coords": "20.5050,-86.9500", "radio": 5000, "scian_default": "621211"},

    # 4. Cancún — Zona Médica Hospitalaria (Galenia / Amerimed / Hospiten / Av. Bonampak)
    {"query": "cirugia plastica", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621112"},
    {"query": "clinica", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621111"},
    {"query": "dental", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621211"},
    {"query": "bariatrica", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621112"},
    {"query": "fertilidad", "coords": "21.1450,-86.8250", "radio": 5000, "scian_default": "621491"},

    # 5. Cancún — Puerto Cancún & Zona Hotelera (Turismo Médico Internacional & Estética)
    {"query": "dental clinic", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "621211"},
    {"query": "plastic surgery", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "621112"},
    {"query": "medical center", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "622111"},
    {"query": "estetica", "coords": "21.1550,-86.8050", "radio": 5000, "scian_default": "621399"},
]

# Futura Capital — CDMX y Zona Metropolitana: médicos high ticket (cirugía plástica/estética y bariatría)
# en los polos hospitalarios privados premium. Orden "por especialidad" (todas las zonas para la 1a
# especialidad, luego la 2a...) + tope por cluster para repartir el --limit entre zonas.
CDMX_FUTURA_ZONAS = [
    ("Polanco", "19.4330,-99.1950"),
    ("Lomas de Chapultepec", "19.4230,-99.2160"),
    ("Santa Fe (ABC Santa Fe)", "19.3600,-99.2700"),
    ("Interlomas (Hospital Ángeles Lomas)", "19.3990,-99.2820"),
    ("Pedregal (Hospital Ángeles Pedregal)", "19.3060,-99.2080"),
    ("Tlalpan (Médica Sur)", "19.2940,-99.1570"),
    ("Del Valle / Nápoles", "19.3850,-99.1700"),
    ("Roma / Condesa", "19.4170,-99.1640"),
    ("Satélite (Naucalpan)", "19.5100,-99.2370"),
]
CDMX_FUTURA_QUERIES = [
    ("cirugia plastica", "621112"),
    ("bariatrica", "621112"),
    ("cirugia estetica", "621112"),
    ("obesidad", "621112"),
]
CDMX_FUTURA_GEO_CLUSTERS = [
    {
        "query": q,
        "coords": coords,
        "radio": 3000,
        "scian_default": scian,
        "zona": zona,
        "cap": 2,                 # máx. leads nuevos por cluster
        "require_private": True,  # solo "sector privado" (excluye IMSS/ISSSTE/SSA y salones de belleza)
    }
    for q, scian in CDMX_FUTURA_QUERIES
    for zona, coords in CDMX_FUTURA_ZONAS
]

# Señales de sector público a excluir por nombre
PUBLIC_SECTOR_MARKERS = ("IMSS", "ISSSTE", "SEDENA", "PEMEX", "SECRETARIA DE SALUD", "SECRETARÍA DE SALUD", "CENTRO DE SALUD", "DIF ")


def is_private_medical(item: dict) -> bool:
    """True si DENUE clasifica el establecimiento como servicio médico del sector privado."""
    clase = str(item.get("Clase_actividad") or item.get("Actividad") or "").lower()
    if "sector privado" not in clase:
        return False
    nombre = f" {str(item.get('Nombre') or '').upper()} {str(item.get('Razon_social') or '').upper()} "
    return not any(m in nombre for m in PUBLIC_SECTOR_MARKERS)


# Palabras clave y coordenadas estratégicas para Campeche (Área Médica y Hospitalaria)
CAMPECHE_GEO_CLUSTERS = [
    # 1. San Francisco de Campeche — Centro, Malecón & Zona Médica
    {"query": "clinica", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "621111"},
    {"query": "medico", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "621111"},
    {"query": "hospital", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "622111"},
    {"query": "dental", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "621211"},
    {"query": "laboratorio", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "621511"},
    {"query": "cirugia", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "621112"},
    {"query": "salud", "coords": "19.8438,-90.5255", "radio": 5000, "scian_default": "621111"},

    # 2. San Francisco de Campeche — Sur / Santa Lucía / Siglo XXI
    {"query": "clinica", "coords": "19.8150,-90.5350", "radio": 5000, "scian_default": "621111"},
    {"query": "medico", "coords": "19.8150,-90.5350", "radio": 5000, "scian_default": "621111"},
    {"query": "dental", "coords": "19.8150,-90.5350", "radio": 5000, "scian_default": "621211"},

    # 3. Ciudad del Carmen — Zona Centro, Médica & Puerto
    {"query": "clinica", "coords": "18.6445,-91.8173", "radio": 5000, "scian_default": "621111"},
    {"query": "medico", "coords": "18.6445,-91.8173", "radio": 5000, "scian_default": "621111"},
    {"query": "hospital", "coords": "18.6445,-91.8173", "radio": 5000, "scian_default": "622111"},
    {"query": "dental", "coords": "18.6445,-91.8173", "radio": 5000, "scian_default": "621211"},
    {"query": "laboratorio", "coords": "18.6445,-91.8173", "radio": 5000, "scian_default": "621511"},

    # 4. Ciudad del Carmen — Zona Oriente / Concordia / Industrial
    {"query": "clinica", "coords": "18.6400,-91.7950", "radio": 5000, "scian_default": "621111"},
    {"query": "medico", "coords": "18.6400,-91.7950", "radio": 5000, "scian_default": "621111"},
    {"query": "dental", "coords": "18.6400,-91.7950", "radio": 5000, "scian_default": "621211"},
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

# Clusters de alta densidad para Ark Ledger en CDMX y Zona Metropolitana
CDMX_LEDGER_GEO_CLUSTERS = [
    # 1. Benito Juárez — Insurgentes Sur / Del Valle / Nápoles / San José Insurgentes (Corredor Contable #1)
    {"query": "despacho contable", "coords": "19.3850,-99.1750", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.3732,-99.1793", "radio": 5000, "scian_default": "541211"},
    {"query": "asesoria fiscal", "coords": "19.3850,-99.1750", "radio": 5000, "scian_default": "541110"},
    {"query": "auditoria fiscal", "coords": "19.3850,-99.1750", "radio": 5000, "scian_default": "541212"},
    {"query": "contabilidad", "coords": "19.3900,-99.1650", "radio": 5000, "scian_default": "541211"},

    # 2. Cuauhtémoc — Paseo de la Reforma / Juárez / Roma Norte / Condesa (Firmas Corporativas)
    {"query": "despacho contable", "coords": "19.4285,-99.1600", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.4285,-99.1600", "radio": 5000, "scian_default": "541211"},
    {"query": "auditoria fiscal", "coords": "19.4326,-99.1550", "radio": 5000, "scian_default": "541212"},
    {"query": "asesoria fiscal", "coords": "19.4250,-99.1650", "radio": 5000, "scian_default": "541110"},

    # 3. Miguel Hidalgo — Polanco / Anzures / Lomas de Chapultepec (Boutiques Fiscales & Auditoría)
    {"query": "despacho contable", "coords": "19.4335,-99.1950", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores publicos", "coords": "19.4335,-99.1950", "radio": 5000, "scian_default": "541211"},
    {"query": "auditoria", "coords": "19.4335,-99.1950", "radio": 5000, "scian_default": "541212"},
    {"query": "asesoria fiscal", "coords": "19.4335,-99.1950", "radio": 5000, "scian_default": "541110"},

    # 4. Santa Fe & Cuajimalpa — Centro Financiero / Bosques de las Lomas
    {"query": "despacho contable", "coords": "19.3620,-99.2600", "radio": 5000, "scian_default": "541211"},
    {"query": "consultoria fiscal", "coords": "19.3620,-99.2600", "radio": 5000, "scian_default": "541110"},
    {"query": "contadores", "coords": "19.3620,-99.2600", "radio": 5000, "scian_default": "541211"},

    # 5. Coyoacán & Álvaro Obregón Sur — San Ángel / Perisur / Pedregal
    {"query": "despacho contable", "coords": "19.3450,-99.1900", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.3450,-99.1900", "radio": 5000, "scian_default": "541211"},
    {"query": "asesoria fiscal", "coords": "19.3450,-99.1900", "radio": 5000, "scian_default": "541110"},

    # 6. Naucalpan & Satélite (Edomex Metropolitana Poniente)
    {"query": "despacho contable", "coords": "19.5050,-99.2350", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.5050,-99.2350", "radio": 5000, "scian_default": "541211"},
    {"query": "asesoria fiscal", "coords": "19.5050,-99.2350", "radio": 5000, "scian_default": "541110"},

    # 7. Tlalnepantla & Vallejo (Edomex Metropolitana Norte)
    {"query": "despacho contable", "coords": "19.5350,-99.1950", "radio": 5000, "scian_default": "541211"},
    {"query": "contadores", "coords": "19.5350,-99.1950", "radio": 5000, "scian_default": "541211"},
    {"query": "nomina", "coords": "19.5350,-99.1950", "radio": 5000, "scian_default": "561490"},
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
    if "CAMPECHE" in raw_ubi:
        return "San Francisco de Campeche", "Campeche"
    if "CIUDAD DEL CARMEN" in raw_ubi or "DEL CARMEN" in raw_ubi:
        return "Ciudad del Carmen", "Campeche"

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
        plaza: Optional[str] = None,
        custom_query: Optional[str] = None,
    ) -> None:
        super().__init__()
        self.token = token or os.getenv("INEGI_TOKEN", "")
        self.fixture_path = fixture_path or os.getenv("DENUE_FIXTURE_PATH")
        self.profile = profile if profile in PROFILES_SCIAN else "ark"
        self.entidades = entidades or PROFILES_ENTIDADES.get(self.profile, ["0"])
        self.page_size = max(1, page_size)
        self.plaza = (plaza or "").lower().strip()
        self.custom_query = (custom_query or "").strip()

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
            if self.profile == "fintech_credit_app":
                clusters = list(FINTECH_GEO_CLUSTERS)
                if self.plaza and self.plaza != "all":
                    plaza = FINTECH_PLAZA_ALIASES.get(self.plaza, self.plaza)
                    if plaza not in FINTECH_PLAZA_CENTERS:
                        choices = ", ".join(FINTECH_PLAZA_CENTERS)
                        raise ValueError(f"Plaza fintech no válida: {self.plaza}. Opciones: {choices}")
                    clusters = [cluster for cluster in clusters if cluster["plaza"] == plaza]
            elif self.profile in ("futura_capital", "ark_ledger"):
                # Consulta geográfica con endpoints probados y optimizados
                if self.plaza == "campeche":
                    clusters = list(CAMPECHE_GEO_CLUSTERS)
                elif self.plaza == "cdmx" and self.profile == "ark_ledger":
                    clusters = list(CDMX_LEDGER_GEO_CLUSTERS)
                elif self.plaza == "cdmx" and self.profile == "futura_capital":
                    clusters = list(CDMX_FUTURA_GEO_CLUSTERS)
                else:
                    clusters = list(FUTURA_GEO_CLUSTERS if self.profile == "futura_capital" else ARK_LEDGER_GEO_CLUSTERS)
                if self.plaza and self.plaza not in ("all", "campeche", "cdmx"):
                    if self.plaza == "riviera_maya":
                        clusters = [c for c in clusters if any(k in str(c).lower() for k in ("tulum", "playa", "cozumel", "-87.", "-86.9"))]
                    elif self.plaza == "cancun":
                        clusters = [c for c in clusters if any(k in str(c).lower() for k in ("cancun", "-86.8"))]
                    elif self.plaza == "merida":
                        clusters = [c for c in clusters if any(k in str(c).lower() for k in ("merida", "-89."))]
                    elif self.plaza == "cdmx":
                        clusters = [c for c in clusters if any(k in str(c).lower() for k in ("cdmx", "-99.1"))]
                    elif self.plaza in ("monterrey", "mty"):
                        clusters = [c for c in clusters if any(k in str(c).lower() for k in ("monterrey", "-100."))]
                    elif self.plaza in ("guadalajara", "gdl"):
                        clusters = [c for c in clusters if any(k in str(c).lower() for k in ("guadalajara", "zapopan", "-103."))]

                seen_ids: set[str] = set()
                for cluster in clusters:
                    await self._throttle()
                    q = self.custom_query if self.custom_query else cluster["query"]
                    coords = cluster["coords"]
                    radio = cluster["radio"]
                    scian_def = cluster["scian_default"]
                    import urllib.parse
                    q_enc = urllib.parse.quote(q)
                    url = f"{BASE_URL}Buscar/{q_enc}/{coords}/{radio}/{self.token}"
                    try:
                        resp = await client.get(url)
                        if resp.status_code != 200:
                            print(f"[DENUE] HTTP {resp.status_code} for '{q}' @ {coords}: {resp.text[:120]}", file=__import__("sys").stderr)
                            continue
                        payload = resp.json()
                        if not isinstance(payload, list):
                            print(f"[DENUE] Non-list response for '{q}' @ {coords}: {str(payload)[:120]}", file=__import__("sys").stderr)
                            continue
                        zona = cluster.get("zona", "")
                        cap = cluster.get("cap")
                        require_private = cluster.get("require_private", False)
                        print(f"[DENUE] Found {len(payload)} leads for '{q}' @ {coords} ({radio}m) {zona}".rstrip())
                        taken = 0
                        skipped_public = 0
                        for item in payload:
                            if cap is not None and taken >= cap:
                                break
                            if require_private and not is_private_medical(item):
                                skipped_public += 1
                                continue
                            lead_key = item.get("CLEE") or item.get("Id") or f"{item.get('Nombre')}_{item.get('Telefono')}"
                            if lead_key in seen_ids:
                                continue
                            seen_ids.add(lead_key)
                            taken += 1
                            yield self._normalize(item, scian_def)
                        if require_private or cap is not None:
                            print(f"[DENUE]   -> tomados {taken}, descartados (no privado/no médico) {skipped_public}")
                    except Exception as e:
                        print(f"[DENUE error] '{q}' @ {coords}: {e}", file=__import__("sys").stderr)
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
        elif self.profile == "fintech_credit_app":
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
            actividad=item.get("Actividad") or item.get("actividad") or item.get("Nombre_Act") or item.get("Clase_actividad") or "",
            scian_code=code,
            empleados_rango=item.get("Estrato") or item.get("empleados_rango"),
            ciudad=ciudad_norm,
            estado=estado_norm,
            lat=float(item["Latitud"]) if item.get("Latitud") else item.get("lat"),
            lon=float(item["Longitud"]) if item.get("Longitud") else item.get("lon"),
            # La API real de DENUE devuelve "Sitio_internet"; "Sitio_Web" se mantiene por los fixtures
            sitio_web=(item.get("Sitio_Web") or item.get("Sitio_internet") or item.get("sitio_web") or "").strip() or None,
            telefono=raw_tel,
            email=raw_email,
            tenant_id=tenant_id,
            harvest_profile=self.profile,
            source="denue",
            raw=item,
        )
