import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lead_harvester.denue import (
    FINTECH_GEO_CLUSTERS,
    FINTECH_PLAZA_CENTERS,
    PROFILES_SCIAN,
    DenueHarvester,
)
from lead_harvester.ingest import build_payload
from lead_harvester.models import Destination, RawLead, Vertical
from lead_harvester.profile import HTTPProfiler, PATS_FINTECH, ProfileResult
from lead_harvester.scoring import calcular_score_con_observaciones


def sample_denue_record():
    return {
        "CLEE": "FINTECH_SAMPLE",
        "Nombre": "Crédito Digital Ejemplo",
        "Actividad": "Institución de crédito",
        "Codigo_Actividad": "522390",
        "Sitio_internet": "https://credito.example.test",
        "Ubicacion": "CIUDAD DE MEXICO",
    }


def test_fintech_profile_uses_searches_without_inventing_scian():
    harvester = DenueHarvester(profile="fintech_credit_app", fixture_path="unused")
    lead = harvester._normalize(sample_denue_record())

    assert PROFILES_SCIAN["fintech_credit_app"] == []
    assert len(FINTECH_GEO_CLUSTERS) == len(FINTECH_PLAZA_CENTERS) * 5
    assert all(cluster["scian_default"] is None for cluster in FINTECH_GEO_CLUSTERS)
    assert lead.scian_code == "522390"
    assert lead.tenant_id == "acc_ark_ledger"
    assert lead.harvest_profile == "fintech_credit_app"


def test_fintech_profile_routes_to_angel_and_keeps_ledger_complementary():
    lead = DenueHarvester(profile="fintech_credit_app", fixture_path="unused")._normalize(sample_denue_record())
    payload = build_payload(lead, score=75)

    assert payload.destination == Destination.ANGEL
    assert payload.vertical == Vertical.COBRANZA
    assert payload.tenant_id == "acc_ark_ledger"
    assert payload.harvest_profile == "fintech_credit_app"
    assert payload.account_context["productos_interes"] == ["angel", "ledger"]
    assert payload.account_context["dolor_principal"] == "cobranza_credito_digital"


def test_fintech_signals_and_profile_override_scoring():
    lead = RawLead(
        razon_social="Prestamista Digital",
        actividad="crédito en línea",
        source="denue",
        tenant_id="acc_ark_ledger",
        harvest_profile="fintech_credit_app",
    )
    score, dolor = calcular_score_con_observaciones(
        lead,
        [{"signal_code": "SENAL_PRESTAMO_DIGITAL", "confidence": 0.8}],
    )
    profiler = HTTPProfiler()
    try:
        signals = profiler._detect("Solicita tu préstamo digital y paga tu crédito en línea", PATS_FINTECH)
    finally:
        asyncio.run(profiler.close())

    assert score > 30
    assert dolor == "cobranza_credito_digital"
    assert "SENAL_PRESTAMO_DIGITAL" in signals
    assert "SENAL_COBRANZA_CREDITO" in signals


def test_enrichment_preserves_fintech_routing(monkeypatch):
    class FixtureHarvester(DenueHarvester):
        async def _guardar_observaciones(self, account_id, observaciones):
            return None

    class EmptyProfiler:
        async def profile_company(self, dominio):
            return ProfileResult(dominio=dominio)

        async def close(self):
            return None

    async def fixed_scoring(**kwargs):
        return 80, "cierre_fiscal_y_cfdi", "fiscal"

    monkeypatch.setattr("lead_harvester.base.HTTPProfiler", EmptyProfiler)
    monkeypatch.setattr("lead_harvester.base.scoring_hibrido", fixed_scoring)

    async def run():
        harvester = FixtureHarvester(profile="fintech_credit_app", fixture_path="unused")
        async def fixture():
            yield harvester._normalize(sample_denue_record())
        harvester.harvest = fixture
        return [lead async for lead in harvester.harvest_and_enrich()]

    leads = asyncio.run(run())
    assert leads[0].vertical == "cobranza"
    assert leads[0].dolor_principal == "cobranza_credito_digital"
    assert leads[0].productos_interes == ["angel", "ledger"]


def test_fintech_cli_profile_is_available_for_dry_run(capsys):
    from lead_harvester.main import main

    assert asyncio.run(main([
        "--profile", "fintech_credit_app",
        "--plaza", "cdmx",
        "--limit", "25",
        "--dry-run",
    ])) == 0
    output = capsys.readouterr().out
    assert '"profile": "fintech_credit_app"' in output
    assert '"plaza": "cdmx"' in output
    assert '"limit": 25' in output
