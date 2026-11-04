import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lead_harvester.denue import DenueHarvester, PROFILES_SCIAN, PROFILES_ENTIDADES
from lead_harvester.profile import HTTPProfiler, PATS_FUTURA
from lead_harvester.scoring import calcular_score_con_observaciones, recomendar_desarrollos_futura
from lead_harvester.ingest import build_payload


def test_futura_profile_scian_and_entidades():
    h = DenueHarvester(profile="futura_capital", fixture_path="lead_harvester/fixtures/denue_futura_sample.json")
    assert h.profile == "futura_capital"
    assert "31" in h.entidades  # Yucatán
    assert "621111" in PROFILES_SCIAN["futura_capital"]  # Médicos especialistas
    assert "493111" in PROFILES_SCIAN["futura_capital"]  # Almacenes y CEDIS
    assert "531210" in PROFILES_SCIAN["futura_capital"]  # Brokers e inmobiliarias


def test_futura_fixture_extracts_phone_email_and_recommends_products():
    async def run():
        h = DenueHarvester(profile="futura_capital", fixture_path="lead_harvester/fixtures/denue_futura_sample.json")
        leads = [l async for l in h.harvest()]
        assert len(leads) == 3

        # 1. Clínica en Mérida -> MB Medical Tower
        clinica = leads[0]
        assert clinica.telefono == "9999441122"
        assert clinica.email == "direccion@clinicasureste.mx"
        assert clinica.tenant_id == "acc_futura_capital"
        payload_clinica = build_payload(clinica, score=85)
        assert "futura_mb_medical_tower" in payload_clinica.account_context["productos_interes"]
        assert payload_clinica.contact_phone == "9999441122"
        assert payload_clinica.contact_email == "direccion@clinicasureste.mx"
        assert payload_clinica.tenant_id == "acc_futura_capital"

        # 2. Logística en Progreso -> Logistic Park
        logistica = leads[1]
        payload_logistica = build_payload(logistica, score=88)
        assert payload_logistica.account_context["productos_interes"] == ["futura_logistic_park"]
        assert payload_logistica.contact_phone == "9999358899"

        # 3. Broker en Mérida -> Preventas y portafolio patrimonial
        broker = leads[2]
        payload_broker = build_payload(broker, score=90)
        assert "futura_soletta_sisal" in payload_broker.account_context["productos_interes"]
        assert "futura_azureno" in payload_broker.account_context["productos_interes"]

    asyncio.run(run())


def test_http_profiler_futura_signals_and_contacts():
    profiler = HTTPProfiler()
    html = """
    <html>
      <body>
        <h1>Clínica de Especialidades Médicas y Cirugía Ambulatoria</h1>
        <p>Inversión en patrimonio y plusvalía en desarrollos de Yucatán.</p>
        <a href="https://wa.me/529991112233">WhatsApp Citas</a>
        <a href="mailto:contacto@clinicamerida.mx">Correo</a>
      </body>
    </html>
    """
    senales = profiler._detect(html, PATS_FUTURA)
    assert "SENAL_SALUD_ESPECIALISTA" in senales
    assert "SENAL_INVERSION_PATRIMONIAL" in senales

    phones = profiler._extract_phones(html)
    emails = profiler._extract_emails(html)
    assert "529991112233" in phones
    assert "contacto@clinicamerida.mx" in emails


def test_scoring_with_futura_observations():
    h = DenueHarvester(profile="futura_capital", fixture_path="lead_harvester/fixtures/denue_futura_sample.json")

    async def run():
        leads = [l async for l in h.harvest()]
        clinica = leads[0]
        obs = [
            {"signal_code": "SENAL_SALUD_ESPECIALISTA", "confidence": 0.9},
            {"signal_code": "WHATSAPP_CORPORATIVO", "confidence": 0.95},
        ]
        score, dolor = calcular_score_con_observaciones(clinica, obs)
        assert score >= 80
        assert dolor == "inversion_consultorio_medico"
        prods = recomendar_desarrollos_futura(clinica, obs)
        assert "futura_mb_medical_tower" in prods

    asyncio.run(run())


def test_quintana_roo_medical_tourism_and_american_doctor_signals():
    profiler = HTTPProfiler()
    html = """
    <html>
      <body>
        <h1>Cancun International Plastic Surgery & Dental Clinic</h1>
        <p>Welcoming US patients and Canadian patients with board certified surgeons.</p>
        <p>Our bilingual doctors are trained in the USA and members of the American Dental Association.</p>
        <a href="https://wa.me/529981234567">WhatsApp Direct</a>
      </body>
    </html>
    """
    senales = profiler._detect(html, PATS_FUTURA)
    assert "SENAL_TURISMO_MEDICO" in senales
    assert "SENAL_DOCTOR_AMERICANO_BILINGUE" in senales
    assert "SENAL_CIRUGIA_ALTO_TICKET" in senales

    # Test scoring with these high-value signals
    h = DenueHarvester(profile="futura_capital", fixture_path="lead_harvester/fixtures/denue_futura_sample.json")
    async def run():
        leads = [l async for l in h.harvest()]
        lead = leads[0]
        obs = [
            {"signal_code": "SENAL_TURISMO_MEDICO", "confidence": 0.95},
            {"signal_code": "SENAL_DOCTOR_AMERICANO_BILINGUE", "confidence": 0.9},
        ]
        score, dolor = calcular_score_con_observaciones(lead, obs)
        assert score >= 85
        assert dolor == "turismo_medico_expansion"
        prods = recomendar_desarrollos_futura(lead, obs)
        assert "futura_the_mb_hotel" in prods
        assert "futura_soletta_sisal" in prods

    asyncio.run(run())


def test_futura_clusters_target_only_quintana_roo():
    from lead_harvester.denue import FUTURA_GEO_CLUSTERS
    # Verify there are no Merida coordinates in FUTURA_GEO_CLUSTERS
    for c in FUTURA_GEO_CLUSTERS:
        coords = c["coords"]
        # Merida latitude is ~20.9-21.05 and longitude ~ -89.6
        lat, lon = [float(x) for x in coords.split(",")]
        # Ensure longitude is in Quintana Roo (~ -86.8 to -87.5) and NOT Merida (~ -89.6)
        assert lon > -88.0, f"Found non-Quintana Roo cluster: {c}"

