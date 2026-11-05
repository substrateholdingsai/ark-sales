"""Pipeline orchestrator for FASE 1."""
from __future__ import annotations

import json
import os
from typing import Optional

from .denue import DenueHarvester
from .ingest import ingest_lead
from .models import RawLead, HarvestResult
from .scoring import rule_score


async def run_pipeline(
    source: str = "denue",
    limit: Optional[int] = None,
    enrich: bool = True,
    fixture_path: Optional[str] = None,
    base_url: Optional[str] = None,
    profile: str = "ark",
    plaza: Optional[str] = None,
    query: Optional[str] = None,
) -> HarvestResult:
    if source != "denue":
        raise ValueError(f"Unsupported source: {source}")
    harvester = DenueHarvester(
        fixture_path=fixture_path,
        profile=profile,
        plaza=plaza,
        custom_query=query,
    )
    result = HarvestResult(source=source)
    stream = harvester.harvest_and_enrich() if enrich else harvester.harvest()
    seen_ids: set[str] = set()
    count = 0
    async for lead in stream:
        if limit is not None and count >= limit:
            break
        if lead.lead_id in seen_ids or (lead.email and lead.email in seen_ids):
            result.deduped += 1
            continue
        seen_ids.add(lead.lead_id)
        if lead.email:
            seen_ids.add(lead.email)
        count += 1
        result.total += 1
        score = getattr(lead, "score", 0) or rule_score(lead)
        if not enrich:
            score = rule_score(lead)
        try:
            ok = await ingest_lead(lead, score=score, base_url=base_url)
            if ok:
                result.ingested += 1
            else:
                result.errors += 1
        except Exception as exc:
            print(f"[pipeline exception] {lead.lead_id}: {exc}", file=__import__("sys").stderr)
            result.errors += 1
    return result


def write_report(result: HarvestResult, path: str = "harvest_report.json") -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result.model_dump(), f, ensure_ascii=False, indent=2)
