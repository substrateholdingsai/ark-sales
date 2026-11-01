"""Clasificador LLM híbrido."""
from __future__ import annotations

import json
import os
from typing import Optional

import httpx

ARK_SALES_BASE_URL = os.getenv("ARK_SALES_BASE_URL", "http://localhost:8787")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN")
CLASSIFY_ENDPOINT = f"{ARK_SALES_BASE_URL}/api/internal/leads/{{lead_id}}/classify"


async def clasificar_con_llm(lead_id: str, raw_lead: dict, observaciones: list[dict]) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                CLASSIFY_ENDPOINT.format(lead_id=lead_id),
                headers={"Authorization": f"Bearer {INTERNAL_API_TOKEN}", "Content-Type": "application/json"},
                json={"observaciones": observaciones, "raw_lead": raw_lead},
            )
            if resp.status_code == 200:
                data = resp.json()
                if hasattr(data, "__await__"):
                    data = await data
                return data
            return None
    except Exception:
        return None


async def scoring_hibrido(lead_id: str, raw_lead: dict, observaciones: list[dict], score_reglas: int, dolor_reglas: str) -> tuple[int, str, str]:
    if score_reglas < 40:
        return score_reglas, dolor_reglas, "bundle"
    llm = await clasificar_con_llm(lead_id, raw_lead, observaciones)
    if llm and llm.get("confianza", 0) >= 0.7:
        return min(score_reglas + int(llm["confianza"] * 10), 100), llm["dolor_principal"], llm["vertical"]
    return score_reglas, dolor_reglas, "bundle"
