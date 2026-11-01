"""Ingest client for POST /webhooks/ingest."""
from __future__ import annotations

import os
from typing import Optional

import httpx

from .models import IngestPayload, RawLead, Vertical, Destination

BASE_URL = os.getenv("ARK_SALES_BASE_URL", "http://localhost:8787")

VERTICAL_MAP = {
    "541210": (Vertical.FISCAL, Destination.LEDGER),
    "531110": (Vertical.COBRANZA, Destination.ANGEL),
    "531210": (Vertical.COBRANZA, Destination.ANGEL),
    "522250": (Vertical.COBRANZA, Destination.ANGEL),
    "561490": (Vertical.COBRANZA, Destination.ANGEL),
}

TAMANO_MAP = {
    "0 a 5 personas": "1-5",
    "6 a 10 personas": "6-20",
    "11 a 30 personas": "6-20",
    "31 a 50 personas": "21-50",
    "51 a 100 personas": "50+",
    "101 a 250 personas": "50+",
    "251 y más personas": "50+",
}


def tamano_from_rango(rango: Optional[str]) -> str:
    if not rango:
        return "1-5"
    return TAMANO_MAP.get(rango, "1-5")


def build_payload(lead: RawLead, score: int = 50) -> IngestPayload:
    vertical, destination = VERTICAL_MAP.get(lead.scian_code or "", (Vertical.COBRANZA, Destination.ANGEL))
    email = "contacto@" + (lead.sitio_web or "example.com").replace("https://", "").replace("http://", "").split("/")[0]
    return IngestPayload(
        lead_id=lead.lead_id,
        email=email,
        destination=destination,
        vertical=vertical,
        score=score,
        conversation_summary=f"Cosecha DENUE: {lead.razon_social} ({lead.actividad})",
        account_context={
            "despacho_nombre": lead.razon_social,
            "tamano": tamano_from_rango(lead.empleados_rango),
            "productos_interes": [destination.value],
            "dolor_principal": lead.actividad or "sin datos",
        },
    )


async def ingest_lead(lead: RawLead, score: int = 50, base_url: Optional[str] = None) -> bool:
    url = (base_url or BASE_URL).rstrip("/") + "/webhooks/ingest"
    payload = build_payload(lead, score)
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            json=payload.model_dump(),
            headers={"X-Idempotency-Key": lead.lead_id},
        )
        return resp.status_code in (200, 201, 202)
