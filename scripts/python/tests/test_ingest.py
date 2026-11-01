import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lead_harvester.ingest import build_payload, tamano_from_rango
from lead_harvester.models import RawLead


def test_build_payload():
    lead = RawLead(lead_id="abc", razon_social="Despacho", actividad="contabilidad", scian_code="541210", empleados_rango="6 a 10 personas", sitio_web="https://x.com", source="denue")
    p = build_payload(lead)
    assert p.version == 3
    assert p.account_context["despacho_nombre"] == "Despacho"
    assert p.account_context["tamano"] == "6-20"
    assert p.destination.value == "ledger"
    assert p.vertical.value == "fiscal"


def test_tamano():
    assert tamano_from_rango(None) == "1-5"
    assert tamano_from_rango("251 y más personas") == "50+"
