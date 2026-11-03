"""Ingest client for POST /webhooks/ingest."""
from __future__ import annotations

import os
from typing import Optional

import httpx

from .models import IngestPayload, RawLead, Vertical, Destination
from .scoring import recomendar_desarrollos_futura

BASE_URL = os.getenv("ARK_SALES_BASE_URL", "http://localhost:8787")

VERTICAL_MAP = {
    "541210": (Vertical.FISCAL, Destination.LEDGER),
    "541211": (Vertical.FISCAL, Destination.LEDGER),
    "541212": (Vertical.FISCAL, Destination.LEDGER),
    "541219": (Vertical.FISCAL, Destination.LEDGER),
    "541110": (Vertical.FISCAL, Destination.LEDGER),
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


def generar_contacto_corporativo(account_id: str, dominio: Optional[str]) -> dict:
    """Genera contacto corporativo legal (no personal)."""
    if not dominio or dominio == "unknown":
        email = f"{account_id}@harvest.arksystems.local"
    else:
        host = dominio.replace("https://", "").replace("http://", "").split("/")[0].strip()
        email = f"contacto@{host}" if host else f"{account_id}@harvest.arksystems.local"
    return {
        "account_id": account_id,
        "nombre": "Contacto Corporativo",
        "email": email,
        "telefono": None,
        "cargo": "Dirección General",
        "consent_status": "pending",
        "source": "harvest_auto",
    }


def dominio_from_sitio(sitio_web: Optional[str]) -> Optional[str]:
    if not sitio_web:
        return None
    host = sitio_web.replace("https://", "").replace("http://", "").split("/")[0].strip()
    return host or None


VERTICAL_TO_DEST = {
    "fiscal": (Vertical.FISCAL, Destination.LEDGER),
    "cobranza": (Vertical.COBRANZA, Destination.ANGEL),
    "ecommerce": (Vertical.ECOMMERCE, Destination.COMMERCE),
    "bundle": (Vertical.BUNDLE, Destination.BUNDLE),
}


def build_payload(lead: RawLead, score: int = 50) -> IngestPayload:
    if lead.tenant_id == "acc_futura_capital":
        vertical, destination = (Vertical.BUNDLE, Destination.BUNDLE)
    elif lead.tenant_id == "acc_ark_ledger":
        vertical, destination = (Vertical.FISCAL, Destination.LEDGER)
    elif lead.vertical in ("fiscal", "cobranza", "ecommerce") or (
        lead.vertical == "bundle" and (lead.scian_code or "") not in VERTICAL_MAP
    ):
        vertical, destination = VERTICAL_TO_DEST[lead.vertical]
    else:
        vertical, destination = VERTICAL_MAP.get(lead.scian_code or "", (Vertical.COBRANZA, Destination.ANGEL))

    dominio = dominio_from_sitio(lead.sitio_web)
    if lead.email:
        email = lead.email
        contact_email = lead.email
    else:
        email = "contacto@" + (lead.sitio_web or "example.com").replace("https://", "").replace("http://", "").split("/")[0]
        if not lead.sitio_web:
            email = f"lead_{lead.lead_id[:8]}@harvest.arksystems.local"
        contact_email = generar_contacto_corporativo(lead.lead_id, dominio)["email"]

    dolor = lead.dolor_principal or lead.actividad or "sin datos"
    if lead.productos_interes:
        productos_interes = lead.productos_interes
    elif lead.tenant_id == "acc_futura_capital":
        productos_interes = recomendar_desarrollos_futura(lead)
    elif lead.tenant_id == "acc_ark_ledger":
        productos_interes = ["ledger_pro", "ledger_freemium"]
    else:
        productos_interes = [destination.value]

    account_ctx = {
        "despacho_nombre": lead.razon_social,
        "tamano": tamano_from_rango(lead.empleados_rango),
        "productos_interes": productos_interes,
        "dolor_principal": dolor,
    }
    if lead.ciudad or lead.estado:
        account_ctx["ubicacion"] = ", ".join(filter(None, [lead.ciudad, lead.estado]))
    if lead.tenant_id:
        account_ctx["tenant_id"] = lead.tenant_id

    return IngestPayload(
        lead_id=lead.lead_id,
        email=email,
        destination=destination,
        vertical=vertical,
        score=score,
        conversation_summary=f"Cosecha DENUE: {lead.razon_social} ({lead.actividad})",
        account_context=account_ctx,
        scian_code=lead.scian_code,
        harvest_source=getattr(lead, "source", "denue") or "denue",
        sitio_web=lead.sitio_web,
        contact_email=contact_email,
        contact_phone=lead.telefono,
        contact_name="Contacto Corporativo",
        tenant_id=lead.tenant_id,
    )


async def ingest_lead(lead: RawLead, score: int = 50, base_url: Optional[str] = None) -> bool:
    url = (base_url or BASE_URL).rstrip("/") + "/webhooks/ingest"
    payload = build_payload(lead, score)
    headers = {"X-Idempotency-Key": lead.lead_id}
    token = os.getenv("WEBHOOK_SECRET") or os.getenv("INTERNAL_API_TOKEN") or ""
    if token:
        headers["Authorization"] = f"Bearer {token}"
        headers["X-Ark-Internal-Key"] = token
        headers["X-Ark-Webhook-Secret"] = token
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            url,
            json=payload.model_dump(),
            headers=headers,
        )
        return resp.status_code in (200, 201, 202)
