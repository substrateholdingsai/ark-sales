import os
import sqlite3
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from enrich_futura_leads import build_contact_update_sql


def make_item(decision="needs_review", confidence=85):
    fields = {
        "phone": "+529991112233",
        "email": "contacto@clinica.example",
        "whatsapp": "+529994445566",
        "doctor_name": "Dra. Ana Pérez",
    }
    return {
        "contact_id": "ct_example",
        "decision": decision,
        "actionability_score": 50,
        "confidence_score": 55,
        "data": fields,
        "evidence": [
            {"field": field, "normalized": value, "confidence": confidence}
            for field, value in fields.items()
        ],
    }


def test_needs_review_saves_confident_fields_into_crm_columns_without_overwriting_real_values():
    sql = build_contact_update_sql(make_item(), "run_1")

    assert "phone = CASE WHEN" in sql
    assert "email = CASE WHEN" in sql
    assert "whatsapp = CASE WHEN" in sql
    assert "whatsapp_url" not in sql
    assert "name = CASE WHEN" in sql
    assert "title = CASE WHEN" in sql
    assert "enrichment_status = CASE WHEN enrichment_status = 'enriched'" in sql
    assert "ELSE phone END" in sql
    assert "ELSE email END" in sql
    assert "ELSE whatsapp END" in sql


def test_fields_below_evidence_threshold_are_not_applied():
    sql = build_contact_update_sql(make_item(confidence=69), "run_1")

    assert "phone = CASE WHEN" not in sql
    assert "email = CASE WHEN" not in sql
    assert "whatsapp = CASE WHEN" not in sql
    assert "name = CASE WHEN" not in sql
    assert "THEN 'enriched' ELSE 'needs_review' END" in sql


def test_quarantined_lead_keeps_evidence_and_status_without_applying_contact_values():
    sql = build_contact_update_sql(make_item(decision="quarantined"), "run_1")

    assert "phone = CASE WHEN" not in sql
    assert "email = CASE WHEN" not in sql
    assert "whatsapp = CASE WHEN" not in sql
    assert "name = CASE WHEN" not in sql
    assert "enrichment_status = 'quarantined'" in sql


def test_update_sql_fills_placeholders_and_preserves_existing_contact_data():
    connection = sqlite3.connect(":memory:")
    connection.execute(
        """
        CREATE TABLE sales_contacts (
            id TEXT PRIMARY KEY, phone TEXT, raw_phone TEXT, email TEXT, whatsapp TEXT,
            name TEXT, title TEXT, enrichment_status TEXT, actionability_score INTEGER,
            confidence_score INTEGER, enrichment_run_id TEXT, updated_at TEXT
        )
        """
    )
    connection.executemany(
        "INSERT INTO sales_contacts (id, phone, email, whatsapp, name, title, enrichment_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            ("ct_example", "+521111111111", "real@example.test", "+522222222222", "Nombre Real", "Especialista", "enriched"),
            ("ct_placeholder", "-", "old@harvest.arksystems.local", None, "Contacto Corporativo", "Dirección General", None),
        ],
    )

    connection.execute(build_contact_update_sql(make_item(), "run_1"))
    placeholder_item = make_item()
    placeholder_item["contact_id"] = "ct_placeholder"
    connection.execute(build_contact_update_sql(placeholder_item, "run_1"))

    existing = connection.execute(
        "SELECT phone, email, whatsapp, name, title, enrichment_status FROM sales_contacts WHERE id = 'ct_example'"
    ).fetchone()
    assert existing == (
        "+521111111111",
        "real@example.test",
        "+522222222222",
        "Nombre Real",
        "Especialista",
        "enriched",
    )
    placeholder = connection.execute(
        "SELECT phone, email, whatsapp, name, title FROM sales_contacts WHERE id = 'ct_placeholder'"
    ).fetchone()
    assert placeholder == (
        "+529991112233",
        "contacto@clinica.example",
        "+529994445566",
        "Dra. Ana Pérez",
        "Titular / Director Médico",
    )
