"""Public SIPRES harvester for active SOFOM institutions."""
from __future__ import annotations

import json
import re
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import AsyncIterator, Optional
from urllib.parse import urljoin

import httpx

from .base import BaseHarvester
from .models import RawLead

SIPRES_BASE_URL = "https://webapps.condusef.gob.mx/SIPRES/jsp/pub/"
SIPRES_SEARCH_URL = urljoin(SIPRES_BASE_URL, "resulbusq.jsp")
SIPRES_DETAIL_URL = "https://webapps.condusef.gob.mx/SIPRES/jsp/home_publico.jsp"
SOFOM_SECTORS = ("69", "68")
ACTIVE_STATUS = "60"
SIPRES_PROFILE = "sipres_sofom"


def _clean(value: str) -> str:
    return " ".join(value.replace("\xa0", " ").split())


class _SearchResultsParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[dict[str, str]] = []
        self._in_row = False
        self._in_cell = False
        self._cells: list[str] = []
        self._cell_parts: list[str] = []
        self._detail_id: Optional[str] = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "tr":
            self._in_row = True
            self._cells = []
            self._detail_id = None
        elif tag == "td" and self._in_row:
            self._in_cell = True
            self._cell_parts = []
        elif tag == "a" and self._in_row:
            onclick = attrs_dict.get("onclick") or ""
            match = re.search(r"idins=(\d+)", onclick)
            if match:
                self._detail_id = match.group(1)

    def handle_data(self, data: str) -> None:
        if self._in_cell:
            self._cell_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._in_cell:
            self._cells.append(_clean(" ".join(self._cell_parts)))
            self._in_cell = False
        elif tag == "tr" and self._in_row:
            self._in_row = False
            if self._detail_id and len(self._cells) >= 7:
                self.rows.append({
                    "registration_key": self._cells[0],
                    "idins": self._detail_id,
                    "name": self._cells[1],
                    "short_name": self._cells[2],
                    "status": self._cells[3],
                    "sector": self._cells[4],
                    "state": self._cells[5],
                    "updated": self._cells[6],
                    "not_locatable": self._cells[7] if len(self._cells) > 7 else "",
                })


class _InstitutionDetailParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text_parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._active_link: Optional[dict[str, str]] = None
        self._name_depth = 0
        self.name_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "a":
            href = attrs_dict.get("href") or ""
            self._active_link = {"href": href, "text": ""}
        if tag == "div" and "nombreif" in (attrs_dict.get("class") or "").split():
            self._name_depth = 1
        elif self._name_depth:
            self._name_depth += 1

    def handle_data(self, data: str) -> None:
        self.text_parts.append(data)
        if self._active_link is not None:
            self._active_link["text"] += data
        if self._name_depth:
            self.name_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._active_link is not None:
            self.links.append((self._active_link["href"], _clean(self._active_link["text"])))
            self._active_link = None
        if tag == "div" and self._name_depth:
            self._name_depth -= 1


class SipresHarvester(BaseHarvester):
    source_name = "sipres"
    rate_limit = 1.0

    def __init__(
        self,
        fixture_path: Optional[str] = None,
        limit: int = 50,
        custom_query: Optional[str] = None,
    ) -> None:
        super().__init__()
        if limit < 1:
            raise ValueError("SIPRES limit must be at least 1")
        self.fixture_path = fixture_path
        self.limit = limit
        self.custom_query = (custom_query or "").strip()

    async def health_check(self) -> bool:
        return Path(self.fixture_path).exists() if self.fixture_path else True

    async def harvest(self) -> AsyncIterator[RawLead]:
        if self.fixture_path:
            data = json.loads(Path(self.fixture_path).read_text(encoding="utf-8"))
            if not isinstance(data, list):
                raise ValueError("SIPRES fixture must contain a JSON list")
            for item in data[:self.limit]:
                yield self._normalize(item)
            return

        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            await self._throttle()
            response = await client.post(
                SIPRES_SEARCH_URL,
                data={
                    "tipo": "1",
                    "pnom": self.custom_query,
                    "pedo": "",
                    "psec": ",".join(SOFOM_SECTORS),
                    "psta": ACTIVE_STATUS,
                },
                headers={"User-Agent": "ArkSales-Harvester/1.0"},
            )
            response.raise_for_status()
            parser = _SearchResultsParser()
            parser.feed(response.text)
            if not parser.rows:
                raise RuntimeError("SIPRES returned no parseable SOFOM records")

            active_sofoms = [
                row for row in parser.rows
                if "operación" in row["status"].casefold()
                and "objeto múltiple" in row["sector"].casefold()
            ]
            if not active_sofoms:
                raise RuntimeError("SIPRES response contained no active SOFOM records")

            selected = sorted(
                active_sofoms,
                key=lambda row: (
                    -self._relevance_score(f"{row['name']} {row['short_name']}"),
                    row["name"].casefold(),
                    row["idins"],
                ),
            )[:self.limit]
            for row in selected:
                await self._throttle()
                try:
                    detail_response = await client.get(
                        SIPRES_DETAIL_URL,
                        params={"idins": row["idins"]},
                        headers={"User-Agent": "ArkSales-Harvester/1.0"},
                    )
                    detail_response.raise_for_status()
                    detail = self._parse_detail(detail_response.text)
                except httpx.HTTPError as exc:
                    print(
                        f"[SIPRES] detail request failed for idins={row['idins']}: "
                        f"{type(exc).__name__}: {exc}",
                        file=__import__("sys").stderr,
                    )
                    continue
                yield self._normalize({**row, **detail})

    @staticmethod
    def _relevance_score(name: str) -> int:
        normalized = name.casefold()
        positive = {
            "crédito personal": 8,
            "credito personal": 8,
            "préstamo": 7,
            "prestamo": 7,
            "crédito": 5,
            "credito": 5,
            "financiera": 3,
            "financiamiento": 3,
            "consumo": 3,
            "nómina": 3,
            "nomina": 3,
            "microcrédito": 3,
            "microcredito": 3,
            "digital": 2,
            "app": 2,
        }
        negative = {
            "arrendadora": 3,
            "arrendamiento": 3,
            "factoraje": 3,
            "leasing": 3,
        }
        return sum(weight for term, weight in positive.items() if term in normalized) - sum(
            weight for term, weight in negative.items() if term in normalized
        )

    @staticmethod
    def _parse_detail(document: str) -> dict[str, Optional[str]]:
        parser = _InstitutionDetailParser()
        parser.feed(document)
        text = _clean(" ".join(parser.text_parts))
        email = next(
            (href[7:].strip() for href, _ in parser.links if href.casefold().startswith("mailto:")),
            None,
        )
        website_match = re.search(
            r"<div\b[^>]*>\s*<b>\s*P(?:á|&aacute;|&#225;)gina\s+WEB\s*</b>"
            r"(?:(?!</div>)[\s\S]){0,800}?<a\b[^>]*\bhref\s*=\s*['\"]([^'\"]+)['\"]",
            document,
            re.IGNORECASE,
        )
        website = unescape(website_match.group(1).strip()) if website_match else None
        if not website:
            website = next(
                (
                    href for href, _ in parser.links
                    if href.casefold().startswith(("http://", "https://"))
                    and not any(host in href.casefold() for host in (
                        "condusef.gob.mx",
                        "google.com/maps",
                        "framework-gb.cdn.gob.mx",
                        "gob.mx/condusef",
                    ))
                ),
                None,
            )
        rfc_match = re.search(r"\bRFC\b\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})", text, re.IGNORECASE)
        phone_match = re.search(
            r"Tel[eé]fono\s*\(s\)\s*[:\-]?\s*([(+\d][+\d\s().\-]{6,25})",
            text,
            re.IGNORECASE,
        )
        return {
            "rfc": rfc_match.group(1).upper() if rfc_match else None,
            "email": email,
            "sitio_web": website,
            "telefono": _clean(phone_match.group(1)) if phone_match else None,
            "detail_name": _clean(" ".join(parser.name_parts)) or None,
        }

    @staticmethod
    def _normalize(item: dict) -> RawLead:
        institution_id = str(item.get("idins") or "").strip()
        if not institution_id.isdigit():
            raise ValueError("SIPRES record is missing a numeric institution ID")
        name = _clean(str(item.get("name") or item.get("detail_name") or ""))
        if not name:
            raise ValueError(f"SIPRES record {institution_id} is missing its institution name")
        detail_url = f"{SIPRES_DETAIL_URL}?idins={institution_id}"
        sector = _clean(str(item.get("sector") or "SOFOM"))
        status = _clean(str(item.get("status") or "En operación"))
        return RawLead(
            lead_id=f"lead_sipres_{institution_id}",
            razon_social=name,
            rfc=item.get("rfc"),
            actividad=f"{sector} / {status}",
            ciudad=None,
            estado=_clean(str(item.get("state") or "")) or None,
            sitio_web=item.get("sitio_web"),
            telefono=item.get("telefono"),
            email=item.get("email"),
            productos_interes=["angel", "ledger"],
            tenant_id="acc_ark_ledger",
            source="sipres",
            harvest_profile=SIPRES_PROFILE,
            raw={
                "sipres_id": institution_id,
                "registration_key": item.get("registration_key"),
                "short_name": item.get("short_name"),
                "status": status,
                "sector": sector,
                "last_updated": item.get("updated"),
                "not_locatable": item.get("not_locatable"),
                "registry_url": detail_url,
                "source_url": SIPRES_BASE_URL.rstrip("/") + "/index.jsp",
            },
        )
