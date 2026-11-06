"""Hybrid scoring: cheap rules first."""
from __future__ import annotations

from typing import Optional
from .models import RawLead

PAIN_KEYWORDS = {
    "SAT": 20,
    "cartera vencida": 25,
    "morosidad": 20,
    "CFDI": 15,
    "multas": 20,
    "cobranza": 10,
    "préstamo": 20,
    "prestamo": 20,
    "crédito": 20,
    "credito": 20,
    "fintech": 20,
    "sofom": 20,
    # Señales contables y fiscales para Ark Ledger
    "contabilidad": 20,
    "despacho contable": 25,
    "contadores": 20,
    "auditoría": 20,
    "asesoría fiscal": 25,
    "nóminas": 15,
    "fiscal": 15,
    # Señales de alta intención para Futura Capital Partners
    "medicina especializada": 25,
    "consultorio": 20,
    "clínica": 20,
    "turismo médico": 30,
    "medical tourism": 30,
    "american board": 30,
    "board certified": 25,
    "cirugía plástica": 25,
    "plastic surgery": 25,
    "cirugía bariátrica": 25,
    "bariatric": 25,
    "reproducción asistida": 25,
    "fertilidad": 25,
    "dental clinic": 20,
    "odontología": 20,
    "wellness": 20,
    "almacenes": 25,
    "logística": 25,
    "cedis": 25,
    "autotransporte": 20,
    "inmobiliarias": 25,
    "bienes raíces": 25,
    "preventa": 20,
    "inversiones": 20,
    "hotel": 20,
}

SCIAN_TO_FUTURA_PRODUCTS: dict[str, list[str]] = {
    # Cluster Salud -> MB Medical Tower + Paseos Temozón
    "621111": ["futura_mb_medical_tower", "futura_paseos_temozon"],
    "621112": ["futura_mb_medical_tower", "futura_paseos_temozon"],
    "621211": ["futura_mb_medical_tower", "futura_paseos_temozon"],
    "621511": ["futura_mb_medical_tower", "futura_paseos_temozon"],
    "622111": ["futura_mb_medical_tower", "futura_paseos_temozon"],
    # Cluster Turismo Médico / Quintana Roo -> MB Medical Tower + Hotelería y Preventas Patrimoniales
    "621491": ["futura_mb_medical_tower", "futura_the_mb_hotel", "futura_soletta_sisal", "futura_azureno"],
    "621399": ["futura_mb_medical_tower", "futura_the_mb_hotel", "futura_soletta_sisal", "futura_azureno"],
    # Cluster Industrial / Logístico -> Logistic Park (Tamanché)
    "484111": ["futura_logistic_park"],
    "484121": ["futura_logistic_park"],
    "493111": ["futura_logistic_park"],
    "488511": ["futura_logistic_park"],
    # Cluster Hospitalidad -> The MB Hotel + Costa Yucateca
    "721111": ["futura_the_mb_hotel", "futura_soletta_sisal", "futura_soletta_chicxulub"],
    "721190": ["futura_the_mb_hotel", "futura_soletta_sisal", "futura_soletta_chicxulub"],
    # Cluster Brokers e Inversión Patrimonial -> Portafolio Completo / Preventas
    "531210": ["futura_soletta_sisal", "futura_azureno", "futura_aldea_balha", "futura_paseos_temozon", "futura_recoleta"],
    "531311": ["futura_soletta_sisal", "futura_azureno", "futura_aldea_balha", "futura_paseos_temozon"],
    "523920": ["futura_the_mb_hotel", "futura_mb_medical_tower", "futura_logistic_park", "futura_soletta_sisal"],
    "531110": ["futura_paseos_temozon", "futura_the_mb_hotel", "futura_soletta_chicxulub"],
    "551110": ["futura_logistic_park", "futura_mb_medical_tower", "futura_the_mb_hotel"],
}


def recomendar_desarrollos_futura(raw_lead: RawLead, observaciones: Optional[list[dict]] = None) -> list[str]:
    """Mapea el código SCIAN y señales web del prospecto a los desarrollos exactos de Futura Capital."""
    productos: list[str] = []
    scian = (raw_lead.scian_code or "").strip()
    if scian in SCIAN_TO_FUTURA_PRODUCTS:
        for p in SCIAN_TO_FUTURA_PRODUCTS[scian]:
            if p not in productos:
                productos.append(p)

    for obs in observaciones or []:
        sc = obs.get("signal_code")
        if sc == "SENAL_SALUD_ESPECIALISTA":
            for p in ("futura_mb_medical_tower", "futura_paseos_temozon"):
                if p not in productos:
                    productos.append(p)
        elif sc == "SENAL_LOGISTICA_CEDIS":
            if "futura_logistic_park" not in productos:
                productos.append("futura_logistic_park")
        elif sc == "SENAL_BROKER_INMOBILIARIO":
            for p in ("futura_soletta_sisal", "futura_azureno", "futura_aldea_balha", "futura_recoleta"):
                if p not in productos:
                    productos.append(p)
        elif sc == "SENAL_INVERSION_PATRIMONIAL":
            for p in ("futura_the_mb_hotel", "futura_soletta_chicxulub", "futura_paseos_temozon"):
                if p not in productos:
                    productos.append(p)
        elif sc in ("SENAL_TURISMO_MEDICO", "SENAL_DOCTOR_AMERICANO_BILINGUE", "SENAL_CIRUGIA_ALTO_TICKET"):
            for p in ("futura_the_mb_hotel", "futura_soletta_sisal", "futura_azureno", "futura_paseos_temozon", "futura_mb_medical_tower"):
                if p not in productos:
                    productos.append(p)

    if not productos and raw_lead.tenant_id == "acc_futura_capital":
        productos = ["futura_soletta_sisal", "futura_azureno", "futura_paseos_temozon"]
    elif not productos and raw_lead.tenant_id == "acc_ark_ledger":
        productos = ["ledger_pro", "ledger_freemium"]
    return productos


def rule_score(lead: RawLead) -> int:
    text = f"{lead.actividad} {lead.razon_social}".lower()
    score = 30
    for kw, w in PAIN_KEYWORDS.items():
        if kw.lower() in text:
            score += w
    if lead.telefono:
        score += 10
    if lead.email and not lead.email.endswith("@harvest.arksystems.local") and not lead.email.startswith("lead_"):
        score += 20
    elif lead.email:
        score += 5
    return min(score, 100)


def calcular_score_con_observaciones(raw_lead: RawLead, observaciones: list[dict]) -> tuple[int, str]:
    score = rule_score(raw_lead)
    dolor_scores: dict[str, float] = {}
    for obs in observaciones:
        sc = obs.get("signal_code")
        conf = obs.get("confidence", 1.0)
        if sc == "DOLOR_SAT":
            score += int(20 * conf)
            dolor_scores["fiscal"] = dolor_scores.get("fiscal", 0) + 20 * conf
        elif sc == "DOLOR_MOROSIDAD":
            score += int(25 * conf)
            dolor_scores["cobranza"] = dolor_scores.get("cobranza", 0) + 25 * conf
        elif sc in ("SENAL_PRESTAMO_DIGITAL", "SENAL_COBRANZA_CREDITO"):
            score += int(25 * conf)
            dolor_scores["cobranza_credito_digital"] = dolor_scores.get("cobranza_credito_digital", 0) + 25 * conf
        elif sc == "DOLOR_CFDI":
            score += int(15 * conf)
            dolor_scores["fiscal"] = dolor_scores.get("fiscal", 0) + 15 * conf
        elif sc == "SOFTWARE_CONTABLE":
            score += int(10 * conf)
        elif sc == "TIENDA_ONLINE":
            score += int(15 * conf)
            dolor_scores["ecommerce"] = dolor_scores.get("ecommerce", 0) + 15 * conf
        elif sc == "SENAL_SALUD_ESPECIALISTA":
            score += int(25 * conf)
            dolor_scores["inversion_consultorio_medico"] = dolor_scores.get("inversion_consultorio_medico", 0) + 25 * conf
        elif sc == "SENAL_TURISMO_MEDICO":
            score += int(30 * conf)
            dolor_scores["turismo_medico_expansion"] = dolor_scores.get("turismo_medico_expansion", 0) + 30 * conf
        elif sc == "SENAL_DOCTOR_AMERICANO_BILINGUE":
            score += int(25 * conf)
            dolor_scores["turismo_medico_inversion_patrimonial"] = dolor_scores.get("turismo_medico_inversion_patrimonial", 0) + 25 * conf
        elif sc == "SENAL_CIRUGIA_ALTO_TICKET":
            score += int(25 * conf)
            dolor_scores["clinica_alto_ticket_inversion"] = dolor_scores.get("clinica_alto_ticket_inversion", 0) + 25 * conf
        elif sc == "SENAL_LOGISTICA_CEDIS":
            score += int(25 * conf)
            dolor_scores["expansion_logistica_cedis"] = dolor_scores.get("expansion_logistica_cedis", 0) + 25 * conf
        elif sc == "SENAL_BROKER_INMOBILIARIO":
            score += int(25 * conf)
            dolor_scores["alianza_broker_inmobiliario"] = dolor_scores.get("alianza_broker_inmobiliario", 0) + 25 * conf
        elif sc == "SENAL_INVERSION_PATRIMONIAL":
            score += int(20 * conf)
            dolor_scores["inversion_patrimonial_yucatan"] = dolor_scores.get("inversion_patrimonial_yucatan", 0) + 20 * conf
        elif sc in ("WHATSAPP_CORPORATIVO", "EMAIL_CORPORATIVO"):
            score += int(10 * conf)

    if dolor_scores:
        dolor_principal = max(dolor_scores, key=dolor_scores.get)
    elif raw_lead.tenant_id == "acc_futura_capital":
        scian = (raw_lead.scian_code or "").strip()
        if scian.startswith("62"):
            dolor_principal = "inversion_consultorio_medico"
        elif scian.startswith(("48", "49")):
            dolor_principal = "expansion_logistica_cedis"
        elif scian in ("531210", "531311", "523920"):
            dolor_principal = "alianza_broker_inmobiliario"
        else:
            dolor_principal = "inversion_patrimonial_yucatan"
    elif raw_lead.harvest_profile == "fintech_credit_app":
        dolor_principal = "cobranza_credito_digital"
    elif raw_lead.harvest_profile == "sipres_sofom":
        dolor_principal = "cobranza_sofom"
    elif raw_lead.tenant_id == "acc_ark_ledger":
        dolor_principal = "cierre_fiscal_y_cfdi"
    else:
        dolor_principal = "cobranza"
    return min(score, 100), dolor_principal
