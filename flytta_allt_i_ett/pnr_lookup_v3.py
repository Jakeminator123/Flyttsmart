#!/usr/bin/env python3
"""
PNR lookup v3 — komplett datainsamling for flyttanmalan.

Forandringar jmf v2:
  - Nytt steg 2: Eniro-berikning (telefon, fastighetsbeteckning, postnummer, adress)
    Kor automatiskt efter Biluppgifter-uppslaget.
  - Alla externa uppslag ar inbyggda — inga importer fran andra mappar.
  - Resulterar i en slutpayload dar sa manga falt som mojligt ar fyllda.

Kor:
    python pnr_lookup_v3.py
    python pnr_lookup_v3.py 19900101-1234
    python pnr_lookup_v3.py 19900101-1234 --pap-api-key <KEY> --skip-eniro
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import importlib
import json
import os
import random
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────

BILUPPGIFTER_BASE = "https://biluppgifter.se"
ENIRO_BASE = "https://www.eniro.se"
PAP_API_URL = "https://api.papapi.se/lite/"

NOT_FOUND_PHRASES = (
    "Kunde inte hitta brukaren",
    "hittar inte den sida",
    "Ooups",
)
BLOCKED_PHRASES = (
    "Just a moment...",
    "Checking your browser",
    "Attention Required!",
    "Enable JavaScript and cookies",
    "cf-browser-verification",
    "cloudflare",
)

USER_AGENTS = [
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
]

PW_BLOCK_PATTERNS = [
    "**/*.{png,jpg,jpeg,gif,svg,ico,webp,avif}",
    "**/*.{css,woff,woff2,ttf,eot}",
    "**/api.pirsch.io/**",
    "**/fonts.googleapis.com/**",
    "**/fonts.gstatic.com/**",
    "**/www.googletagmanager.com/**",
    "**/www.google-analytics.com/**",
]


def _pick_ua() -> str:
    return random.choice(USER_AGENTS)


def _jitter(base_s: float) -> float:
    return max(0.2, base_s * (0.6 + random.random() * 0.8))


# ─────────────────────────────────────────────────────────────────────────────
#  PNR utilities
# ─────────────────────────────────────────────────────────────────────────────

def _luhn_check(nine_digits: str) -> int:
    total = 0
    for i, ch in enumerate(nine_digits):
        n = int(ch)
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return (10 - (total % 10)) % 10


def split_name(full_name: str) -> Tuple[str, str]:
    parts = [p for p in full_name.split() if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return " ".join(parts[:-1]), parts[-1]


def normalize_pnr(raw_value: str) -> str:
    raw_value = raw_value.strip()
    digits = re.sub(r"\D", "", raw_value)
    separator = "+"
    for char in raw_value:
        if char in "-+":
            separator = char
            break

    if len(digits) == 12:
        normalized = digits
    elif len(digits) == 10:
        yy = int(digits[:2])
        current = datetime.now()
        current_yy = current.year % 100
        century = current.year // 100
        if separator == "+":
            full_year = (century - 1) * 100 + yy
        else:
            full_year = century * 100 + yy
            if yy > current_yy:
                full_year -= 100
        normalized = f"{full_year:04d}{digits[2:]}"
    else:
        raise ValueError("Personnumret maste innehalla 10 eller 12 siffror.")

    try:
        datetime.strptime(normalized[:8], "%Y%m%d")
    except ValueError as exc:
        raise ValueError("Personnumret innehaller ett ogiltigt datum.") from exc

    last_ten = normalized[2:]
    if _luhn_check(last_ten[:9]) != int(last_ten[9]):
        raise ValueError("Ogiltigt personnummer (fel kontrollsiffra).")

    return normalized


# ─────────────────────────────────────────────────────────────────────────────
#  Biluppgifter — PNR → namn + adress + stad
# ─────────────────────────────────────────────────────────────────────────────

def _pnr_to_biluppgifter_url(pnr_digits: str) -> str:
    encoded = base64.b64encode(pnr_digits.encode()).decode()
    return f"{BILUPPGIFTER_BASE}/brukare/{encoded}/"


def _is_blocked(status_code: int, html: str) -> bool:
    if status_code >= 400:
        return True
    lowered = html.lower()
    return any(phrase.lower() in lowered for phrase in BLOCKED_PHRASES)


def _fetch_with_curl_cffi(url: str) -> Optional[str]:
    try:
        requests = importlib.import_module("curl_cffi.requests")
    except ImportError:
        return None
    response = requests.get(
        url,
        impersonate="chrome124",
        headers={"User-Agent": _pick_ua(), "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8"},
        timeout=25,
    )
    if _is_blocked(response.status_code, response.text):
        return None
    return response.text


def _fetch_with_playwright_sync(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright saknas. Kor: pip install playwright && playwright install chromium"
        ) from exc

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=_pick_ua(),
            locale="sv-SE",
            extra_http_headers={"Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8"},
        )
        page = ctx.new_page()
        for pattern in PW_BLOCK_PATTERNS:
            page.route(pattern, lambda route: route.abort())
        resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
        if resp is None:
            raise RuntimeError("Ingen HTTP-respons fran sidan.")
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status} fran {url}")
        page.wait_for_timeout(1200)
        html = page.content()
        browser.close()
        return html


def fetch_html(url: str) -> str:
    html = _fetch_with_curl_cffi(url)
    if html:
        return html
    return _fetch_with_playwright_sync(url)


def parse_biluppgifter_person(html: str, pnr_digits: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator=" ", strip=True)

    if any(phrase in text for phrase in NOT_FOUND_PHRASES):
        return None

    name_match = re.search(r"Visa\s+(.+?)\s+pa\s+Ratsit", text)
    if not name_match:
        name_match = re.search(r"Visa\s+(.+?)\s+på\s+Ratsit", text)
    full_name = name_match.group(1).strip() if name_match else ""

    if not full_name:
        fb = re.search(
            r"([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-\s]{1,50}),\s+en\s+privatperson", text
        )
        full_name = fb.group(1).strip() if fb else ""
    if not full_name:
        return None

    first_name, last_name = split_name(full_name)

    age_m = re.search(r"(\d{1,3})\s+(?:ar|år)", text)
    age = int(age_m.group(1)) if age_m else None

    city_m = re.search(r"bor\s+i\s+([A-ZÅÄÖ][a-zåäö]+(?:[\s-][A-ZÅÄÖ][a-zåäö]+)?)", text)
    city = city_m.group(1).strip() if city_m else ""

    addr_m = re.search(r"\bAdress\s+([^\n\r,]{3,80})", text)
    if addr_m:
        address = addr_m.group(1).strip()
        address = re.split(r"\s{2,}|Kontakt|Telefon|Fordon|Visa\s", address)[0].strip()
    else:
        address = ""

    return {
        "pnr": pnr_digits,
        "firstName": first_name,
        "lastName": last_name,
        "name": full_name,
        "fromCity": city,
        "fromStreetRaw": address,
        "age": age,
        "source": "biluppgifter",
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Eniro — namn + stad → telefon, fastighetsbeteckning, postnummer, adress
#
#  Krav: Playwright (async) — ny browser-kontext per sida undviker CF-throttling.
#  All logik ar inbyggd; inga importer fran externa mappar.
# ─────────────────────────────────────────────────────────────────────────────

async def _eniro_cf_wait(page, timeout_s: int = 12) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        title = await page.title()
        if title and "Vänta" not in title and "Just a moment" not in title:
            return True
        await page.wait_for_timeout(400)
    return False


async def _eniro_accept_cookies(page) -> None:
    try:
        btn = page.locator("button", has_text="GODKÄNN")
        await btn.wait_for(timeout=3000)
        await btn.click()
        await page.wait_for_timeout(300)
    except Exception:
        pass


def _extract_jsonld_person(html: str) -> Dict[str, Any]:
    blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL,
    )
    for raw in blocks:
        try:
            data = json.loads(raw.strip())
            for item in data.get("@graph", [data]):
                if item.get("@type") == "Person":
                    return item
        except Exception:
            pass
    return {}


def _extract_visible_fastighet(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ", strip=True)
    m = re.search(r"([\w\-\s]+:\d+)\s+\(\d+\)\s+är", text)
    return m.group(1).strip() if m else ""


async def _eniro_search(pw_browser, name: str, city: str = "",
                        max_results: int = 5) -> List[Dict[str, str]]:
    query = f"{name} {city}".strip() if city else name
    slug = quote_plus(query)
    url = f"{ENIRO_BASE}/{slug}/personer"
    persons: List[Dict[str, str]] = []

    ctx = await pw_browser.new_context(
        user_agent=_pick_ua(), locale="sv-SE",
        viewport={"width": 1366, "height": 768},
    )
    page = await ctx.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        ok = await _eniro_cf_wait(page)
        if not ok:
            return []
        await _eniro_accept_cookies(page)
        await page.wait_for_timeout(500)

        links = await page.locator("a[href*='/person']").all()
        seen: set[str] = set()
        for link in links:
            href = await link.get_attribute("href")
            pid = re.search(r"/(\d{6,12})/person", href or "")
            if pid and pid.group(1) not in seen:
                seen.add(pid.group(1))
                full = f"{ENIRO_BASE}{href}" if (href or "").startswith("/") else (href or "")
                persons.append({"eniro_id": pid.group(1), "url": full})
            if len(persons) >= max_results:
                break
    except Exception:
        pass
    finally:
        await ctx.close()

    return persons


async def _eniro_fetch_person_page(pw_browser, url: str) -> Optional[Dict[str, str]]:
    ctx = await pw_browser.new_context(
        user_agent=_pick_ua(), locale="sv-SE",
        viewport={"width": 1366, "height": 768},
    )
    page = await ctx.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        ok = await _eniro_cf_wait(page)
        if not ok:
            return None
        await _eniro_accept_cookies(page)
        await page.wait_for_timeout(300)

        html = await page.content()
        person = _extract_jsonld_person(html)
        if not person.get("name"):
            return None

        addr = person.get("address", {})
        fastighet = _extract_visible_fastighet(html)

        return {
            "name": person.get("name", ""),
            "givenName": person.get("givenName", ""),
            "familyName": person.get("familyName", ""),
            "birthDate": person.get("birthDate", ""),
            "telephone": person.get("telephone", ""),
            "streetAddress": addr.get("streetAddress", ""),
            "postalCode": addr.get("postalCode", ""),
            "addressLocality": addr.get("addressLocality", ""),
            "fastighetsbeteckning": fastighet,
            "eniro_url": url,
        }
    except Exception:
        return None
    finally:
        await ctx.close()


async def _eniro_resolve(name: str, city: str = "") -> Optional[Dict[str, str]]:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            persons = await _eniro_search(browser, name, city)
            if not persons:
                return None

            target_parts = set(name.lower().split())
            for p in persons:
                await asyncio.sleep(_jitter(0.5))
                data = await _eniro_fetch_person_page(browser, p["url"])
                if not data:
                    continue
                found_parts = set(data["name"].lower().split())
                if target_parts & found_parts:
                    return data
            return None
        finally:
            await browser.close()


def eniro_lookup_sync(name: str, city: str = "") -> Optional[Dict[str, str]]:
    if not name.strip():
        return None
    try:
        return asyncio.run(_eniro_resolve(name, city))
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  PAP API — postnummer → ort
# ─────────────────────────────────────────────────────────────────────────────

def normalize_postal(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def pap_lookup(postal_code: str, pap_api_key: str) -> Optional[Dict[str, str]]:
    clean = normalize_postal(postal_code)
    if not re.fullmatch(r"\d{5}", clean) or not pap_api_key.strip():
        return None
    params = urlencode({"query": clean, "format": "json", "apikey": pap_api_key.strip()})
    req = Request(
        f"{PAP_API_URL}?{params}",
        headers={"User-Agent": _pick_ua(), "Accept": "application/json"},
    )
    try:
        with urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        item = (data.get("results") or [None])[0]
        if not item or not item.get("city"):
            return None
        return {
            "postalCode": clean,
            "city": str(item.get("city", "")).strip(),
            "municipality": str(item.get("county", "")).strip(),
            "county": str(item.get("state", "")).strip(),
            "source": "pap",
        }
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Normalizers & validators
# ─────────────────────────────────────────────────────────────────────────────

def normalize_phone(value: str) -> str:
    return re.sub(r"[^\d+]", "", value or "")

def normalize_email(value: str) -> str:
    return (value or "").strip().lower()

def validate_date(value: str) -> Tuple[bool, str]:
    if not value:
        return False, "Datum maste anges."
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True, ""
    except ValueError:
        return False, "Datum maste vara i format YYYY-MM-DD."

def validate_postal_required(value: str) -> Tuple[bool, str]:
    if not re.fullmatch(r"\d{5}", normalize_postal(value)):
        return False, "Postnummer maste vara exakt 5 siffror."
    return True, ""

def validate_postal_optional(value: str) -> Tuple[bool, str]:
    return (True, "") if not value else validate_postal_required(value)

def validate_email_optional(value: str) -> Tuple[bool, str]:
    if not value:
        return True, ""
    return (True, "") if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value) else (False, "Ogiltig e-postadress.")

def validate_phone_optional(value: str) -> Tuple[bool, str]:
    if not value:
        return True, ""
    digits = re.sub(r"[^\d]", "", value)
    return (True, "") if 8 <= len(digits) <= 15 else (False, "Telefonnummer bor vara 8-15 siffror.")


# ─────────────────────────────────────────────────────────────────────────────
#  Interactive helpers
# ─────────────────────────────────────────────────────────────────────────────

def ask_text(label: str, default: str = "", required: bool = False,
             normalizer=None, validator=None) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        raw = input(f"{label}{suffix}: ").strip()
        value = raw if raw else default
        if normalizer:
            value = normalizer(value)
        if required and not value:
            print("  -> Faltet ar obligatoriskt.")
            continue
        if validator:
            ok, msg = validator(value)
            if not ok:
                print(f"  -> {msg}")
                continue
        return value


def ask_yes_no(label: str, default_yes: bool = True) -> bool:
    suffix = " [Y/n]" if default_yes else " [y/N]"
    while True:
        value = input(f"{label}{suffix}: ").strip().lower()
        if not value:
            return default_yes
        if value in {"y", "yes", "j", "ja"}:
            return True
        if value in {"n", "no", "nej"}:
            return False
        print("  -> Svara med ja eller nej.")


# ─────────────────────────────────────────────────────────────────────────────
#  Address parsing
# ─────────────────────────────────────────────────────────────────────────────

def parse_address_guess(raw_address: str) -> Dict[str, str]:
    compact = " ".join((raw_address or "").split())
    out: Dict[str, str] = {"fromStreet": "", "fromPostal": "", "fromCity": ""}
    if not compact:
        return out

    full = re.search(
        r"^(?P<street>.+?)[,\s]+(?P<postal>\d{3}\s?\d{2})\s+(?P<city>[A-Za-zÅÄÖåäö\-\s]+)$",
        compact,
    )
    if full:
        out["fromStreet"] = full.group("street").strip()
        out["fromPostal"] = normalize_postal(full.group("postal"))
        out["fromCity"] = full.group("city").strip()
        return out

    pieces = [p.strip() for p in compact.split(",") if p.strip()]
    if pieces:
        out["fromStreet"] = pieces[0]
    postal_m = re.search(r"\b(\d{3}\s?\d{2})\b", compact)
    if postal_m:
        out["fromPostal"] = normalize_postal(postal_m.group(1))
    city_m = re.search(r"\b\d{3}\s?\d{2}\s+([A-Za-zÅÄÖåäö\-\s]+)$", compact)
    if city_m:
        out["fromCity"] = city_m.group(1).strip()
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Payload builders
# ─────────────────────────────────────────────────────────────────────────────

def _resolved_name(form: Dict[str, str]) -> str:
    n = form.get("name", "").strip()
    if n:
        return n
    return " ".join(p for p in [form.get("firstName", ""), form.get("lastName", "")] if p.strip()).strip()


def build_flyttio_payload(form: Dict[str, str]) -> Dict[str, str]:
    return {
        "name": _resolved_name(form),
        "firstName": form.get("firstName", "").strip(),
        "lastName": form.get("lastName", "").strip(),
        "personalNumber": form.get("personalNumber", "").strip(),
        "email": normalize_email(form.get("email", "")),
        "phone": normalize_phone(form.get("phone", "")),
        "fromStreet": form.get("fromStreet", "").strip(),
        "fromPostal": normalize_postal(form.get("fromPostal", "")),
        "fromCity": form.get("fromCity", "").strip(),
        "toStreet": form.get("toStreet", "").strip(),
        "toPostal": normalize_postal(form.get("toPostal", "")),
        "toCity": form.get("toCity", "").strip(),
        "apartmentNumber": form.get("apartmentNumber", "").strip(),
        "propertyDesignation": form.get("propertyDesignation", "").strip(),
        "propertyOwner": form.get("propertyOwner", "").strip(),
        "moveDate": form.get("moveDate", "").strip(),
    }


def build_skv_payload(form: Dict[str, str]) -> Dict[str, str]:
    return {
        "inflyttningsdatum": form.get("moveDate", "").strip(),
        "period": form.get("period", "true").strip() or "true",
        "gatuadress": form.get("toStreet", "").strip(),
        "postnummer": normalize_postal(form.get("toPostal", "")),
        "postort": form.get("toCity", "").strip(),
        "lagenhetsnummer": form.get("apartmentNumber", "").strip(),
        "fastighetsbeteckning": form.get("propertyDesignation", "").strip(),
        "fastighetsagare": form.get("propertyOwner", "").strip(),
        "telefonnummer": normalize_phone(form.get("phone", "")),
        "email": normalize_email(form.get("email", "")),
        "name": _resolved_name(form),
        "personalNumber": form.get("personalNumber", "").strip(),
    }


def get_required_missing(skv: Dict[str, str]) -> List[str]:
    return [f for f in ("inflyttningsdatum", "period", "gatuadress", "postnummer", "postort")
            if not skv.get(f, "").strip()]


# ─────────────────────────────────────────────────────────────────────────────
#  Wizard — step-by-step data collection
# ─────────────────────────────────────────────────────────────────────────────

def _collect_destination(form: Dict[str, str], pap_api_key: str,
                         lookups: Dict[str, Any]) -> None:
    print("\nSteg 4/6 — Ny adress (obligatorisk for slutblankett)")
    form["toStreet"] = ask_text("Ny gatuadress (toStreet)", default=form.get("toStreet", ""), required=True)

    while True:
        form["toPostal"] = ask_text(
            "Nytt postnummer (toPostal)", default=form.get("toPostal", ""),
            normalizer=normalize_postal, validator=validate_postal_optional,
        )
        pap_to = pap_lookup(form["toPostal"], pap_api_key) if form["toPostal"] else None
        if pap_to:
            lookups["toPostalPap"] = pap_to

        suggested = form.get("toCity", "")
        if pap_to and pap_to.get("city"):
            suggested = pap_to["city"]
            if not form.get("toCity"):
                print(f"  -> PAP: postnummer {form['toPostal']} → ort {suggested}.")

        form["toCity"] = ask_text("Ny ort (toCity)", default=suggested)

        if not form["toPostal"] and form["toCity"]:
            print("  -> Postnummer saknas (krav). Ange postnummer.")
            form["toPostal"] = ask_text("Nytt postnummer", required=True,
                                        normalizer=normalize_postal, validator=validate_postal_required)
            pap_to = pap_lookup(form["toPostal"], pap_api_key)
            if pap_to:
                lookups["toPostalPap"] = pap_to
                if not form["toCity"] and pap_to.get("city"):
                    form["toCity"] = pap_to["city"]

        if not form["toCity"] and form["toPostal"]:
            pap_to = pap_lookup(form["toPostal"], pap_api_key)
            if pap_to and pap_to.get("city"):
                form["toCity"] = pap_to["city"]
                print(f"  -> PAP: satte toCity → {form['toCity']}.")
            else:
                form["toCity"] = ask_text("Ny ort (toCity)", required=True)

        if form["toPostal"] and form["toCity"]:
            break
        print("  -> Bade postnummer och ort behovs.")


def run_wizard(raw_pnr: str, pap_api_key: str, skip_eniro: bool = False) -> Dict[str, Any]:
    normalized_pnr = normalize_pnr(raw_pnr)
    lookups: Dict[str, Any] = {
        "personLookup": None,
        "personLookupError": None,
        "eniroLookup": None,
        "eniroLookupError": None,
        "fromPostalPap": None,
        "toPostalPap": None,
    }

    # ── Steg 1: Biluppgifter ──────────────────────────────────────────────
    print("\nSteg 1/6 — Personuppslag fran personnummer (Biluppgifter)")
    try:
        html = fetch_html(_pnr_to_biluppgifter_url(normalized_pnr))
        person = parse_biluppgifter_person(html, normalized_pnr)
        lookups["personLookup"] = person
        if person:
            print(f"  -> Hittade: {person.get('name', '?')} ({person.get('fromCity', '?')})")
        else:
            print("  -> Ingen person hittades, fortsatter manuellt.")
    except Exception as exc:
        lookups["personLookupError"] = str(exc)
        print(f"  -> Personuppslag misslyckades: {exc}")

    form: Dict[str, str] = {
        "personalNumber": normalized_pnr,
        "firstName": "", "lastName": "", "name": "",
        "fromStreet": "", "fromPostal": "", "fromCity": "",
        "toStreet": "", "toPostal": "", "toCity": "",
        "moveDate": "", "apartmentNumber": "",
        "propertyDesignation": "", "propertyOwner": "",
        "phone": "", "email": "", "period": "true",
    }

    pl = lookups.get("personLookup")
    if pl:
        form["firstName"] = str(pl.get("firstName", "")).strip()
        form["lastName"] = str(pl.get("lastName", "")).strip()
        form["name"] = str(pl.get("name", "")).strip()
        form["fromCity"] = str(pl.get("fromCity", "")).strip()
        guessed = parse_address_guess(str(pl.get("fromStreetRaw", "")).strip())
        form["fromStreet"] = guessed.get("fromStreet", "")
        form["fromPostal"] = guessed.get("fromPostal", "")
        if guessed.get("fromCity"):
            form["fromCity"] = guessed["fromCity"]

    # ── Steg 2: Eniro-berikning ───────────────────────────────────────────
    if not skip_eniro and form["name"]:
        print("\nSteg 2/6 — Eniro-berikning (telefon, fastighetsbeteckning, adress)")
        try:
            eniro = eniro_lookup_sync(form["name"], form["fromCity"])
            lookups["eniroLookup"] = eniro
            if eniro:
                hits: List[str] = []
                if eniro.get("telephone"):
                    form["phone"] = eniro["telephone"]
                    hits.append(f"telefon: {eniro['telephone']}")
                if eniro.get("fastighetsbeteckning"):
                    hits.append(f"fastighet: {eniro['fastighetsbeteckning']}")
                if eniro.get("postalCode") and not form["fromPostal"]:
                    form["fromPostal"] = normalize_postal(eniro["postalCode"])
                    hits.append(f"postnummer: {eniro['postalCode']}")
                if eniro.get("streetAddress") and not form["fromStreet"]:
                    form["fromStreet"] = eniro["streetAddress"]
                    hits.append(f"adress: {eniro['streetAddress']}")
                if eniro.get("addressLocality") and not form["fromCity"]:
                    form["fromCity"] = eniro["addressLocality"]
                    hits.append(f"ort: {eniro['addressLocality']}")
                if hits:
                    print(f"  -> Eniro gav: {', '.join(hits)}")
                else:
                    print("  -> Eniro hittade personen men inga nya falt.")
            else:
                print("  -> Ingen Eniro-traff.")
        except Exception as exc:
            lookups["eniroLookupError"] = str(exc)
            print(f"  -> Eniro misslyckades: {exc}")
    elif skip_eniro:
        print("\nSteg 2/6 — Eniro-berikning (hoppas over med --skip-eniro)")
    else:
        print("\nSteg 2/6 — Eniro-berikning (hoppas over — inget namn fran steg 1)")

    # ── Steg 3: Bekrafta identitet ────────────────────────────────────────
    print("\nSteg 3/6 — Bekrafta identitet och nuvarande adress")
    form["firstName"] = ask_text("Fornamn", default=form["firstName"], required=True)
    form["lastName"] = ask_text("Efternamn", default=form["lastName"], required=True)
    form["name"] = f"{form['firstName']} {form['lastName']}".strip()

    form["fromStreet"] = ask_text("Nuvarande gatuadress", default=form["fromStreet"])
    form["fromPostal"] = ask_text(
        "Nuvarande postnummer", default=form["fromPostal"],
        normalizer=normalize_postal, validator=validate_postal_optional,
    )
    if form["fromPostal"] and not form["fromCity"]:
        pap_from = pap_lookup(form["fromPostal"], pap_api_key)
        lookups["fromPostalPap"] = pap_from
        if pap_from and pap_from.get("city"):
            form["fromCity"] = pap_from["city"]
            print(f"  -> PAP: satte fromCity → {form['fromCity']}.")

    form["fromCity"] = ask_text("Nuvarande ort", default=form["fromCity"])

    # ── Steg 4: Ny adress ─────────────────────────────────────────────────
    _collect_destination(form, pap_api_key, lookups)

    # ── Steg 5: Datum + kontakt ───────────────────────────────────────────
    print("\nSteg 5/6 — Flyttdatum och kontaktuppgifter")
    form["moveDate"] = ask_text("Inflyttningsdatum (YYYY-MM-DD)", default=form["moveDate"],
                                required=True, validator=validate_date)
    form["phone"] = ask_text("Telefonnummer", default=form["phone"],
                             normalizer=normalize_phone, validator=validate_phone_optional)
    form["email"] = ask_text("E-post", default=form["email"],
                             normalizer=normalize_email, validator=validate_email_optional)

    # ── Steg 6: Ovriga blankettfalt ───────────────────────────────────────
    eniro_data = lookups.get("eniroLookup") or {}
    fastighet_hint = eniro_data.get("fastighetsbeteckning", "")

    print("\nSteg 6/6 — Ovriga blankettfalt")
    form["apartmentNumber"] = ask_text("Lagenhetsnummer (vid behov)", default=form["apartmentNumber"])

    prop_default = form["propertyDesignation"]
    if fastighet_hint and not prop_default:
        print(f"  (Eniro hittade fastighetsbeteckning for nuvarande adress: {fastighet_hint})")
        print("   OBS: blanketten avser NY adress — ange den nya fastighetsbeteckningen.")
    form["propertyDesignation"] = ask_text(
        "Fastighetsbeteckning (ny adress, valfritt)",
        default=prop_default,
    )
    form["propertyOwner"] = ask_text("Fastighetsagare (valfritt)", default=form["propertyOwner"])

    if not ask_yes_no("Anvand period = 'Tills vidare'?", default_yes=True):
        form["period"] = "false"
    else:
        form["period"] = "true"

    flyttio = build_flyttio_payload(form)
    skv = build_skv_payload(form)
    missing = get_required_missing(skv)

    return {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "version": "v3",
        "status": "complete" if not missing else "partial",
        "lookups": lookups,
        "flyttioPayload": flyttio,
        "skvPayload": skv,
        "requiredMissing": missing,
        "notes": [
            "Steg 1 (Biluppgifter): PNR → namn + nuvarande adress.",
            "Steg 2 (Eniro): namn+stad → telefon + fastighetsbeteckning + postnummer.",
            "Steg 3-6: manuellt for ny adress, datum och ovriga falt.",
            "Fastighetsbeteckning fran Eniro galler nuvarande adress, inte nya.",
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Output
# ─────────────────────────────────────────────────────────────────────────────

def print_summary(result: Dict[str, Any]) -> None:
    skv = result["skvPayload"]
    lookups = result.get("lookups", {})
    eniro = lookups.get("eniroLookup") or {}

    print("\n" + "=" * 55)
    print("  RESULTAT (v3)")
    print("=" * 55)
    print(f"  Status:  {result['status']}")
    print(f"  Namn:    {skv.get('name', '')}")
    print(f"  PNR:     {skv.get('personalNumber', '')}")
    print(f"  Ny adr:  {skv.get('gatuadress', '')}, {skv.get('postnummer', '')} {skv.get('postort', '')}")
    print(f"  Datum:   {skv.get('inflyttningsdatum', '')}")
    print(f"  Telefon: {skv.get('telefonnummer', '') or '(saknas)'}")
    print(f"  E-post:  {skv.get('email', '') or '(saknas)'}")
    print(f"  Fast.bet:{skv.get('fastighetsbeteckning', '') or '(saknas)'}")
    print(f"  Fast.ag: {skv.get('fastighetsagare', '') or '(saknas)'}")

    if eniro:
        print(f"\n  Eniro-data (nuv. adress):")
        if eniro.get("telephone"):
            print(f"    Telefon: {eniro['telephone']}")
        if eniro.get("fastighetsbeteckning"):
            print(f"    Fastighet: {eniro['fastighetsbeteckning']}")
        if eniro.get("postalCode"):
            print(f"    Postnummer: {eniro['postalCode']}")

    if result.get("requiredMissing"):
        print(f"\n  Saknade kravfalt: {', '.join(result['requiredMissing'])}")
    else:
        print("\n  Alla kravfalt for slutblanketten ar ifyllda.")
    print("=" * 55)


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PNR lookup v3 — komplett datainsamling for flyttanmalan.")
    parser.add_argument("personnummer", nargs="?", help="Personnummer (10/12 siffror).")
    parser.add_argument("--pap-api-key", default="", help="PAP API-nyckel for postnummer → ort.")
    parser.add_argument("--skip-eniro", action="store_true", help="Hoppa over Eniro-berikning.")
    parser.add_argument("--out", default="", help="Output-JSON sokvag.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    print("Beroenden: pip install -r requirements.txt")
    print("Playwright: playwright install chromium\n")

    raw_pnr = args.personnummer or input("Ange personnummer: ").strip()
    if not raw_pnr:
        print("Inget personnummer angavs.")
        return 1

    pap_key = (args.pap_api_key or os.environ.get("PAP_API_KEY", "")).strip()

    try:
        result = run_wizard(raw_pnr, pap_key, skip_eniro=args.skip_eniro)
    except Exception as exc:
        print(f"Fel: {exc}")
        return 1

    out_path = (
        Path(args.out).expanduser().resolve()
        if args.out
        else Path(__file__).resolve().parent / "pnr_lookup_v3_output.json"
    )
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print_summary(result)
    print(f"\nJSON sparad: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
