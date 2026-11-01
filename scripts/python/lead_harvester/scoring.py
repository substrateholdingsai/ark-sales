"""Hybrid scoring: cheap rules first."""
from __future__ import annotations

from .models import RawLead

PAIN_KEYWORDS = {
    "SAT": 20, "cartera vencida": 25, "morosidad": 20,
    "CFDI": 15, "multas": 20, "cobranza": 10,
}


def rule_score(lead: RawLead) -> int:
    text = f"{lead.actividad} {lead.razon_social}".lower()
    score = 30
    for kw, w in PAIN_KEYWORDS.items():
        if kw.lower() in text:
            score += w
    return min(score, 100)


def calcular_score_con_observaciones(raw_lead: RawLead, observaciones: list[dict]) -> tuple[int, str]:
    score = rule_score(raw_lead)
    dolor_scores: dict[str, float] = {}
    for obs in observaciones:
        sc = obs.get("signal_code")
        conf = obs.get("confidence", 1.0)
        if sc == "DOLOR_SAT":
            score += int(20 * conf); dolor_scores["fiscal"] = dolor_scores.get("fiscal", 0) + 20 * conf
        elif sc == "DOLOR_MOROSIDAD":
            score += int(25 * conf); dolor_scores["cobranza"] = dolor_scores.get("cobranza", 0) + 25 * conf
        elif sc == "DOLOR_CFDI":
            score += int(15 * conf); dolor_scores["fiscal"] = dolor_scores.get("fiscal", 0) + 15 * conf
        elif sc == "SOFTWARE_CONTABLE":
            score += int(10 * conf)
        elif sc == "TIENDA_ONLINE":
            score += int(15 * conf); dolor_scores["ecommerce"] = dolor_scores.get("ecommerce", 0) + 15 * conf
    dolor_principal = max(dolor_scores, key=dolor_scores.get) if dolor_scores else "cobranza"
    return min(score, 100), dolor_principal
