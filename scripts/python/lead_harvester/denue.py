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


class DenueHarvester(BaseHarvester):
    source_name = "denue"
    rate_limit = 2.0

    def __init__(self, token: Optional[str] = None, fixture_path: Optional[str] = None) -> None:
        super().__init__()
        self.token = token or os.getenv("INEGI_TOKEN", "")
        self.fixture_path = fixture_path or os.getenv("DENUE_FIXTURE_PATH")

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
            for scian in ["541210", "531110", "531210", "522250", "561490"]:
                await self._throttle()
                url = f"{BASE_URL}BuscarAreaAct/{scian}/0/0/1/100/{self.token}"
                resp = await client.get(url)
                resp.raise_for_status()
                for item in resp.json():
                    yield self._normalize(item, scian)

    def _normalize(self, item: dict, scian: Optional[str] = None) -> RawLead:
        code = scian or item.get("Codigo_Actividad") or item.get("scian")
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
            source="denue",
            raw=item,
        )
