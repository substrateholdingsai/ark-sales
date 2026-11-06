import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from lead_harvester.ingest import build_payload
from lead_harvester.models import Destination, Vertical
from lead_harvester.pipeline import run_pipeline
from lead_harvester.sipres import (
    SIPRES_PROFILE,
    SIPRES_SEARCH_URL,
    SipresHarvester,
    _SearchResultsParser,
)


SEARCH_RESULTS = """
<table><tbody><tr>
  <td>68070</td>
  <td><a onclick="window.open('../../jsp/home_publico.jsp?idins=14981')">Arrendadora Bancrea, S.A. de C.V., SOFOM, E.R.</a></td>
  <td>Abancrea</td>
  <td><b>En operación</b></td>
  <td>Sociedades Financieras de Objeto Múltiple, E.R.</td>
  <td>Nuevo León</td>
  <td>01/10/2026 Consejo</td>
  <td></td>
</tr></tbody></table>
"""

INSTITUTION_DETAIL = """
<a href="http://www.gob.mx/condusef/">CONDUSEF</a>
<div class="nombreif">Arrendadora Bancrea, S.A. de C.V., SOFOM, E.R.</div>
<div><b>Estatus</b><hr/><b>En operación</b></div>
<div><b>RFC</b><hr/>SER120621R32</div>
<div><b>Página WEB</b><hr/><a href="http://www.bancrea.com">www.bancrea.com</a></div>
<div><b>Correo electrónico</b><hr/><a href="mailto:contacto@bancrea.com">contacto@bancrea.com</a></div>
<div><b>Ubicación y teléfono</b><br/>- Teléfono (s) (81) 4739 7106</div>
"""


def test_sipres_search_parser_extracts_active_sofom_listing():
    parser = _SearchResultsParser()
    parser.feed(SEARCH_RESULTS)

    assert parser.rows == [{
        "registration_key": "68070",
        "idins": "14981",
        "name": "Arrendadora Bancrea, S.A. de C.V., SOFOM, E.R.",
        "short_name": "Abancrea",
        "status": "En operación",
        "sector": "Sociedades Financieras de Objeto Múltiple, E.R.",
        "state": "Nuevo León",
        "updated": "01/10/2026 Consejo",
        "not_locatable": "",
    }]


def test_sipres_profile_extracts_public_contact_and_routes_to_angel():
    detail = SipresHarvester._parse_detail(INSTITUTION_DETAIL)
    record = {
        "registration_key": "68070",
        "idins": "14981",
        "name": "Arrendadora Bancrea, S.A. de C.V., SOFOM, E.R.",
        "short_name": "Abancrea",
        "status": "En operación",
        "sector": "Sociedades Financieras de Objeto Múltiple, E.R.",
        "state": "Nuevo León",
        "updated": "01/10/2026 Consejo",
    }
    lead = SipresHarvester._normalize({**record, **detail})
    payload = build_payload(lead, score=70)

    assert lead.lead_id == "lead_sipres_14981"
    assert lead.harvest_profile == SIPRES_PROFILE
    assert lead.rfc == "SER120621R32"
    assert lead.sitio_web == "http://www.bancrea.com"
    assert lead.email == "contacto@bancrea.com"
    assert lead.telefono == "(81) 4739 7106"
    assert lead.estado == "Nuevo León"
    assert payload.destination == Destination.ANGEL
    assert payload.vertical == Vertical.COBRANZA
    assert payload.tenant_id == "acc_ark_ledger"
    assert payload.harvest_source == "sipres"
    assert payload.account_context["productos_interes"] == ["angel", "ledger"]
    assert payload.account_context["sipres_registry_url"].endswith("idins=14981")


def test_sipres_prioritizes_credit_profiles_and_rejects_bad_ids():
    assert SipresHarvester._relevance_score("SOFOM de Crédito Personal") > (
        SipresHarvester._relevance_score("Arrendadora y Factoraje")
    )
    with pytest.raises(ValueError, match="numeric institution ID"):
        SipresHarvester._normalize({"idins": "../bad", "name": "Invalid"})


def test_sipres_does_not_treat_email_as_website_when_site_is_missing():
    detail = SipresHarvester._parse_detail("""
      <div><b>Página WEB</b><hr/>No disponible</div>
      <div><b>Correo electrónico</b><hr/><a href="mailto:contacto@sofom.example">contacto@sofom.example</a></div>
    """)

    assert detail["sitio_web"] is None
    assert detail["email"] == "contacto@sofom.example"


def test_sipres_preview_is_bounded_and_never_ingests(tmp_path, monkeypatch):
    fixture = tmp_path / "sipres.json"
    fixture.write_text(json.dumps([{
        "idins": "14981",
        "registration_key": "68070",
        "name": "Arrendadora Bancrea, S.A. de C.V., SOFOM, E.R.",
        "status": "En operación",
        "sector": "Sociedades Financieras de Objeto Múltiple, E.R.",
        "state": "Nuevo León",
        "sitio_web": "https://bancrea.example",
        "email": "contacto@bancrea.example",
        "registry_url": "https://webapps.condusef.gob.mx/SIPRES/jsp/home_publico.jsp?idins=14981",
    }]), encoding="utf-8")

    async def fail_if_ingested(*args, **kwargs):
        raise AssertionError("preview must not ingest")

    monkeypatch.setattr("lead_harvester.pipeline.ingest_lead", fail_if_ingested)
    result = asyncio.run(run_pipeline(
        source="sipres",
        profile="sipres_sofom",
        limit=1,
        enrich=False,
        fixture_path=str(fixture),
        preview_only=True,
    ))

    assert result.total == 1
    assert result.ingested == 0
    assert result.candidates[0]["lead_id"] == "lead_sipres_14981"
    assert result.candidates[0]["email"] == "contacto@bancrea.example"


def test_sipres_source_and_endpoint_are_public_registry():
    assert SIPRES_SEARCH_URL.startswith("https://webapps.condusef.gob.mx/SIPRES/")
