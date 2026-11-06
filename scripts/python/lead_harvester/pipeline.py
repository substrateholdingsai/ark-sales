"""Pipeline orchestrator for FASE 1."""
from __future__ import annotations

import json
import os
from typing import Optional

from .denue import DenueHarvester
from .ingest import ingest_lead
from .models import RawLead, HarvestResult
from .scoring import rule_score
from .sipres import SipresHarvester


async def run_pipeline(
    source: str = "denue",
    limit: Optional[int] = None,
    enrich: bool = True,
    fixture_path: Optional[str] = None,
    base_url: Optional[str] = None,
    profile: str = "ark",
    plaza: Optional[str] = None,
    query: Optional[str] = None,
    require_email: bool = False,
    preview_only: bool = False,
) -> HarvestResult:
    if source not in ("denue", "sipres"):
        raise ValueError(f"Unsupported source: {source}")
    if source == "denue":
        harvester = DenueHarvester(
            fixture_path=fixture_path,
            profile=profile,
            plaza=plaza,
            custom_query=query,
        )
    else:
        if profile != "sipres_sofom":
            raise ValueError("SIPRES source requires profile='sipres_sofom'")
        if plaza:
            raise ValueError("SIPRES source does not support --plaza")
        sipres_limit = limit if limit is not None else 50
        if not 1 <= sipres_limit <= 50:
            raise ValueError("SIPRES pilot limit must be between 1 and 50")
        harvester = SipresHarvester(
            fixture_path=fixture_path,
            limit=sipres_limit,
            custom_query=query,
        )
    result = HarvestResult(source=source)
    stream = harvester.harvest_and_enrich() if enrich and not preview_only else harvester.harvest()
    seen_ids: set[str] = set()
    count = 0
    enforce_email = require_email or (profile == "ark_ledger")
    async for lead in stream:
        if limit is not None and count >= limit:
            break
        if lead.lead_id in seen_ids or (lead.email and lead.email in seen_ids):
            result.deduped += 1
            continue

        # Si se exige email (campañas de mailing como Ark Ledger), asegurar email real antes de contabilizarlo
        if enforce_email:
            has_real_email = bool(
                lead.email
                and "@" in lead.email
                and not lead.email.endswith("@harvest.arksystems.local")
                and not lead.email.startswith("lead_")
                and "example.com" not in lead.email
            )
            if not has_real_email:
                continue

        seen_ids.add(lead.lead_id)
        if lead.email:
            seen_ids.add(lead.email)
        count += 1
        result.total += 1
        score = getattr(lead, "score", 0) or rule_score(lead)
        if not enrich:
            score = rule_score(lead)
        if preview_only:
            result.candidates.append({
                "lead_id": lead.lead_id,
                "name": lead.razon_social,
                "email": lead.email,
                "phone": lead.telefono,
                "website": lead.sitio_web,
                "state": lead.estado,
                "status": lead.raw.get("status"),
                "sector": lead.raw.get("sector"),
                "official_registry_url": lead.raw.get("registry_url"),
                "score": score,
            })
            continue
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
