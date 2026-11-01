"""Hybrid scoring: cheap rules first."""
from __future__ import annotations

import re
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
""", filePath">
C:\Users\PAV\Desktop\e-commerce\ark-sales\scripts\python\lead_harvester\scoring.py