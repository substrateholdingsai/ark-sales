import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lead_harvester import base, pipeline
from lead_harvester.denue import parse_ubicacion
from lead_harvester.main import main
from lead_harvester.models import RawLead
from lead_harvester.preview_enrichment import enrich_candidate_preview, verify_target_municipality


FIXTURE = Path(__file__).parent.parent / "lead_harvester" / "fixtures" / "denue_futura_sample.json"


def make_lead(
    lead_id="lead_1",
    name="Consultorio de Cirugía Plástica",
    phone=None,
    municipality="Guadalajara",
):
    return RawLead(
        lead_id=lead_id,
        razon_social=name,
        source="denue",
        telefono=phone,
        ciudad=municipality,
        estado="Jalisco",
        tenant_id="acc_futura_capital",
        harvest_profile="futura_capital",
        raw={"Municipio": municipality, "Entidad": "Jalisco"},
    )


class FixtureHarvester:
    def __init__(self, *args, **kwargs):
        pass

    async def harvest(self):
        yield make_lead()


def test_preview_enriched_returns_fields_and_never_calls_write_paths(monkeypatch, capsys):
    async def fake_enrich(lead):
        return {
            "fields": {
                "phone": {
                    "value": "+523331234567",
                    "source_url": "https://maps.example/place/1",
                    "source": "Google Places",
                    "confidence": 92,
                }
            },
            "enrichment_skipped": {"whatsapp": "no_matching_verified_source_found"},
            "location": {
                "municipality": "Guadalajara",
                "state": "Jalisco",
                "verified_for_guadalajara_zapopan": True,
                "source": "DENUE.Municipio/Entidad",
                "source_url": None,
                "confidence": 100,
            },
        }

    async def fail_if_called(*args, **kwargs):
        raise AssertionError("preview must not write observations or CRM records")

    async def fail_register(*args, **kwargs):
        raise AssertionError("preview must not register harvest runs")

    monkeypatch.setattr(pipeline, "DenueHarvester", FixtureHarvester)
    monkeypatch.setattr(pipeline, "enrich_candidate_preview", fake_enrich)
    monkeypatch.setattr(pipeline, "ingest_lead", fail_if_called)
    monkeypatch.setattr(base.BaseHarvester, "_guardar_observaciones", fail_if_called)
    monkeypatch.setattr("lead_harvester.main._register_run", fail_register)
    monkeypatch.setattr("lead_harvester.main._finish_run", fail_register)
    monkeypatch.setenv("INEGI_TOKEN", "test-token")

    exit_code = asyncio.run(
        main([
            "--profile", "futura_capital",
            "--fixture", str(FIXTURE),
            "--preview-enriched",
            "--limit", "25",
        ])
    )
    captured = capsys.readouterr()
    result = json.loads(captured.out)

    assert exit_code == 0
    assert result["total"] == 1
    assert result["ingested"] == 0
    assert result["candidates"][0]["phone"] == "+523331234567"
    assert result["candidates"][0]["field_evidence"]["phone"]["source_url"].startswith("https://")
    assert result["candidates"][0]["field_evidence"]["phone"]["confidence"] == 92
    assert result["candidates"][0]["municipality_verified_for_guadalajara_zapopan"]
    assert captured.err.count("PREVIEW ONLY — 0 writes") == 2


def test_plain_preview_does_not_run_enrichment(monkeypatch):
    async def fail_if_enriched(lead):
        raise AssertionError("--preview alone must keep DENUE-only behavior")

    monkeypatch.setattr(pipeline, "DenueHarvester", FixtureHarvester)
    monkeypatch.setattr(pipeline, "enrich_candidate_preview", fail_if_enriched)
    result = asyncio.run(
        pipeline.run_pipeline(
            profile="futura_capital",
            fixture_path=str(FIXTURE),
            preview_only=True,
        )
    )

    assert result.total == 1
    assert result.ingested == 0
    assert "field_evidence" not in result.candidates[0]


def test_failed_preview_enrichment_returns_no_invented_contact_data_or_writes(monkeypatch):
    async def fail_enrichment(lead):
        raise RuntimeError("lookup failed")

    async def fail_if_write(*args, **kwargs):
        raise AssertionError("preview must not invoke a write path")

    monkeypatch.setattr(pipeline, "DenueHarvester", FixtureHarvester)
    monkeypatch.setattr(pipeline, "enrich_candidate_preview", fail_enrichment)
    monkeypatch.setattr(pipeline, "ingest_lead", fail_if_write)
    monkeypatch.setattr(base.BaseHarvester, "_guardar_observaciones", fail_if_write)
    result = asyncio.run(
        pipeline.run_pipeline(
            profile="futura_capital",
            fixture_path=str(FIXTURE),
            preview_only=True,
            preview_enriched=True,
        )
    )

    candidate = result.candidates[0]
    assert result.ingested == 0
    assert candidate["phone"] is None
    assert candidate["whatsapp"] is None
    assert candidate["enrichment_skipped"]["all"] == "enrichment_failed_RuntimeError"


def test_enriched_preview_deduplicates_by_e164_phone(monkeypatch):
    class DuplicateHarvester:
        def __init__(self, *args, **kwargs):
            pass

        async def harvest(self):
            yield make_lead("lead_1", "Clínica A", municipality="Guadalajara")
            yield make_lead("lead_2", "Clínica B", municipality="Zapopan")

    async def fake_enrich(lead):
        phone = "+523331234567" if lead.lead_id == "lead_1" else "33 3123 4567"
        return {
            "fields": {"phone": {"value": phone, "source_url": "https://source.example", "confidence": 90}},
            "enrichment_skipped": {},
            "location": {
                "municipality": lead.ciudad,
                "state": "Jalisco",
                "verified_for_guadalajara_zapopan": True,
            },
        }

    monkeypatch.setattr(pipeline, "DenueHarvester", DuplicateHarvester)
    monkeypatch.setattr(pipeline, "enrich_candidate_preview", fake_enrich)
    monkeypatch.setattr(
        pipeline,
        "ingest_lead",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("enriched preview must not ingest")),
    )
    result = asyncio.run(
        pipeline.run_pipeline(
            profile="futura_capital",
            preview_enriched=True,
        )
    )

    assert result.total == 1
    assert result.deduped == 1
    assert result.deduped_by_phone == 1
    assert result.deduped_by_name_municipality == 0


def test_enriched_preview_deduplicates_by_normalized_name_and_municipality(monkeypatch):
    class DuplicateHarvester:
        def __init__(self, *args, **kwargs):
            pass

        async def harvest(self):
            yield make_lead("lead_1", "Clínica del Sol", municipality="Guadalajara")
            yield make_lead("lead_2", "CLINICA DEL SOL", municipality="Guadalajara")

    async def fake_enrich(lead):
        return {
            "fields": {},
            "enrichment_skipped": {},
            "location": {
                "municipality": lead.ciudad,
                "state": "Jalisco",
                "verified_for_guadalajara_zapopan": True,
            },
        }

    monkeypatch.setattr(pipeline, "DenueHarvester", DuplicateHarvester)
    monkeypatch.setattr(pipeline, "enrich_candidate_preview", fake_enrich)
    result = asyncio.run(
        pipeline.run_pipeline(
            profile="futura_capital",
            preview_only=True,
            preview_enriched=True,
        )
    )

    assert result.total == 1
    assert result.deduped_by_name_municipality == 1


def test_enriched_preview_rejects_leads_outside_futura_tenant(monkeypatch):
    class OtherTenantHarvester:
        def __init__(self, *args, **kwargs):
            pass

        async def harvest(self):
            lead = make_lead()
            lead.tenant_id = "acc_other_tenant"
            yield lead

    async def fail_if_enriched(lead):
        raise AssertionError("out-of-tenant lead must be rejected before lookup")

    monkeypatch.setattr(pipeline, "DenueHarvester", OtherTenantHarvester)
    monkeypatch.setattr(pipeline, "enrich_candidate_preview", fail_if_enriched)

    with pytest.raises(ValueError, match="outside tenant acc_futura_capital"):
        asyncio.run(
            pipeline.run_pipeline(
                profile="futura_capital",
                preview_only=True,
                preview_enriched=True,
            )
        )


@pytest.mark.asyncio
async def test_lookup_enrichment_uses_mock_http_only_and_preserves_field_evidence(monkeypatch):
    class MockClient:
        async def post(self, url, **kwargs):
            assert url == "https://google.serper.dev/places"
            return httpx.Response(
                200,
                json={
                    "places": [{
                        "title": "Consultorio de Cirugía Plástica",
                        "phoneNumber": "33 3123 4567",
                        "website": "https://clinic.example",
                        "address": "Zapopan, Jalisco, Mexico",
                        "placeId": "place_1",
                    }]
                },
                request=httpx.Request("POST", url),
            )

        async def get(self, url):
            return httpx.Response(
                200,
                text='<a href="https://wa.me/523334445566">WhatsApp</a><a href="mailto:doctor@clinic.example">Email</a>',
                request=httpx.Request("GET", url),
            )

    monkeypatch.setattr(
        "lead_harvester.preview_enrichment.socket.getaddrinfo",
        lambda host, port, type: [
            (2, 1, 6, "", ("93.184.216.34", port))
        ],
    )
    result = await enrich_candidate_preview(
        make_lead("lead_1", municipality=None),
        client=MockClient(),
        serper_api_key="test-key",
    )

    assert result["fields"]["phone"]["value"] == "+523331234567"
    assert result["fields"]["phone"]["source_url"].startswith("https://")
    assert result["fields"]["whatsapp"]["value"] == "+523334445566"
    assert result["fields"]["email"]["value"] == "doctor@clinic.example"
    assert result["location"]["municipality"] == "Zapopan"
    assert result["location"]["verified_for_guadalajara_zapopan"]
    assert result["location"]["confidence"] >= 70


@pytest.mark.asyncio
async def test_missing_serper_key_and_unsafe_website_do_not_invent_contact_data(monkeypatch):
    class NoNetworkClient:
        async def post(self, *args, **kwargs):
            raise AssertionError("Serper must not be called without a configured key")

        async def get(self, *args, **kwargs):
            raise AssertionError("Unsafe website must not be fetched")

    monkeypatch.delenv("SERPER_API_KEY", raising=False)
    monkeypatch.setattr(
        "lead_harvester.preview_enrichment.socket.getaddrinfo",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("private host DNS lookup must not run")),
    )
    lead = make_lead()
    lead.sitio_web = "https://127.0.0.1/admin"

    result = await enrich_candidate_preview(lead, client=NoNetworkClient())

    assert result["fields"] == {}
    assert result["enrichment_skipped"]["serper"] == "SERPER_API_KEY_not_configured"
    assert result["enrichment_skipped"]["website_lookup"] == "website_url_is_not_a_safe_public_https_url"
    assert "phone" in result["enrichment_skipped"]
    assert "whatsapp" in result["enrichment_skipped"]


def test_state_only_does_not_verify_municipality():
    lead = make_lead(municipality=None)
    lead.raw = {"Entidad": "Jalisco"}

    result = verify_target_municipality(lead)

    assert result["municipality"] is None
    assert result["verified_for_guadalajara_zapopan"] is False


def test_explicit_municipality_and_state_in_denue_ubicacion_are_verified():
    municipality, state = parse_ubicacion({"Ubicacion": "GUADALAJARA, JALISCO"})
    lead = make_lead(municipality=municipality)
    lead.estado = state
    lead.raw = {"Ubicacion": "GUADALAJARA, JALISCO"}

    result = verify_target_municipality(lead)

    assert result["municipality"] == "Guadalajara"
    assert result["state"] == "Jalisco"
    assert result["verified_for_guadalajara_zapopan"] is True
    assert result["source"] == "DENUE.Ubicacion"
