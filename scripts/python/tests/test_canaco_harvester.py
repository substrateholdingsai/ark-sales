import asyncio
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lead_harvester.canaco import CanacoHarvester, CANACO_SEED_REGISTRY
from lead_harvester.ingest import build_payload
from lead_harvester.models import Vertical, Destination


def test_canaco_harvester_seed_registry_populated():
    h = CanacoHarvester()
    assert len(CANACO_SEED_REGISTRY) >= 10
    assert any(c["id"] == "canaco_merida" for c in CANACO_SEED_REGISTRY)
    assert any(c["id"] == "canaco_cdmx" for c in CANACO_SEED_REGISTRY)
    assert any(c["id"] == "canaco_monterrey" for c in CANACO_SEED_REGISTRY)
    assert any(c["id"] == "canaco_guadalajara" for c in CANACO_SEED_REGISTRY)


@pytest.mark.asyncio
async def test_canaco_harvester_harvest_all():
    h = CanacoHarvester()
    leads = [l async for l in h.harvest()]
    assert len(leads) == len(CANACO_SEED_REGISTRY)
    for lead in leads:
        assert lead.tenant_id == "acc_ark_ledger"
        assert lead.source == "canaco"
        assert lead.harvest_profile == "canaco_chamber"
        assert lead.scian_code == "813910"
        assert lead.score == 90
        assert lead.telefono is not None
        assert len(lead.telefono) == 10
        assert lead.email is not None
        assert "@" in lead.email


@pytest.mark.asyncio
async def test_canaco_harvester_plaza_and_query_filters():
    # Filtro por plaza Yucatán
    h_yuc = CanacoHarvester(plaza="yucatan")
    leads_yuc = [l async for l in h_yuc.harvest()]
    assert len(leads_yuc) == 1
    assert leads_yuc[0].ciudad == "Mérida"
    assert leads_yuc[0].estado == "Yucatán"

    # Filtro por query Guadalajara
    h_gdl = CanacoHarvester(custom_query="guadalajara")
    leads_gdl = [l async for l in h_gdl.harvest()]
    assert len(leads_gdl) == 1
    assert "Guadalajara" in leads_gdl[0].razon_social


@pytest.mark.asyncio
async def test_canaco_harvester_fixture_and_payload_building():
    fixture_path = os.path.join(
        os.path.dirname(__file__), "..", "lead_harvester", "fixtures", "canaco_sample.json"
    )
    h = CanacoHarvester(fixture_path=fixture_path)
    leads = [l async for l in h.harvest()]
    assert len(leads) == 5

    merida = next(l for l in leads if "merida" in l.lead_id)
    assert merida.razon_social == "Cámara Nacional de Comercio, Servicios y Turismo de Mérida"
    assert merida.telefono == "9999255140"
    assert merida.email == "presidencia@canacomerida.com.mx"

    payload = build_payload(merida, score=95)
    assert payload.destination == Destination.LEDGER
    assert payload.vertical == Vertical.FISCAL
    assert payload.tenant_id == "acc_ark_ledger"
    assert payload.score == 95
    assert "ledger_pro" in payload.account_context["productos_interes"]
    assert "ledger_freemium" in payload.account_context["productos_interes"]
    assert "siem_landing_white_label" in payload.account_context["productos_interes"]
    assert payload.account_context["presidente"] == "Levy Abraham Macari"
    assert payload.account_context["director_general"] == "Lic. Roberto González"
    assert payload.account_context["operador_siem"] is True
    assert payload.contact_phone == "9999255140"
    assert payload.contact_email == "presidencia@canacomerida.com.mx"
    assert "CANACO" in payload.conversation_summary
