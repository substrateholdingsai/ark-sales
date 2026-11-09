# scripts/python/tests/test_staypuft_scrapling.py
"""
Suite de pruebas unitarias para el extractor StayPuft + Scrapling
"""

import pytest
import sys
import os

# Asegurar importación del runner
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from staypuft_scrapling_runner import normalize_mexican_phone, ScraplingProspectResearcher


def test_normalize_mexican_phone_valid():
    # Estándar nacional 10 dígitos
    p, ok = normalize_mexican_phone("9991234567")
    assert ok is True
    assert p == "+529991234567"

    # Con código de país +52 y espacios
    p, ok = normalize_mexican_phone("+52 (999) 123-4567")
    assert ok is True
    assert p == "+529991234567"

    # Formato móvil legacy 13 dígitos 521...
    p, ok = normalize_mexican_phone("5219991234567")
    assert ok is True
    assert p == "+529991234567"


def test_normalize_mexican_phone_malformed():
    # Longitudes inválidas (concatenadas con prefijo 01 legacy)
    p, ok = normalize_mexican_phone("+222012223729222") # 15 dígitos
    assert ok is False
    assert p is None

    p, ok = normalize_mexican_phone("+81018183440404") # 14 dígitos
    assert ok is False
    assert p is None

    p, ok = normalize_mexican_phone("12345") # Muy corto
    assert ok is False
    assert p is None

    p, ok = normalize_mexican_phone("0180012345") # Inicia con 0
    assert ok is False
    assert p is None

    p, ok = normalize_mexican_phone(None)
    assert ok is False
    assert p is None


def test_scrapling_extract_whatsapp_and_software():
    html = """
    <!DOCTYPE html>
    <html>
      <head><title>Despacho Contable Peninsular</title></head>
      <body>
        <h1>Despacho Fiscal y Contable de Mérida</h1>
        <p>Servicios de contabilidad electrónica SAT con soporte en Contpaqi y Aspel.</p>
        <p>El socio titular cuenta con 20 años de experiencia.</p>
        <div class="contact-box">
          <a class="btn-whatsapp" href="https://wa.me/529994567890?text=Hola">Escríbenos por WhatsApp</a>
          <a class="btn-tel" href="tel:9999201122">Tel: (999) 920-1122</a>
        </div>
      </body>
    </html>
    """
    researcher = ScraplingProspectResearcher()
    data = researcher.extract_from_html(html, source_url="https://despachomerida.com")

    assert data["whatsapp"] == "+529994567890"
    assert data["whatsapp_valid"] is True
    assert data["telefono"] == "+529994567890"
    assert data["fuente_telefono"] == "website"
    assert "https://wa.me/529994567890" in data["telefono_url"]
    assert "contpaqi" in data["software_detectado"]
    assert "aspel" in data["software_detectado"]
    assert data["confidence"] == 90


def test_scrapling_extract_phone_when_no_whatsapp():
    html = """
    <html>
      <body>
        <h2>Auditoría Contable Integral</h2>
        <p>Expertos en dictámenes fiscales.</p>
        <p>Comunícate al conmutador: <a href="tel:+529991122334">999 112 2334</a></p>
      </body>
    </html>
    """
    researcher = ScraplingProspectResearcher()
    data = researcher.extract_from_html(html, source_url="https://auditoriaintegral.mx")

    assert data["telefono"] == "+529991122334"
    assert data["whatsapp"] is None
    assert data["whatsapp_valid"] is False
    assert data["fuente_telefono"] == "website"
