"""Read-only contact enrichment for explicit DENUE preview runs."""
from __future__ import annotations

import asyncio
import ipaddress
import os
import re
import socket
import unicodedata
from typing import Any, Optional
from urllib.parse import quote, urlparse

import httpx
import phonenumbers
from phonenumbers import PhoneNumberFormat
from rapidfuzz import fuzz

SERPER_PLACES_URL = "https://google.serper.dev/places"
TARGET_MUNICIPALITIES = {"guadalajara", "zapopan"}


def normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", without_accents.lower()).split())


def normalize_phone(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        parsed = phonenumbers.parse(value, "MX")
    except phonenumbers.NumberParseException:
        return None
    if not phonenumbers.is_valid_number(parsed):
        return None
    return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)


def verify_target_municipality(lead: Any) -> dict[str, Any]:
    raw_municipality = str(
        lead.raw.get("Municipio") or lead.raw.get("ciudad") or lead.ciudad or ""
    ).strip()
    raw_state = str(
        lead.raw.get("Entidad") or lead.raw.get("estado") or lead.estado or ""
    ).strip()
    municipality = raw_municipality or None
    verified = (
        normalize_text(raw_municipality) in TARGET_MUNICIPALITIES
        and normalize_text(raw_state) == "jalisco"
    )
    if lead.raw.get("Municipio") and lead.raw.get("Entidad"):
        source = "DENUE.Municipio/Entidad"
    elif lead.raw.get("ciudad") and lead.raw.get("estado"):
        source = "DENUE.ciudad/estado"
    elif lead.raw.get("Ubicacion"):
        source = "DENUE.Ubicacion"
    else:
        source = "DENUE parsed location" if raw_municipality and raw_state else None
    return {
        "municipality": municipality,
        "state": lead.estado or raw_state or None,
        "verified_for_guadalajara_zapopan": verified,
        "source": source,
        "source_url": lead.raw.get("URL") or lead.raw.get("url"),
        "confidence": 100 if verified else (60 if municipality else 0),
    }


def _field(value: Any, source_url: Optional[str], confidence: int, source: str) -> dict[str, Any]:
    return {
        "value": value,
        "source_url": source_url,
        "source": source,
        "confidence": confidence,
    }


def _phone_from_html(html: str) -> Optional[str]:
    match = re.search(r"""href=["']tel:([^"']+)["']""", html, re.IGNORECASE)
    return normalize_phone(match.group(1)) if match else None


def _whatsapp_from_html(html: str) -> Optional[str]:
    match = re.search(
        r"""(?:wa\.me/|api\.whatsapp\.com/send\?[^"'>]*phone=)\+?([\d\s().-]{10,20})""",
        html,
        re.IGNORECASE,
    )
    return normalize_phone(match.group(1)) if match else None


def _email_from_html(html: str) -> Optional[str]:
    match = re.search(
        r"""href=["']mailto:([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+)""",
        html,
        re.IGNORECASE,
    )
    email = match.group(1).strip().lower() if match else None
    return email if email and not email.endswith((".png", ".jpg", ".jpeg", ".svg")) else None


def _doctor_from_name(name: str) -> Optional[str]:
    match = re.search(
        r"\b(?:DR\.?|DRA\.?|DOCTOR|DOCTORA)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+){1,3})",
        name,
        re.IGNORECASE,
    )
    return match.group(0).strip() if match else None


def _municipality_from_address(address: Optional[str]) -> Optional[str]:
    normalized = normalize_text(address)
    if "jalisco" not in normalized and not re.search(r"\bjal\b", normalized):
        return None
    for municipality in ("Guadalajara", "Zapopan"):
        if normalize_text(municipality) in normalized:
            return municipality
    return None


async def _is_safe_public_https_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return False
    if parsed.port not in (None, 443):
        return False
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith(".localhost") or host.endswith(".local"):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        pass
    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo,
            host,
            443,
            type=socket.SOCK_STREAM,
        )
    except OSError:
        return False
    if not addresses:
        return False
    try:
        return all(ipaddress.ip_address(address[4][0]).is_global for address in addresses)
    except ValueError:
        return False


async def enrich_candidate_preview(
    lead: Any,
    *,
    client: Any = None,
    serper_api_key: Optional[str] = None,
) -> dict[str, Any]:
    """Enrich one lead in memory. Uses lookup-only HTTP and never persists data."""
    api_key = serper_api_key or os.getenv("SERPER_API_KEY")
    own_client = client is None
    http = client or httpx.AsyncClient(
        timeout=12.0,
        follow_redirects=False,
        headers={"User-Agent": "ArkSales-ReadOnly-Preview/1.0", "Accept-Language": "es-MX,es;q=0.9"},
    )
    fields: dict[str, dict[str, Any]] = {}
    skipped: dict[str, str] = {}
    municipality = verify_target_municipality(lead)
    try:
        known_doctor = _doctor_from_name(lead.razon_social)
        if known_doctor:
            fields["doctor_name"] = _field(known_doctor, None, 90, "DENUE establishment name")

        website = lead.sitio_web
        if website and not urlparse(website if "://" in website else f"https://{website}").hostname:
            skipped["website"] = "denue_website_is_not_a_valid_url"

        place: Optional[dict[str, Any]] = None
        place_url: Optional[str] = None
        match_confidence = 0
        if api_key:
            municipality_name = municipality["municipality"] if municipality["verified_for_guadalajara_zapopan"] else "Guadalajara Jalisco"
            query = f"{lead.razon_social} {municipality_name} cirujano plástico"
            try:
                response = await http.post(
                    SERPER_PLACES_URL,
                    headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"q": query, "gl": "mx", "hl": "es"},
                )
                response.raise_for_status()
                places = response.json().get("places", [])
                if places:
                    candidate = places[0]
                    title = str(candidate.get("title") or "")
                    match_confidence = int(fuzz.token_set_ratio(title, lead.razon_social))
                    if match_confidence >= 70:
                        place = candidate
                        place_id = candidate.get("placeId")
                        if place_id:
                            place_url = f"https://www.google.com/maps/place/?q=place_id:{quote(str(place_id))}"
                        elif title := str(candidate.get("title") or ""):
                            address = str(candidate.get("address") or "")
                            place_url = f"https://www.google.com/maps/search/?api=1&query={quote(f'{title} {address}')}"
            except (httpx.HTTPError, ValueError, TypeError):
                skipped["serper"] = "serper_places_lookup_failed"
        else:
            skipped["serper"] = "SERPER_API_KEY_not_configured"

        if place:
            place_title = str(place.get("title") or "")
            place_doctor = _doctor_from_name(place_title)
            if place_doctor and "doctor_name" not in fields:
                fields["doctor_name"] = _field(
                    place_doctor,
                    place_url,
                    match_confidence,
                    "Google Places title",
                )
            if not lead.telefono and place.get("phoneNumber"):
                normalized = normalize_phone(str(place["phoneNumber"]))
                if normalized:
                    fields["phone"] = _field(normalized, place_url, match_confidence, "Google Places")
            if not website and place.get("website"):
                website = str(place["website"])
                fields["website"] = _field(website, place_url, match_confidence, "Google Places")
            place_municipality = _municipality_from_address(place.get("address"))
            if not municipality["verified_for_guadalajara_zapopan"] and place_municipality:
                municipality = {
                    "municipality": place_municipality,
                    "state": "Jalisco",
                    "verified_for_guadalajara_zapopan": True,
                    "source": "Google Places address",
                    "source_url": place_url,
                    "confidence": match_confidence,
                }

        if website:
            normalized_url = website if "://" in website else f"https://{website}"
            parsed_url = urlparse(normalized_url)
            if not await _is_safe_public_https_url(normalized_url):
                skipped["website_lookup"] = "website_url_is_not_a_safe_public_https_url"
            else:
                try:
                    response = await http.get(normalized_url)
                    response.raise_for_status()
                    html = response.text
                    if not lead.telefono and "phone" not in fields:
                        phone = _phone_from_html(html)
                        if phone:
                            fields["phone"] = _field(phone, str(response.url), 90, "official website tel link")
                    if not lead.whatsapp:
                        whatsapp = _whatsapp_from_html(html)
                        if whatsapp:
                            fields["whatsapp"] = _field(whatsapp, str(response.url), 90, "official website WhatsApp link")
                    if not lead.email:
                        email = _email_from_html(html)
                        if email:
                            fields["email"] = _field(email, str(response.url), 85, "official website mailto link")
                    if "doctor_name" not in fields:
                        doctor = _doctor_from_name(html)
                        if doctor:
                            fields["doctor_name"] = _field(doctor, str(response.url), 80, "official website")
                except (httpx.HTTPError, ValueError):
                    skipped["website_lookup"] = "official_website_lookup_failed"

        for field in ("phone", "whatsapp", "email", "website", "doctor_name"):
            has_existing_value = {
                "phone": lead.telefono,
                "whatsapp": lead.whatsapp,
                "email": lead.email,
                "website": lead.sitio_web,
                "doctor_name": None,
            }[field]
            if field not in fields and not has_existing_value:
                if field == "website" or not website:
                    reason = skipped.get("serper", "no_matching_verified_source_found")
                elif "website_lookup" in skipped:
                    reason = skipped["website_lookup"]
                else:
                    reason = "no_matching_verified_source_found"
                skipped.setdefault(field, reason)
        if not municipality["verified_for_guadalajara_zapopan"]:
            skipped["municipality"] = "no_verified_guadalajara_zapopan_municipality_found"

        return {
            "fields": fields,
            "enrichment_skipped": skipped,
            "location": municipality,
        }
    finally:
        if own_client:
            await http.aclose()
