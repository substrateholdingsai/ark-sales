"""Pipeline orchestrator for FASE 1."""
from __future__ import annotations

from typing import List

from .denue import DenueHarvester
from .ingest import ingest_lead
from .models import RawLead, HarvestResult
from .scoring import rule_score


async def run_pipeline(fixture_path: str = None, base_url: str = None) -> HarvestResult:
    harvester = DenueHarvester(fixture_path=fixture_path)
    result = HarvestResult()
    async for lead in harvester.harvest():
        result.total += 1
        score = rule_score(lead)
        try:
            ok = await ingest_lead(lead, score=score, base_url=base_url)
            if ok:
                result.ingested += 1
            else:
                result.errors += 1
        except Exception:
            result.errors += 1
    return result
""", filePath">
C:\Users\PAV\Desktop\e-commerce\ark-sales\scripts\python\lead_harvester\pipeline.py