"""Base harvester abstraction."""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import AsyncIterator

import httpx
import os

from .models import RawLead
from .scoring import rule_score, calcular_score_con_observaciones, recomendar_desarrollos_futura
from .scoring_llm import scoring_hibrido
from .profile import HTTPProfiler


class BaseHarvester(ABC):
    source_name: str = "base"
    rate_limit: float = 1.0

    def __init__(self) -> None:
        self._sem = asyncio.Semaphore(max(1, int(self.rate_limit)))

    @abstractmethod
    async def harvest(self) -> AsyncIterator[RawLead]:
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        ...

    async def _throttle(self) -> None:
        async with self._sem:
            await asyncio.sleep(1.0 / max(self.rate_limit, 0.1))

    async def _guardar_observaciones(self, account_id: str, observaciones: list[dict]) -> None:
        base = os.getenv("ARK_SALES_BASE_URL", "http://localhost:8787")
        token = os.getenv("INTERNAL_API_TOKEN")
        if not token:
            return
        # Best-effort: un timeout/fallo de red al guardar observaciones no debe abortar todo el harvest
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.post(
                    f"{base}/api/internal/observations/batch",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"account_id": account_id, "observaciones": observaciones},
                )
        except Exception as exc:
            print(f"[observations error] {account_id}: {type(exc).__name__}: {exc}", file=__import__("sys").stderr)

    async def harvest_and_enrich(self) -> AsyncIterator[RawLead]:
        profiler = HTTPProfiler()
        try:
            async for raw_lead in self.harvest():
                observaciones = []
                if raw_lead.scian_code:
                    observaciones.append({
                        "signal_code": "SCIAN_CODE",
                        "value_text": raw_lead.scian_code,
                        "confidence": 1.0,
                        "evidence_url": None,
                    })
                if raw_lead.telefono:
                    observaciones.append({
                        "signal_code": "WHATSAPP_CORPORATIVO",
                        "value_text": raw_lead.telefono,
                        "confidence": 0.9,
                        "evidence_url": None,
                    })
                if raw_lead.email:
                    observaciones.append({
                        "signal_code": "EMAIL_CORPORATIVO",
                        "value_text": raw_lead.email,
                        "confidence": 0.9,
                        "evidence_url": None,
                    })
                if raw_lead.sitio_web:
                    dominio = raw_lead.sitio_web.replace("https://", "").replace("http://", "").split("/")[0]
                    profile_result = await profiler.profile_company(dominio)
                    observaciones.extend(profile_result.observaciones)
                    if not raw_lead.telefono and profile_result.telefonos_detectados:
                        raw_lead.telefono = profile_result.telefonos_detectados[0]
                    if not raw_lead.email and profile_result.emails_detectados:
                        raw_lead.email = profile_result.emails_detectados[0]
                if observaciones:
                    await self._guardar_observaciones(account_id=f"acc_{raw_lead.lead_id}", observaciones=observaciones)
                score_con_obs, dolor_con_obs = calcular_score_con_observaciones(raw_lead, observaciones)
                score_final, dolor_principal, vertical = await scoring_hibrido(
                    lead_id=raw_lead.lead_id,
                    raw_lead=raw_lead.model_dump(),
                    observaciones=observaciones,
                    score_reglas=score_con_obs,
                    dolor_reglas=dolor_con_obs,
                )
                raw_lead.score = score_final
                raw_lead.dolor_principal = dolor_principal
                raw_lead.vertical = vertical
                if raw_lead.harvest_profile in ("fintech_credit_app", "sipres_sofom"):
                    raw_lead.dolor_principal = (
                        "cobranza_credito_digital"
                        if raw_lead.harvest_profile == "fintech_credit_app"
                        else "cobranza_sofom"
                    )
                    raw_lead.vertical = "cobranza"
                    raw_lead.productos_interes = ["angel", "ledger"]
                elif raw_lead.tenant_id == "acc_futura_capital":
                    raw_lead.productos_interes = recomendar_desarrollos_futura(raw_lead, observaciones)
                yield raw_lead
        finally:
            await profiler.close()
