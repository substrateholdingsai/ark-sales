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
        # Cluster 1: Brokers, Inmobiliarias y Asesores de Inversión
        "531210", "531311", "523920",
        # Cluster 2: Médicos Especialistas, Clínicas y Laboratorios (MB Medical Tower)
        "621111", "621112", "621211", "621511", "622111",
        # Cluster 3: Logística, Autotransporte, Almacenes y Aduanas (Logistic Park Tamanché)
        "484111", "484121", "493111", "488511",
        # Cluster 4: Hospitalidad y Patrimonial (The MB Hotel, Soletta, Azureno, Aldea Balhá, Paseos Temozón, Recoleta)
        "721111", "721190", "531110", "551110",
    ],
}

PROFILES_ENTIDADES: dict[str, list[str]] = {
    "ark": ["0"],
    # 31=Yucatán, 09=CDMX, 19=Nuevo León, 14=Jalisco, 23=Quintana Roo
    "futura_capital": ["31", "09", "19", "14", "23"],
}


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
        scian_list = PROFILES_SCIAN.get(self.profile, PROFILES_SCIAN["ark"])
        async with httpx.AsyncClient(timeout=30.0) as client:
            for entidad in self.entidades:
                for scian in scian_list:
                    await self._throttle()
                    url = f"{BASE_URL}BuscarAreaAct/{scian}/{entidad}/0/1/{self.page_size}/{self.token}"
                    resp = await client.get(url)
                    if resp.status_code == 404:
                        continue
                    resp.raise_for_status()
                    payload = resp.json()
                    if not isinstance(payload, list):
                        continue
                    for item in payload:
                        yield self._normalize(item, scian)

    def _normalize(self, item: dict, scian: Optional[str] = None) -> RawLead:
        code = scian or item.get("Codigo_Actividad") or item.get("scian")
        raw_tel = (item.get("Telefono") or item.get("telefono") or "").strip() or None
        raw_email = (item.get("Correo_e") or item.get("email") or "").strip() or None
        tenant_id = "acc_futura_capital" if self.profile == "futura_capital" else item.get("tenant_id")
        return RawLead(
            razon_social=item.get("Nombre") or item.get("razon_social", ""),
            rfc=item.get("RFC"),
            actividad=item.get("Actividad") or item.get("actividad", ""),
            scian_code=code,
            empleados_rango=item.get("Estrato") or item.get("empleados_rango"),
            ciudad=item.get("Municipio") or item.get("ciudad"),
            estado=item.get("Entidad") or item.get("estado"),
            lat=item.get("Latitud") or item.get("lat"),
            lon=item.get("Longitud") or item.get("lon"),
            sitio_web=item.get("Sitio_Web") or item.get("sitio_web"),
            telefono=raw_tel,
            email=raw_email,
            tenant_id=tenant_id,
            source="denue",
            raw=item,
        )
