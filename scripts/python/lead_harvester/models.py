"""Pydantic models for the lead harvesting pipeline."""
from __future__ import annotations

import uuid
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Vertical(str, Enum):
    FISCAL = "fiscal"
    COBRANZA = "cobranza"
    ECOMMERCE = "ecommerce"
    BUNDLE = "bundle"


class Destination(str, Enum):
    LEDGER = "ledger"
    ANGEL = "angel"
    COMMERCE = "commerce"
    BUNDLE = "bundle"


class RawLead(BaseModel):
    lead_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    razon_social: str
    rfc: Optional[str] = None
    actividad: str = ""
    scian_code: Optional[str] = None
    empleados_rango: Optional[str] = None
    ciudad: Optional[str] = None
    estado: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    sitio_web: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    productos_interes: list[str] = Field(default_factory=list)
    tenant_id: Optional[str] = None
    source: str
    raw: dict = Field(default_factory=dict)
    score: int = 0
    dolor_principal: str = ""
    vertical: str = ""


class IngestPayload(BaseModel):
    version: int = 3
    lead_id: str
    email: str
    source_worker: str = "ark-sales"
    destination: Destination
    vertical: Vertical
    score: int = Field(ge=0, le=100)
    conversation_summary: str
    account_context: dict
    scian_code: Optional[str] = None
    harvest_source: str = "denue"
    sitio_web: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: str = "Contacto Corporativo"
    tenant_id: Optional[str] = None


class HarvestResult(BaseModel):
    total: int = 0
    ingested: int = 0
    deduped: int = 0
    errors: int = 0
    source: str = "denue"
