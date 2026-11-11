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
    assert p.contact_name is None


def test_build_payload_keeps_phone_and_whatsapp_separate_and_only_uses_named_contact():
    lead = RawLead(
        lead_id="abc",
        razon_social="Clínica Ejemplo",
        source="denue",
        telefono="+529991112233",
        whatsapp="+529994445566",
        harvest_profile="canaco_chamber",
        raw={"contacto_clave": "Dra. Ana Pérez"},
    )

    payload = build_payload(lead)

    assert payload.account_context["despacho_nombre"] == "Clínica Ejemplo"
    assert payload.contact_name == "Dra. Ana Pérez"
    assert payload.contact_phone == "+529991112233"
    assert payload.contact_whatsapp == "+529994445566"


def test_build_payload_does_not_save_generated_canaco_contact_label_as_person():
    lead = RawLead(
        lead_id="abc",
        razon_social="Cámara de Comercio",
        source="canaco",
        harvest_profile="canaco_chamber",
        raw={"contacto_clave": "Titular de Dirección General"},
    )

    assert build_payload(lead).contact_name is None


def test_tamano():
    assert tamano_from_rango(None) == "1-5"
    assert tamano_from_rango("251 y más personas") == "50+"
