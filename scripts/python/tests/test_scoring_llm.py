import pytest
from unittest.mock import AsyncMock, patch
from lead_harvester.scoring_llm import scoring_hibrido, clasificar_con_llm


@pytest.mark.asyncio
async def test_clasificar_con_llm_success():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "dolor_principal": "fiscal",
        "vertical": "fiscal",
        "confianza": 0.9,
        "razonamiento": "Empresa menciona SAT y usa CONTPAQi"
    }
    with patch('httpx.AsyncClient.post', return_value=mock_response):
        result = await clasificar_con_llm(
            lead_id="test-123",
            raw_lead={"razon_social": "Despacho Test"},
            observaciones=[{"signal_code": "DOLOR_SAT", "value_text": "Detectado", "confidence": 0.9}],
        )
    assert result["dolor_principal"] == "fiscal"
    assert result["confianza"] == 0.9


@pytest.mark.asyncio
async def test_scoring_hibrido_low_score_skip_llm():
    score, dolor, vertical = await scoring_hibrido(
        lead_id="test-123", raw_lead={}, observaciones=[],
        score_reglas=30, dolor_reglas="bundle")
    assert score == 30
    assert dolor == "bundle"


@pytest.mark.asyncio
async def test_scoring_hibrido_high_score_uses_llm():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "dolor_principal": "cobranza",
        "vertical": "cobranza",
        "confianza": 0.85,
        "razonamiento": "Empresa menciona cartera vencida"
    }
    with patch('httpx.AsyncClient.post', return_value=mock_response):
        score, dolor, vertical = await scoring_hibrido(
            lead_id="test-123", raw_lead={}, observaciones=[{"signal_code": "DOLOR_MOROSIDAD", "value_text": "Detectado", "confidence": 0.8}],
            score_reglas=60, dolor_reglas="cobranza")
    assert score == 68
    assert dolor == "cobranza"
    assert vertical == "cobranza"


@pytest.mark.asyncio
async def test_scoring_hibrido_llm_fallback():
    mock_response = AsyncMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    with patch('httpx.AsyncClient.post', return_value=mock_response):
        score, dolor, vertical = await scoring_hibrido(
            lead_id="test-123", raw_lead={}, observaciones=[],
            score_reglas=70, dolor_reglas="fiscal")
    assert score == 70
    assert dolor == "fiscal"


@pytest.mark.asyncio
async def test_scoring_hibrido_low_confidence_fallback():
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "dolor_principal": "ecommerce",
        "vertical": "ecommerce",
        "confianza": 0.5,
        "razonamiento": "No estoy seguro"
    }
    with patch('httpx.AsyncClient.post', return_value=mock_response):
        score, dolor, vertical = await scoring_hibrido(
            lead_id="test-123", raw_lead={}, observaciones=[],
            score_reglas=65, dolor_reglas="bundle")
    assert score == 65
    assert dolor == "bundle"
