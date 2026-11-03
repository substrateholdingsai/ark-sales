import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lead_harvester.denue import DenueHarvester, PROFILES_SCIAN, PROFILES_ENTIDADES
from lead_harvester.scoring import calcular_score_con_observaciones
from lead_harvester.ingest import build_payload
from lead_harvester.models import Vertical, Destination


def test_ark_ledger_profile_scian_and_entidades():
    fixture = os.path.join(os.path.dirname(__file__), "..", "lead_harvester", "fixtures", "denue_ark_ledger_sample.json")
    h = DenueHarvester(profile="ark_ledger", fixture_path=fixture)
    assert h.profile == "ark_ledger"
    assert "0" in h.entidades  # Cobertura nacional
    assert "541211" in PROFILES_SCIAN["ark_ledger"]  # Despachos de contabilidad y auditoría
    assert "541212" in PROFILES_SCIAN["ark_ledger"]  # Auditoría fiscal
    assert "541219" in PROFILES_SCIAN["ark_ledger"]  # Otros servicios contables
    assert "541110" in PROFILES_SCIAN["ark_ledger"]  # Bufetes jurídicos / fiscalistas
    assert "561490" in PROFILES_SCIAN["ark_ledger"]  # Agencias de nómina y cobranza


def test_ark_ledger_fixture_extracts_phone_email_and_recommends_products():
    fixture = os.path.join(os.path.dirname(__file__), "..", "lead_harvester", "fixtures", "denue_ark_ledger_sample.json")

    async def run():
        h = DenueHarvester(profile="ark_ledger", fixture_path=fixture)
        leads = [l async for l in h.harvest()]
        assert len(leads) == 3

        # 1. Despacho Contable Díaz & Asociados -> tenant acc_ark_ledger, vertical fiscal, ledger_pro/freemium
        despacho = leads[0]
        assert despacho.telefono == "9999201020"
        assert despacho.email == "contacto@diazcontadores.mx"
        assert despacho.tenant_id == "acc_ark_ledger"
        payload_despacho = build_payload(despacho, score=85)
        assert payload_despacho.vertical == Vertical.FISCAL
        assert payload_despacho.destination == Destination.LEDGER
        assert "ledger_pro" in payload_despacho.account_context["productos_interes"]
        assert "ledger_freemium" in payload_despacho.account_context["productos_interes"]
        assert payload_despacho.contact_phone == "9999201020"
        assert payload_despacho.contact_email == "contacto@diazcontadores.mx"
        assert payload_despacho.tenant_id == "acc_ark_ledger"

        # 2. Bufete Fiscal -> dolor fiscal y cierre
        fiscalista = leads[1]
        payload_fiscalista = build_payload(fiscalista, score=80)
        assert payload_fiscalista.vertical == Vertical.FISCAL
        assert payload_fiscalista.destination == Destination.LEDGER
        assert payload_fiscalista.tenant_id == "acc_ark_ledger"

        # 3. Servicios de Nómina -> dolor y productos
        nomina = leads[2]
        payload_nomina = build_payload(nomina, score=82)
        assert payload_nomina.vertical == Vertical.FISCAL
        assert payload_nomina.destination == Destination.LEDGER
        assert payload_nomina.tenant_id == "acc_ark_ledger"

    asyncio.run(run())


def test_scoring_with_ark_ledger_observations():
    fixture = os.path.join(os.path.dirname(__file__), "..", "lead_harvester", "fixtures", "denue_ark_ledger_sample.json")
    h = DenueHarvester(profile="ark_ledger", fixture_path=fixture)

    async def run():
        leads = [l async for l in h.harvest()]
        despacho = leads[0]
        obs = [
            {"signal_code": "DOLOR_SAT", "confidence": 0.9},
            {"signal_code": "SOFTWARE_CONTABLE", "confidence": 0.8},
            {"signal_code": "DOLOR_CFDI", "confidence": 0.85},
        ]
        score, dolor = calcular_score_con_observaciones(despacho, obs)
        assert score >= 75
        assert dolor == "fiscal"

    asyncio.run(run())
