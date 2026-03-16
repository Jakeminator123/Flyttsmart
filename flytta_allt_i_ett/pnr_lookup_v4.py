#!/usr/bin/env python3
"""
PNR lookup v4 — komplett datainsamling for flyttanmalan.

Nytt jmf v3:
  - Extraherar lagenhetsnummer automatiskt fran "lgh XXXX" i adress-strang.
  - Eniro Company Search (REST, ingen Playwright) for fastighetsagare via gatunamn+stad.
  - Eniro-personsida ger fastighetsbeteckning (nuvarande adress) som forslag.
  - Tydligare ledtexter for manuella falt.

Kor:
    python pnr_lookup_v4.py
    python pnr_lookup_v4.py 19900101-1234
    python pnr_lookup_v4.py 19900101-1234 --pap-api-key <KEY> --eniro-api-key <KEY>
    python pnr_lookup_v4.py 19900101-1234 --skip-eniro
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
ENIRO_API_BASE = "https://api.eniro.com/cs/search/basic"
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
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
        now = datetime.now()
        current_yy = now.year % 100
        century = now.year // 100
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
    return any(p.lower() in html.lower() for p in BLOCKED_PHRASES)


def _fetch_with_curl_cffi(url: str) -> Optional[str]:
    try:
        requests = importlib.import_module("curl_cffi.requests")
    except ImportError:
        return None
    resp = requests.get(
        url, impersonate="chrome124",
        headers={"User-Agent": _pick_ua(), "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8"},
        timeout=25,
    )
    if _is_blocked(resp.status_code, resp.text):
        return None
    return resp.text


def _fetch_with_playwright_sync(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright saknas. Kor: pip install playwright && playwright install chromium") from exc

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent=_pick_ua(), locale="sv-SE",
            extra_http_headers={"Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8"},
        )
        page = ctx.new_page()
        for pat in PW_BLOCK_PATTERNS:
            page.route(pat, lambda route: route.abort())
        resp = page.goto(url, wait_until="domcontentloaded", timeout=25000)
        if resp is None:
            raise RuntimeError("Ingen HTTP-respons.")
        if resp.status >= 400:
            raise RuntimeError(f"HTTP {resp.status}")
        page.wait_for_timeout(1200)
        html = page.content()
        browser.close()
        return html


def fetch_html(url: str) -> str:
    html = _fetch_with_curl_cffi(url)
    return html if html else _fetch_with_playwright_sync(url)


def parse_biluppgifter_person(html: str, pnr_digits: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator=" ", strip=True)

    if any(p in text for p in NOT_FOUND_PHRASES):
        return None

    m = re.search(r"Visa\s+(.+?)\s+(?:pa|på)\s+Ratsit", text)
    full_name = m.group(1).strip() if m else ""
    if not full_name:
        fb = re.search(r"([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-\s]{2,50}),\s+en\s+privatperson", text)
        full_name = fb.group(1).strip() if fb else ""
    if not full_name:
        return None

    first_name, last_name = split_name(full_name)
    age_m = re.search(r"(\d{1,3})\s+(?:ar|år)", text)
    city_m = re.search(r"bor\s+i\s+([A-ZÅÄÖ][a-zåäö]+(?:[\s-][A-ZÅÄÖ][a-zåäö]+)?)", text)
    addr_m = re.search(r"\bAdress\s+([^\n\r,]{3,80})", text)
    address = ""
    if addr_m:
        address = re.split(r"\s{2,}|Kontakt|Telefon|Fordon|Visa\s", addr_m.group(1).strip())[0].strip()

    return {
        "pnr": pnr_digits, "firstName": first_name, "lastName": last_name,
        "name": full_name, "fromCity": city_m.group(1).strip() if city_m else "",
        "fromStreetRaw": address, "age": int(age_m.group(1)) if age_m else None,
        "source": "biluppgifter",
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Address parsing — now extracts lgh number
# ─────────────────────────────────────────────────────────────────────────────

def parse_address_guess(raw_address: str) -> Dict[str, str]:
    compact = " ".join((raw_address or "").split())
    out: Dict[str, str] = {"fromStreet": "", "fromPostal": "", "fromCity": "", "apartmentNumber": ""}
    if not compact:
        return out

    lgh_m = re.search(r"\blgh\s+(\d{4})\b", compact, re.IGNORECASE)
    if lgh_m:
        out["apartmentNumber"] = lgh_m.group(1)
        compact = compact[:lgh_m.start()].strip().rstrip(",")

    full = re.search(
        r"^(?P<street>.+?)[,\s]+(?P<postal>\d{3}\s?\d{2})\s+(?P<city>[A-Za-zÅÄÖåäö\-\s]+)$",
        compact,
    )
    if full:
        out["fromStreet"] = full.group("street").strip()
        out["fromPostal"] = re.sub(r"\s+", "", full.group("postal"))
        out["fromCity"] = full.group("city").strip()
        return out

    pieces = [p.strip() for p in compact.split(",") if p.strip()]
    if pieces:
        out["fromStreet"] = pieces[0]
    postal_m = re.search(r"\b(\d{3}\s?\d{2})\b", compact)
    if postal_m:
        out["fromPostal"] = re.sub(r"\s+", "", postal_m.group(1))
    city_m = re.search(r"\b\d{3}\s?\d{2}\s+([A-Za-zÅÄÖåäö\-\s]+)$", compact)
    if city_m:
        out["fromCity"] = city_m.group(1).strip()
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Eniro Person (Playwright) — telefon + fastighetsbeteckning + adress
# ─────────────────────────────────────────────────────────────────────────────

async def _eniro_cf_wait(page, timeout_s: int = 20) -> bool:
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
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            data = json.loads(raw.strip())
            for item in data.get("@graph", [data]):
                if item.get("@type") == "Person":
                    return item
        except Exception:
            pass
    return {}


def _extract_visible_fastighet(html: str) -> str:
    text = BeautifulSoup(html, "lxml").get_text(" ", strip=True)
    # Match patterns like "KUMLA 146:2 (1)" near "boende" section.
    # The format is: WORD(S) NUMBER:NUMBER followed by optional "(digits)".
    # Exclude false positives like "Visa värde..." by requiring uppercase start.
    for m in re.finditer(r"\b([A-ZÅÄÖ][A-ZÅÄÖa-zåäö\s\-]+\d+:\d+)\b", text):
        candidate = m.group(1).strip()
        # Skip obvious non-fastighet matches
        if len(candidate) < 4 or len(candidate) > 60:
            continue
        if any(skip in candidate.lower() for skip in ("visa ", "http", "sida")):
            continue
        return candidate
    return ""


async def _eniro_search(browser, name: str, city: str = "", max_results: int = 5) -> List[Dict[str, str]]:
    slug = quote_plus(f"{name} {city}".strip() if city else name)
    url = f"{ENIRO_BASE}/{slug}/personer"
    persons: List[Dict[str, str]] = []
    ctx = await browser.new_context(user_agent=_pick_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
    page = await ctx.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        if not await _eniro_cf_wait(page):
            return []
        await _eniro_accept_cookies(page)
        await page.wait_for_timeout(500)
        seen: set[str] = set()
        for link in await page.locator("a[href*='/person']").all():
            href = await link.get_attribute("href")
            pid = re.search(r"/(\d{6,12})/person", href or "")
            if pid and pid.group(1) not in seen:
                seen.add(pid.group(1))
                full_url = f"{ENIRO_BASE}{href}" if (href or "").startswith("/") else (href or "")
                persons.append({"eniro_id": pid.group(1), "url": full_url})
            if len(persons) >= max_results:
                break
    except Exception:
        pass
    finally:
        await ctx.close()
    return persons


async def _eniro_fetch_person_page(browser, url: str) -> Optional[Dict[str, str]]:
    ctx = await browser.new_context(user_agent=_pick_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
    page = await ctx.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        if not await _eniro_cf_wait(page):
            return None
        await _eniro_accept_cookies(page)
        await page.wait_for_timeout(300)
        html = await page.content()
        person = _extract_jsonld_person(html)
        if not person.get("name"):
            return None
        addr = person.get("address", {})
        return {
            "name": person.get("name", ""), "givenName": person.get("givenName", ""),
            "familyName": person.get("familyName", ""), "birthDate": person.get("birthDate", ""),
            "telephone": person.get("telephone", ""),
            "streetAddress": addr.get("streetAddress", ""), "postalCode": addr.get("postalCode", ""),
            "addressLocality": addr.get("addressLocality", ""),
            "fastighetsbeteckning": _extract_visible_fastighet(html),
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
                # Retry without city — Eniro sometimes needs just the name
                if city:
                    persons = await _eniro_search(browser, name, "")
            if not persons:
                return None

            target = set(name.lower().split())
            for p in persons:
                await asyncio.sleep(_jitter(0.5))
                data = await _eniro_fetch_person_page(browser, p["url"])
                if not data:
                    continue
                found = set(data["name"].lower().split())
                # Match if ANY target word appears in the Eniro name
                if target & found:
                    return data
            return None
        finally:
            await browser.close()


def eniro_person_lookup_sync(name: str, city: str = "") -> Optional[Dict[str, str]]:
    if not name.strip():
        return None
    try:
        return asyncio.run(_eniro_resolve(name, city))
    except RuntimeError as exc:
        if "cannot be called from a running event loop" in str(exc):
            import nest_asyncio  # type: ignore[import-untyped]
            nest_asyncio.apply()
            return asyncio.run(_eniro_resolve(name, city))
        raise
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Eniro Company Search (REST) — gatunamn+stad → fastighetsagare
#
#  Samma API som lib/services/eniro.ts i huvudprojektet.
#  Kraver ENIRO_API_KEY. Soker pa gatunamn i ort for att hitta
#  hyresvard/BRF/forvaltare som ar registrerade pa adressen.
# ─────────────────────────────────────────────────────────────────────────────

def eniro_company_search(street: str, city: str, eniro_api_key: str) -> List[Dict[str, str]]:
    if not eniro_api_key.strip() or not street.strip():
        return []
    street_name = re.split(r"\d", street)[0].strip()
    if not street_name or len(street_name) < 3:
        street_name = street.strip()

    params = urlencode({
        "profile": "APIGW", "key": eniro_api_key.strip(),
        "country": "se", "search_word": street_name,
        **({"geo_area": city} if city else {}),
    })
    req = Request(f"{ENIRO_API_BASE}?{params}", headers={"User-Agent": _pick_ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        adverts = data.get("adverts")
        if not isinstance(adverts, list):
            return []
        return [
            {
                "companyName": str(a.get("companyName", "")).strip(),
                "address": str(a.get("address", "")).strip(),
                "phoneNumber": str(a.get("phoneNumber", "")).strip(),
                "city": str(a.get("city", "")).strip(),
                "zipCode": str(a.get("zipCode", "")).strip(),
            }
            for a in adverts[:5] if a.get("companyName")
        ]
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return []


def guess_property_owner(companies: List[Dict[str, str]], street: str) -> str:
    if not companies:
        return ""
    street_lower = street.lower()
    for c in companies:
        addr = c.get("address", "").lower()
        name = c.get("companyName", "")
        keywords = ("bostads", "fastighet", "hyres", "brf", "bostad", "hemfosa", "stena", "rikshem", "vasakrona")
        if any(kw in name.lower() for kw in keywords):
            phone = c.get("phoneNumber", "")
            return f"{name} {phone}".strip() if phone else name
        if addr and any(word in addr for word in street_lower.split()[:2]):
            phone = c.get("phoneNumber", "")
            return f"{name} {phone}".strip() if phone else name
    return ""


# ─────────────────────────────────────────────────────────────────────────────
#  PAP API — postnummer → ort
# ─────────────────────────────────────────────────────────────────────────────

def normalize_postal(v: str) -> str:
    return re.sub(r"\s+", "", v or "")

def pap_lookup(postal: str, key: str) -> Optional[Dict[str, str]]:
    clean = normalize_postal(postal)
    if not re.fullmatch(r"\d{5}", clean) or not key.strip():
        return None
    params = urlencode({"query": clean, "format": "json", "apikey": key.strip()})
    req = Request(f"{PAP_API_URL}?{params}", headers={"User-Agent": _pick_ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        item = (data.get("results") or [None])[0]
        if not item or not item.get("city"):
            return None
        return {"postalCode": clean, "city": str(item["city"]).strip(),
                "municipality": str(item.get("county", "")).strip(),
                "county": str(item.get("state", "")).strip(), "source": "pap"}
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Normalizers, validators, interactive helpers
# ─────────────────────────────────────────────────────────────────────────────

def normalize_phone(v: str) -> str: return re.sub(r"[^\d+]", "", v or "")
def normalize_email(v: str) -> str: return (v or "").strip().lower()

def validate_date(v: str) -> Tuple[bool, str]:
    if not v: return False, "Datum maste anges."
    try: datetime.strptime(v, "%Y-%m-%d"); return True, ""
    except ValueError: return False, "Format: YYYY-MM-DD."

def validate_postal_req(v: str) -> Tuple[bool, str]:
    return (True, "") if re.fullmatch(r"\d{5}", normalize_postal(v)) else (False, "Exakt 5 siffror.")

def validate_postal_opt(v: str) -> Tuple[bool, str]:
    return (True, "") if not v else validate_postal_req(v)

def validate_email_opt(v: str) -> Tuple[bool, str]:
    if not v: return True, ""
    return (True, "") if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v) else (False, "Ogiltig e-post.")

def validate_phone_opt(v: str) -> Tuple[bool, str]:
    if not v: return True, ""
    return (True, "") if 8 <= len(re.sub(r"[^\d]", "", v)) <= 15 else (False, "8-15 siffror.")


def ask_text(label: str, default: str = "", required: bool = False, normalizer=None, validator=None) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        raw = input(f"{label}{suffix}: ").strip()
        value = raw if raw else default
        if normalizer: value = normalizer(value)
        if required and not value: print("  -> Obligatoriskt."); continue
        if validator:
            ok, msg = validator(value)
            if not ok: print(f"  -> {msg}"); continue
        return value


def ask_yes_no(label: str, default_yes: bool = True) -> bool:
    suffix = " [Y/n]" if default_yes else " [y/N]"
    while True:
        v = input(f"{label}{suffix}: ").strip().lower()
        if not v: return default_yes
        if v in {"y","yes","j","ja"}: return True
        if v in {"n","no","nej"}: return False
        print("  -> Ja eller nej.")


# ─────────────────────────────────────────────────────────────────────────────
#  Payload builders
# ─────────────────────────────────────────────────────────────────────────────

def _rname(f: Dict[str, str]) -> str:
    n = f.get("name", "").strip()
    return n or " ".join(p for p in [f.get("firstName",""), f.get("lastName","")] if p.strip()).strip()

def build_flyttio_payload(f: Dict[str, str]) -> Dict[str, str]:
    return {
        "name": _rname(f), "firstName": f.get("firstName","").strip(), "lastName": f.get("lastName","").strip(),
        "personalNumber": f.get("personalNumber","").strip(),
        "email": normalize_email(f.get("email","")), "phone": normalize_phone(f.get("phone","")),
        "fromStreet": f.get("fromStreet","").strip(), "fromPostal": normalize_postal(f.get("fromPostal","")),
        "fromCity": f.get("fromCity","").strip(),
        "toStreet": f.get("toStreet","").strip(), "toPostal": normalize_postal(f.get("toPostal","")),
        "toCity": f.get("toCity","").strip(),
        "apartmentNumber": f.get("apartmentNumber","").strip(),
        "propertyDesignation": f.get("propertyDesignation","").strip(),
        "propertyOwner": f.get("propertyOwner","").strip(),
        "moveDate": f.get("moveDate","").strip(),
    }

def build_skv_payload(f: Dict[str, str]) -> Dict[str, str]:
    return {
        "inflyttningsdatum": f.get("moveDate","").strip(),
        "period": f.get("period","true").strip() or "true",
        "gatuadress": f.get("toStreet","").strip(),
        "postnummer": normalize_postal(f.get("toPostal","")),
        "postort": f.get("toCity","").strip(),
        "lagenhetsnummer": f.get("apartmentNumber","").strip(),
        "fastighetsbeteckning": f.get("propertyDesignation","").strip(),
        "fastighetsagare": f.get("propertyOwner","").strip(),
        "telefonnummer": normalize_phone(f.get("phone","")),
        "email": normalize_email(f.get("email","")),
        "name": _rname(f), "personalNumber": f.get("personalNumber","").strip(),
    }

def get_required_missing(skv: Dict[str, str]) -> List[str]:
    return [k for k in ("inflyttningsdatum","period","gatuadress","postnummer","postort") if not skv.get(k,"").strip()]


# ─────────────────────────────────────────────────────────────────────────────
#  Wizard
# ─────────────────────────────────────────────────────────────────────────────

def _collect_destination(form: Dict[str, str], pap_key: str, lookups: Dict[str, Any]) -> None:
    print("\nSteg 5/7 — Ny adress (obligatorisk)")
    form["toStreet"] = ask_text("Ny gatuadress", default=form.get("toStreet",""), required=True)
    while True:
        form["toPostal"] = ask_text("Nytt postnummer", default=form.get("toPostal",""),
                                    normalizer=normalize_postal, validator=validate_postal_opt)
        pap = pap_lookup(form["toPostal"], pap_key) if form["toPostal"] else None
        if pap: lookups["toPostalPap"] = pap
        suggested = form.get("toCity","")
        if pap and pap.get("city"):
            suggested = pap["city"]
            if not form.get("toCity"): print(f"  -> PAP: {form['toPostal']} → {suggested}")
        form["toCity"] = ask_text("Ny ort", default=suggested)
        if not form["toPostal"] and form["toCity"]:
            print("  -> Postnummer saknas (krav).")
            form["toPostal"] = ask_text("Nytt postnummer", required=True, normalizer=normalize_postal, validator=validate_postal_req)
            pap = pap_lookup(form["toPostal"], pap_key)
            if pap: lookups["toPostalPap"] = pap
            if pap and pap.get("city") and not form["toCity"]: form["toCity"] = pap["city"]
        if not form["toCity"] and form["toPostal"]:
            pap = pap_lookup(form["toPostal"], pap_key)
            if pap and pap.get("city"):
                form["toCity"] = pap["city"]; print(f"  -> PAP: toCity → {form['toCity']}")
            else: form["toCity"] = ask_text("Ny ort", required=True)
        if form["toPostal"] and form["toCity"]: break
        print("  -> Bade postnummer och ort behovs.")


def run_wizard(raw_pnr: str, pap_key: str, eniro_api_key: str, skip_eniro: bool = False) -> Dict[str, Any]:
    normalized = normalize_pnr(raw_pnr)
    lookups: Dict[str, Any] = {
        "personLookup": None, "personLookupError": None,
        "eniroPersonLookup": None, "eniroPersonError": None,
        "eniroCompanyLookup": None,
        "fromPostalPap": None, "toPostalPap": None,
    }

    form: Dict[str, str] = {
        "personalNumber": normalized,
        "firstName":"","lastName":"","name":"",
        "fromStreet":"","fromPostal":"","fromCity":"",
        "toStreet":"","toPostal":"","toCity":"",
        "moveDate":"","apartmentNumber":"",
        "propertyDesignation":"","propertyOwner":"",
        "phone":"","email":"","period":"true",
    }

    # ── 1: Biluppgifter ──────────────────────────────────────────────────
    print("\nSteg 1/7 — Personuppslag (Biluppgifter)")
    try:
        html = fetch_html(_pnr_to_biluppgifter_url(normalized))
        person = parse_biluppgifter_person(html, normalized)
        lookups["personLookup"] = person
        if person:
            print(f"  -> {person['name']} ({person.get('fromCity','?')})")
            form["firstName"] = person.get("firstName","")
            form["lastName"] = person.get("lastName","")
            form["name"] = person.get("name","")
            form["fromCity"] = person.get("fromCity","")
            guessed = parse_address_guess(person.get("fromStreetRaw",""))
            form["fromStreet"] = guessed["fromStreet"]
            form["fromPostal"] = guessed["fromPostal"]
            if guessed["fromCity"]: form["fromCity"] = guessed["fromCity"]
            if guessed["apartmentNumber"]:
                form["apartmentNumber"] = guessed["apartmentNumber"]
                print(f"  -> Extraherade lagenhetsnummer: {guessed['apartmentNumber']}")
        else:
            print("  -> Ingen traff.")
    except Exception as exc:
        lookups["personLookupError"] = str(exc)
        print(f"  -> Fel: {exc}")

    # ── 2: Eniro Person (Playwright) ─────────────────────────────────────
    if not skip_eniro and form["name"]:
        print("\nSteg 2/7 — Eniro person-berikning (telefon, fastighet, adress)")
        print(f"  Soker: {form['name']} {form['fromCity']}".strip())
        try:
            eniro = eniro_person_lookup_sync(form["name"], form["fromCity"])
            lookups["eniroPersonLookup"] = eniro
            if eniro:
                found: List[str] = []
                if eniro.get("telephone"):
                    form["phone"] = eniro["telephone"]; found.append(f"telefon: {eniro['telephone']}")
                if eniro.get("fastighetsbeteckning"):
                    found.append(f"fastighet (nuv.): {eniro['fastighetsbeteckning']}")
                if eniro.get("postalCode") and not form["fromPostal"]:
                    form["fromPostal"] = normalize_postal(eniro["postalCode"])
                    found.append(f"postnr: {eniro['postalCode']}")
                if eniro.get("streetAddress") and not form["fromStreet"]:
                    form["fromStreet"] = eniro["streetAddress"]; found.append(f"adress: {eniro['streetAddress']}")
                if eniro.get("addressLocality") and not form["fromCity"]:
                    form["fromCity"] = eniro["addressLocality"]; found.append(f"ort: {eniro['addressLocality']}")
                print(f"  -> {', '.join(found)}" if found else "  -> Personen hittades men inga nya falt.")
            else:
                print("  -> Ingen Eniro-traff (personen finns inte i Eniros register).")
                print("     Telefon, fastighetsbeteckning och postnummer maste anges manuellt.")
        except Exception as exc:
            lookups["eniroPersonError"] = str(exc)
            print(f"  -> Eniro-fel: {exc}")
            print("     Fortsatter utan Eniro-data.")
    else:
        reason = "--skip-eniro" if skip_eniro else "inget namn"
        print(f"\nSteg 2/7 — Eniro person (hoppas over: {reason})")

    # ── 3: Eniro Company Search (REST) ───────────────────────────────────
    if eniro_api_key and form["fromStreet"] and form["fromCity"]:
        print("\nSteg 3/7 — Eniro foretagssok (fastighetsagare)")
        companies = eniro_company_search(form["fromStreet"], form["fromCity"], eniro_api_key)
        lookups["eniroCompanyLookup"] = companies
        owner_guess = guess_property_owner(companies, form["fromStreet"])
        if owner_guess:
            print(f"  -> Mojlig fastighetsagare (nuv. adress): {owner_guess}")
        elif companies:
            print(f"  -> {len(companies)} foretag hittades, ingen matchade tydligt som agare.")
        else:
            print("  -> Inga foretag hittades.")
    else:
        print("\nSteg 3/7 — Eniro foretagssok (hoppas over: saknar API-nyckel eller adress)")

    # ── 4: Bekrafta identitet ────────────────────────────────────────────
    print("\nSteg 4/7 — Bekrafta identitet och nuvarande adress")
    form["firstName"] = ask_text("Fornamn", default=form["firstName"], required=True)
    form["lastName"] = ask_text("Efternamn", default=form["lastName"], required=True)
    form["name"] = f"{form['firstName']} {form['lastName']}".strip()
    form["fromStreet"] = ask_text("Nuvarande gatuadress", default=form["fromStreet"])
    form["fromPostal"] = ask_text("Nuvarande postnummer", default=form["fromPostal"],
                                  normalizer=normalize_postal, validator=validate_postal_opt)
    if form["fromPostal"] and not form["fromCity"]:
        pap = pap_lookup(form["fromPostal"], pap_key)
        lookups["fromPostalPap"] = pap
        if pap and pap.get("city"):
            form["fromCity"] = pap["city"]; print(f"  -> PAP: fromCity → {form['fromCity']}")
    form["fromCity"] = ask_text("Nuvarande ort", default=form["fromCity"])
    form["apartmentNumber"] = ask_text("Lagenhetsnummer (nuvarande)", default=form["apartmentNumber"])

    # ── 5: Ny adress ─────────────────────────────────────────────────────
    _collect_destination(form, pap_key, lookups)

    # ── 6: Datum + kontakt ───────────────────────────────────────────────
    print("\nSteg 6/7 — Flyttdatum och kontaktuppgifter")
    form["moveDate"] = ask_text("Inflyttningsdatum (YYYY-MM-DD)", default=form["moveDate"],
                                required=True, validator=validate_date)
    form["phone"] = ask_text("Telefonnummer", default=form["phone"],
                             normalizer=normalize_phone, validator=validate_phone_opt)
    form["email"] = ask_text("E-post", default=form["email"],
                             normalizer=normalize_email, validator=validate_email_opt)

    # ── 7: Fastighetsuppgifter (ny adress) ───────────────────────────────
    eniro_p = lookups.get("eniroPersonLookup") or {}
    fast_hint = eniro_p.get("fastighetsbeteckning", "")
    owner_hint = guess_property_owner(lookups.get("eniroCompanyLookup") or [], form.get("toStreet", ""))

    print("\nSteg 7/7 — Fastighetsuppgifter (for nya adressen)")
    if fast_hint:
        print(f"  Tips: Eniro hittade '{fast_hint}' for nuvarande adress.")
        print("  Blanketten avser den NYA adressen — kolla kontraktet eller lantmateriet.se.")
    form["propertyDesignation"] = ask_text("Fastighetsbeteckning (ny adress)", default=form["propertyDesignation"])

    if owner_hint and not form["propertyOwner"]:
        print(f"  Tips: Eniro hittade foretaget '{owner_hint}' nara nuvarande adress.")
    form["propertyOwner"] = ask_text(
        "Fastighetsagare (ny adress, t.ex. 'egen' eller hyresvard+telefon)",
        default=form["propertyOwner"],
    )

    if not ask_yes_no("Anvand period = 'Tills vidare'?", default_yes=True):
        form["period"] = "false"

    flyttio = build_flyttio_payload(form)
    skv = build_skv_payload(form)
    missing = get_required_missing(skv)

    eniro_ok = lookups.get("eniroPersonLookup") is not None
    diagnostics: List[str] = []
    if not eniro_ok and not skip_eniro:
        diagnostics.append("Eniro hittade inte personen. Ovanliga namn saknas ofta i Eniros register.")
    if not form.get("phone"):
        diagnostics.append("Telefonnummer saknas — ingen oppen kalla kunde leverera det.")
    if not form.get("email"):
        diagnostics.append("E-post kan aldrig hamtas automatiskt — maste anges manuellt.")
    if not form.get("propertyDesignation"):
        diagnostics.append("Fastighetsbeteckning for nya adressen — kolla kontraktet eller lantmateriet.se.")

    return {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "version": "v4",
        "status": "complete" if not missing else "partial",
        "lookups": lookups,
        "flyttioPayload": flyttio,
        "skvPayload": skv,
        "requiredMissing": missing,
        "diagnostics": diagnostics,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Output
# ─────────────────────────────────────────────────────────────────────────────

def print_summary(result: Dict[str, Any]) -> None:
    skv = result["skvPayload"]
    lk = result.get("lookups", {})
    ep = lk.get("eniroPersonLookup") or {}

    print("\n" + "=" * 60)
    print("  RESULTAT (v4)")
    print("=" * 60)
    print(f"  Status:     {result['status']}")
    print(f"  Namn:       {skv.get('name','')}")
    print(f"  PNR:        {skv.get('personalNumber','')}")
    print(f"  Ny adress:  {skv.get('gatuadress','')}, {skv.get('postnummer','')} {skv.get('postort','')}")
    print(f"  Lgh-nr:     {skv.get('lagenhetsnummer','') or '(ej angivet)'}")
    print(f"  Datum:      {skv.get('inflyttningsdatum','')}")
    print(f"  Telefon:    {skv.get('telefonnummer','') or '(saknas)'}")
    print(f"  E-post:     {skv.get('email','') or '(saknas)'}")
    print(f"  Fast.bet:   {skv.get('fastighetsbeteckning','') or '(ej angivet)'}")
    print(f"  Fast.agare: {skv.get('fastighetsagare','') or '(ej angivet)'}")
    if ep:
        extras = []
        if ep.get("telephone"): extras.append(f"telefon={ep['telephone']}")
        if ep.get("fastighetsbeteckning"): extras.append(f"fastighet={ep['fastighetsbeteckning']}")
        if extras: print(f"\n  Eniro-data (nuv. adr): {', '.join(extras)}")
    if result.get("requiredMissing"):
        print(f"\n  SAKNADE KRAV: {', '.join(result['requiredMissing'])}")
    else:
        print("\n  Alla kravfalt ar ifyllda.")
    print("=" * 60)


# ─────────────────────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="PNR lookup v4 — komplett datainsamling for flyttanmalan.")
    p.add_argument("personnummer", nargs="?", help="Personnummer (10/12 siffror).")
    p.add_argument("--pap-api-key", default="", help="PAP API-nyckel.")
    p.add_argument("--eniro-api-key", default="", help="Eniro Company Search API-nyckel (for fastighetsagare).")
    p.add_argument("--skip-eniro", action="store_true", help="Hoppa over Eniro person-berikning.")
    p.add_argument("--out", default="", help="Output-JSON sokvag.")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    print("Beroenden: pip install -r requirements.txt")
    print("Playwright: playwright install chromium\n")

    raw = args.personnummer or input("Ange personnummer: ").strip()
    if not raw:
        print("Inget personnummer."); return 1

    pap_key = (args.pap_api_key or os.environ.get("PAP_API_KEY","")).strip()
    eniro_key = (args.eniro_api_key or os.environ.get("ENIRO_API_KEY","")).strip()

    try:
        result = run_wizard(raw, pap_key, eniro_key, skip_eniro=args.skip_eniro)
    except Exception as exc:
        print(f"Fel: {exc}"); return 1

    out = Path(args.out).expanduser().resolve() if args.out else Path(__file__).resolve().parent / "pnr_lookup_v4_output.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print_summary(result)
    print(f"\nJSON sparad: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
