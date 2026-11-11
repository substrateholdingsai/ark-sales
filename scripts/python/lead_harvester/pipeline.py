"""Pipeline orchestrator for FASE 1."""
from __future__ import annotations

import json
import os
from typing import Optional

from .canaco import CanacoHarvester
from .denue import DenueHarvester
from .ingest import ingest_lead
from .models import RawLead, HarvestResult
from .preview_enrichment import enrich_candidate_preview, normalize_phone, normalize_text, verify_target_municipality
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
    preview_enriched: bool = False,
) -> HarvestResult:
    if preview_enriched:
        preview_only = True
    if preview_enriched and (source != "denue" or profile != "futura_capital"):
        raise ValueError("Enriched preview is limited to DENUE profile='futura_capital'.")
    if source not in ("denue", "sipres", "canaco"):
        raise ValueError(f"Unsupported source: {source}")
    if source == "denue":
        harvester = DenueHarvester(
            fixture_path=fixture_path,
            profile=profile,
            plaza=plaza,
            custom_query=query,
        )
    elif source == "canaco":
        harvester = CanacoHarvester(
            fixture_path=fixture_path,
            plaza=plaza,
            custom_query=query,
            limit=limit,
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
    seen_phones: set[str] = set()
    seen_name_municipality: set[tuple[str, str]] = set()
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
        score = getattr(lead, "score", 0) or rule_score(lead)
        if not enrich:
            score = rule_score(lead)
        if preview_only:
            if preview_enriched and lead.tenant_id != "acc_futura_capital":
                raise ValueError("Enriched preview rejected a lead outside tenant acc_futura_capital.")
            enrichment = None
            if preview_enriched:
                try:
                    enrichment = await enrich_candidate_preview(lead)
                except Exception as exc:
                    enrichment = {
                        "fields": {},
                        "enrichment_skipped": {
                            "all": f"enrichment_failed_{type(exc).__name__}"
                        },
                        "location": verify_target_municipality(lead),
                    }

            location = enrichment["location"] if enrichment else verify_target_municipality(lead)
            fields = enrichment["fields"] if enrichment else {}
            candidate = {
                "lead_id": lead.lead_id,
                "name": lead.razon_social,
                "email": lead.email or (fields.get("email") or {}).get("value"),
                "phone": lead.telefono or (fields.get("phone") or {}).get("value"),
                "whatsapp": lead.whatsapp or (fields.get("whatsapp") or {}).get("value"),
                "website": lead.sitio_web or (fields.get("website") or {}).get("value"),
                "doctor_name": (fields.get("doctor_name") or {}).get("value"),
                "municipality": location.get("municipality"),
                "municipality_verified_for_guadalajara_zapopan": location.get(
                    "verified_for_guadalajara_zapopan", False
                ),
                "municipality_source": location.get("source"),
                "state": location.get("state"),
                "status": lead.raw.get("status"),
                "sector": lead.raw.get("sector"),
                "official_registry_url": lead.raw.get("registry_url"),
                "score": score,
            }
            if enrichment:
                field_evidence = dict(fields)
                for field, value, raw_field in (
                    ("phone", lead.telefono, "Telefono"),
                    ("whatsapp", lead.whatsapp, "WhatsApp"),
                    ("email", lead.email, "Correo_e"),
                    ("website", lead.sitio_web, "Sitio_internet"),
                ):
                    if value and field not in field_evidence:
                        field_evidence[field] = {
                            "value": value,
                            "source_url": lead.raw.get("URL") or lead.raw.get("url"),
                            "source": "DENUE",
                            "confidence": 100,
                            "raw_field": raw_field,
                        }
                field_evidence["municipality"] = {
                    "value": location.get("municipality"),
                    "source_url": location.get("source_url"),
                    "source": location.get("source") or "DENUE location not verified",
                    "confidence": location.get("confidence", 0),
                    "verified_for_guadalajara_zapopan": location.get(
                        "verified_for_guadalajara_zapopan", False
                    ),
                }
                candidate["field_evidence"] = field_evidence
                candidate["enrichment_skipped"] = enrichment["enrichment_skipped"]

            normalized_phone = normalize_phone(candidate["phone"])
            if preview_enriched and normalized_phone and normalized_phone in seen_phones:
                result.deduped += 1
                result.deduped_by_phone += 1
                continue
            normalized_name = normalize_text(lead.razon_social)
            normalized_municipality = (
                normalize_text(location.get("municipality"))
                if location.get("verified_for_guadalajara_zapopan")
                else ""
            )
            name_location = (
                (normalized_name, normalized_municipality)
                if normalized_name and normalized_municipality
                else None
            )
            if preview_enriched and name_location and name_location in seen_name_municipality:
                result.deduped += 1
                result.deduped_by_name_municipality += 1
                continue
            if preview_enriched and normalized_phone:
                seen_phones.add(normalized_phone)
            if preview_enriched and name_location:
                seen_name_municipality.add(name_location)
            result.candidates.append(candidate)
            result.total += 1
            continue
        result.total += 1
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
