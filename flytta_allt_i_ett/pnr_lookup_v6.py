#!/usr/bin/env python3
"""
PNR lookup v6 - maximal auto-ifyllning fran bara personnummer.

Flode:
  1. PNR -> Biluppgifter.se  (namn, stad, raadress inkl. lgh-nr + postnr)
  2. Namn+stad -> Eniro person (telefon, fastighetsbeteckning, postnr, adress, fodelsedatum)
  3. Postnr -> PAP API (ort, kommun, lan)
  4. Manuellt: ny adress, flyttdatum, e-post + ovriga SKV-falt
  4b. Ny adress -> Eniro kart-API (boende pa adressen -> personsida -> fastighet/agare)
  5. Bygg slutpayload for flyttblanketten

Kor:
    python pnr_lookup_v6.py 19860324XXXX
    python pnr_lookup_v6.py --pap-api-key <KEY> --eniro-api-key <KEY>
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
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

# -- Constants -----------------------------------------------------------------

BILUPPGIFTER = "https://biluppgifter.se"
ENIRO = "https://www.eniro.se"
ENIRO_API = "https://api.eniro.com/cs/search/basic"
ENIRO_MAP = f"{ENIRO}/kartor/s%C3%B6k"
PAP_API = "https://api.papapi.se/lite/"
BLOCKED = (
    "Just a moment",
    "Checking your browser",
    "Attention Required",
    "Enable JavaScript and cookies",
    "cf-browser-verification",
    "cloudflare",
)
NOT_FOUND = ("Kunde inte hitta brukaren", "hittar inte den sida", "Ooups")
UA = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
]
BLOCK_RES = [
    "**/*.{png,jpg,jpeg,gif,svg,ico,webp,avif}",
    "**/*.{css,woff,woff2,ttf,eot}",
    "**/api.pirsch.io/**",
    "**/fonts.googleapis.com/**",
    "**/fonts.gstatic.com/**",
    "**/www.googletagmanager.com/**",
    "**/www.google-analytics.com/**",
]
FASTIGHET_STOPWORDS = {
    "ADRESS",
    "POSTNUMMER",
    "POSTORT",
    "STADSDEL",
    "KOORDINATER",
    "TELEFONNUMMER",
    "PERSONNAMN",
    "EFTERNAMN",
    "TILLTALSNAMN",
    "FODELSEDATUM",
    "FODELSEDATUM",
    "VAGBESKRIVNING",
}


def _ua() -> str:
    return random.choice(UA)


def _jit(s: float) -> float:
    return max(0.2, s * (0.6 + random.random() * 0.8))


def _npostal(v: str) -> str:
    return re.sub(r"\s+", "", v or "")


def _nemail(v: str) -> str:
    return (v or "").strip().lower()


def _dphone(v: str) -> str:
    return " ".join((v or "").split()).strip()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _run_async(coro):
    try:
        return asyncio.run(coro)
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            try:
                import nest_asyncio

                nest_asyncio.apply()
                return asyncio.run(coro)
            except Exception:
                return None
        return None
    except Exception:
        return None


# -- PNR -----------------------------------------------------------------------

def _luhn(nine: str) -> int:
    t = 0
    for i, c in enumerate(nine):
        n = int(c)
        n = n * 2 if i % 2 == 0 else n
        n = n - 9 if n > 9 else n
        t += n
    return (10 - t % 10) % 10


def normalize_pnr(raw: str) -> str:
    raw = raw.strip()
    d = re.sub(r"\D", "", raw)
    sep = next((c for c in raw if c in "-+"), "+")
    if len(d) == 12:
        norm = d
    elif len(d) == 10:
        yy = int(d[:2])
        now = datetime.now()
        cy = now.year % 100
        cen = now.year // 100
        fy = (cen - 1) * 100 + yy if sep == "+" else (cen * 100 + yy - (100 if yy > cy else 0))
        norm = f"{fy:04d}{d[2:]}"
    else:
        raise ValueError("PNR: 10 eller 12 siffror kravs.")
    try:
        datetime.strptime(norm[:8], "%Y%m%d")
    except ValueError as e:
        raise ValueError("PNR: ogiltigt datum.") from e
    if _luhn(norm[2:11]) != int(norm[11]):
        raise ValueError("PNR: fel kontrollsiffra.")
    return norm


def split_name(n: str) -> Tuple[str, str]:
    p = [x for x in n.split() if x]
    return ("", "") if not p else (p[0], "") if len(p) == 1 else (" ".join(p[:-1]), p[-1])


# -- Biluppgifter --------------------------------------------------------------

def _bil_url(pnr: str) -> str:
    return f"{BILUPPGIFTER}/brukare/{base64.b64encode(pnr.encode()).decode()}/"


def _is_blocked(code: int, html: str) -> bool:
    return code >= 400 or any(b.lower() in html.lower() for b in BLOCKED)


def _fetch_cffi(url: str) -> Optional[str]:
    try:
        r = importlib.import_module("curl_cffi.requests")
    except ImportError:
        return None
    resp = r.get(url, impersonate="chrome124", headers={"User-Agent": _ua()}, timeout=25)
    return None if _is_blocked(resp.status_code, resp.text) else resp.text


def _fetch_pw_sync(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        br = pw.chromium.launch(headless=True)
        ctx = br.new_context(user_agent=_ua(), locale="sv-SE")
        pg = ctx.new_page()
        for pattern in BLOCK_RES:
            pg.route(pattern, lambda route: route.abort())
        resp = pg.goto(url, wait_until="domcontentloaded", timeout=25000)
        if not resp or resp.status >= 400:
            raise RuntimeError(f"HTTP {getattr(resp, 'status', '?')}")
        pg.wait_for_timeout(1200)
        html = pg.content()
        br.close()
        return html


def fetch_html(url: str) -> str:
    html = _fetch_cffi(url)
    return html if html else _fetch_pw_sync(url)


def biluppgifter_lookup(pnr: str) -> Optional[Dict[str, Any]]:
    html = fetch_html(_bil_url(pnr))
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ", True)
    if any(p in text for p in NOT_FOUND):
        return None
    m = re.search(r"Visa\s+(.+?)\s+(?:pa|på)\s+Ratsit", text)
    name = m.group(1).strip() if m else ""
    if not name:
        fb = re.search(r"([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-\s]{2,50}),\s+en\s+privatperson", text)
        name = fb.group(1).strip() if fb else ""
    if not name:
        return None
    fn, ln = split_name(name)
    age_m = re.search(r"(\d{1,3})\s+(?:ar|år)", text)
    city_m = re.search(r"bor\s+i\s+([A-ZÅÄÖ][a-zåäö]+(?:[\s-][A-ZÅÄÖ][a-zåäö]+)?)", text)
    addr_m = re.search(r"\bAdress\s+([^\n\r,]{3,80})", text)
    addr = (
        re.split(r"\s{2,}|Kontakt|Telefon|Fordon|Visa\s", addr_m.group(1).strip())[0].strip()
        if addr_m
        else ""
    )
    return {
        "pnr": pnr,
        "firstName": fn,
        "lastName": ln,
        "name": name,
        "fromCity": city_m.group(1).strip() if city_m else "",
        "fromStreetRaw": addr,
        "age": int(age_m.group(1)) if age_m else None,
    }


# -- Address parsing (extracts lgh from raw string) ----------------------------

def parse_address(raw: str) -> Dict[str, str]:
    c = " ".join((raw or "").split())
    out: Dict[str, str] = {"street": "", "postal": "", "city": "", "apt": ""}
    if not c:
        return out
    lgh = re.search(r"\blgh\s+(\d{4})\b", c, re.I)
    if lgh:
        out["apt"] = lgh.group(1)
        c = c[: lgh.start()].strip().rstrip(",")
    full = re.search(r"^(?P<s>.+?)[,\s]+(?P<p>\d{3}\s?\d{2})\s+(?P<c>[A-Za-zÅÄÖåäö\-\s]+)$", c)
    if full:
        out["street"] = full.group("s").strip()
        out["postal"] = _npostal(full.group("p"))
        out["city"] = full.group("c").strip()
        return out
    parts = [p.strip() for p in c.split(",") if p.strip()]
    if parts:
        out["street"] = parts[0]
    pm = re.search(r"\b(\d{3}\s?\d{2})\b", c)
    if pm:
        out["postal"] = _npostal(pm.group(1))
    cm = re.search(r"\b\d{3}\s?\d{2}\s+([A-Za-zÅÄÖåäö\-\s]+)$", c)
    if cm:
        out["city"] = cm.group(1).strip()
    return out


# -- Eniro Person (Playwright async) -------------------------------------------

async def _ecf(page, t: int = 20) -> bool:
    deadline = time.time() + t
    while time.time() < deadline:
        title = await page.title()
        if title and "Vänta" not in title and "Just a moment" not in title:
            return True
        await page.wait_for_timeout(400)
    return False


async def _ecookies(page):
    try:
        button = page.locator("button", has_text="GODKÄNN")
        await button.wait_for(timeout=3000)
        await button.click()
        await page.wait_for_timeout(300)
    except Exception:
        pass


def _jsonld_person(html: str) -> Dict[str, Any]:
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            data = json.loads(raw.strip())
            for item in data.get("@graph", [data]):
                if item.get("@type") == "Person":
                    return item
        except Exception:
            pass
    return {}


def _vis_fastighet(html: str) -> str:
    text = BeautifulSoup(html, "lxml").get_text(" ", True)
    boende = re.search(
        r"boende\s+((?:[A-ZÅÄÖ][A-ZÅÄÖ\-]+\s*)+\d+(?::\d+)?)\s*(?:\(\d+\))?\s*(?:är|ar)\s+\d+",
        text,
    )
    if boende:
        return " ".join(boende.group(1).split()).strip()
    pattern = re.compile(
        r"\b([A-ZÅÄÖ][A-ZÅÄÖ\-]+(?:\s+[A-ZÅÄÖ][A-ZÅÄÖ\-]+)*\s+\d+(?::\d+)?)\b"
    )
    for match in pattern.finditer(text):
        candidate = " ".join(match.group(1).split()).strip()
        parts = candidate.split()
        if not parts:
            continue
        if parts[0] in FASTIGHET_STOPWORDS:
            continue
        if 4 <= len(candidate) <= 60:
            return candidate
    return ""


def _extract_companies_at_address(html: str) -> List[str]:
    text = BeautifulSoup(html, "lxml").get_text(" ", True)
    match = re.search(
        r"Det finns \d+ företag på adressen\.\s*(.+?)(?=(?:Gatuadress|Stadsdel|Postort|Postnummer|Koordinater|Hur många vill köpa|Bostäder till salu|Skicka blommor till|Vanliga frågor om|Historiska flygfoton|[A-ZÅÄÖ][A-Za-zÅÄÖåäö\-]+s namnregistrering|$))",
        text,
        re.S,
    )
    if not match:
        return []
    segment = " ".join(match.group(1).split())
    out: List[str] = []
    seen: set[str] = set()
    for part in re.split(r"\s*,\s*", segment):
        name = re.sub(r"\s+", " ", part).strip(" .")
        if not name or len(name) < 2:
            continue
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _guess_owner_name(companies: List[str]) -> str:
    tier1 = ("brf", "bostadsrättsförening", "bostadsrattsforening", "hsb brf", "riksbyggen brf")
    tier2 = ("hsb", "riksbyggen", "rikshem", "stena fastigheter", "vasakronan", "heimstaden")
    tier3 = ("fastighet", "fastigheter", "hyres", "bostad", "bostads")
    best: Optional[str] = None
    best_tier = 99
    for company in companies:
        lowered = company.lower()
        if any(kw in lowered for kw in tier1):
            return company
        if best_tier > 2 and any(kw in lowered for kw in tier2):
            best = company
            best_tier = 2
        elif best_tier > 3 and any(kw in lowered for kw in tier3):
            best = company
            best_tier = 3
    return best or ""


def _clean_eniro_link_name(label: str) -> str:
    cleaned = " ".join((label or "").split())
    cleaned = re.sub(r"\s*-\s*läs mer$", "", cleaned, flags=re.I)
    return cleaned.strip()


async def _eniro_search(br, name: str, city: str = "", mx: int = 5) -> List[Dict[str, str]]:
    slug = quote_plus(f"{name} {city}".strip() if city else name)
    url = f"{ENIRO}/{slug}/personer"
    out: List[Dict[str, str]] = []
    ctx = await br.new_context(user_agent=_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
    pg = await ctx.new_page()
    try:
        await pg.goto(url, wait_until="domcontentloaded", timeout=25000)
        if not await _ecf(pg):
            return []
        await _ecookies(pg)
        await pg.wait_for_timeout(500)
        seen: set[str] = set()
        for link in await pg.locator("a[href*='/person']").all():
            href = await link.get_attribute("href")
            pid = re.search(r"/(\d{6,12})/person", href or "")
            if pid and pid.group(1) not in seen:
                seen.add(pid.group(1))
                full = f"{ENIRO}{href}" if (href or "").startswith("/") else (href or "")
                out.append({"id": pid.group(1), "url": full})
            if len(out) >= mx:
                break
    except Exception:
        pass
    finally:
        await ctx.close()
    return out


async def _eniro_map_companies_async(slug: str) -> List[str]:
    """Fetch company names from the Companies tab of Eniro map view."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        ctx = await br.new_context(user_agent=_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
        pg = await ctx.new_page()
        try:
            await pg.goto(f"{ENIRO_MAP}/{slug}?t=addressLookupCompanies",
                          wait_until="domcontentloaded", timeout=30000)
            if not await _ecf(pg):
                return []
            await _ecookies(pg)
            await pg.wait_for_timeout(600)
            companies: List[str] = []
            skip = {"Vi värdesätter din integritet", "Välkommen till vår nya karta!"}
            for heading in await pg.locator("h2").all():
                name = (await heading.inner_text()).strip()
                if name and name not in skip and len(name) > 1:
                    companies.append(name)
            return companies
        except Exception:
            return []
        finally:
            await ctx.close()
            await br.close()


async def _eniro_map_persons_async(slug: str, mx: int = 30) -> List[Dict[str, str]]:
    """Fetch person links from the Persons tab of Eniro map view."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        ctx = await br.new_context(user_agent=_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
        pg = await ctx.new_page()
        try:
            await pg.goto(f"{ENIRO_MAP}/{slug}?t=addressLookupPersons",
                          wait_until="domcontentloaded", timeout=30000)
            if not await _ecf(pg):
                return []
            await _ecookies(pg)
            try:
                await pg.locator("a[href*='/person']").first.wait_for(timeout=8000)
            except Exception:
                pass
            await pg.wait_for_timeout(400)
            seen: set[str] = set()
            residents: List[Dict[str, str]] = []
            for link in await pg.locator("a[href*='/person']").all():
                href = await link.get_attribute("href")
                label = _clean_eniro_link_name(await link.inner_text())
                pid = re.search(r"/(\d{6,12})/person", href or "")
                if not href or not pid:
                    continue
                ident = pid.group(1)
                if ident in seen:
                    continue
                seen.add(ident)
                residents.append({
                    "id": ident,
                    "name": label,
                    "url": f"{ENIRO}{href}" if href.startswith("/") else href,
                })
                if len(residents) >= mx:
                    break
            return residents
        except Exception:
            return []
        finally:
            await ctx.close()
            await br.close()


async def _eniro_address_map_async(street: str, postal: str, city: str, mx: int = 30) -> Dict[str, Any]:
    """Two separate browser sessions for Companies and Persons tabs."""
    query = " ".join(part for part in [street, postal, city] if part).strip()
    if not query:
        return {"residents": [], "companies": []}
    slug = quote_plus(query)
    companies = await _eniro_map_companies_async(slug)
    await asyncio.sleep(_jit(0.4))
    residents = await _eniro_map_persons_async(slug, mx)
    return {"residents": residents, "companies": companies}


async def _eniro_page(br, url: str) -> Optional[Dict[str, Any]]:
    ctx = await br.new_context(user_agent=_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
    pg = await ctx.new_page()
    try:
        await pg.goto(url, wait_until="domcontentloaded", timeout=25000)
        if not await _ecf(pg):
            return None
        await _ecookies(pg)
        await pg.wait_for_timeout(300)
        html = await pg.content()
        person = _jsonld_person(html)
        if not person.get("name"):
            return None
        address = person.get("address", {})
        companies = _extract_companies_at_address(html)
        return {
            "name": person.get("name", ""),
            "givenName": person.get("givenName", ""),
            "familyName": person.get("familyName", ""),
            "birthDate": person.get("birthDate", ""),
            "telephone": person.get("telephone", ""),
            "street": address.get("streetAddress", ""),
            "postal": address.get("postalCode", ""),
            "city": address.get("addressLocality", ""),
            "fastighet": _vis_fastighet(html),
            "foretag_pa_adressen": ", ".join(companies),
            "companiesAtAddress": companies,
            "propertyOwnerGuess": _guess_owner_name(companies),
            "url": url,
        }
    except Exception:
        return None
    finally:
        await ctx.close()


async def _eniro_resolve(name: str, city: str = "", street: str = "") -> Optional[Dict[str, Any]]:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        try:
            persons = await _eniro_search(br, name, city)
            if not persons and city:
                persons = await _eniro_search(br, name, "")
            if not persons:
                return None

            target_name = set(name.lower().split())
            street_words = set(re.sub(r"\d+\w*", "", street.lower()).split()) - {"lgh", ""}
            best: Optional[Dict[str, Any]] = None

            for person in persons:
                await asyncio.sleep(_jit(0.5))
                data = await _eniro_page(br, person["url"])
                if not data:
                    continue
                found_name = set(data["name"].lower().split())
                if not (target_name & found_name):
                    continue

                if street_words:
                    eniro_street = re.sub(r"\d+\w*", "", data.get("street", "").lower())
                    if street_words & set(eniro_street.split()):
                        return data
                    if not best:
                        best = data
                else:
                    return data

            return best
        finally:
            await br.close()


async def _eniro_fetch_address_property_async(resident_url: str) -> Optional[Dict[str, Any]]:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return None
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        try:
            return await _eniro_page(br, resident_url)
        finally:
            await br.close()


def eniro_person(name: str, city: str = "", street: str = "") -> Optional[Dict[str, Any]]:
    if not name.strip():
        return None
    return _run_async(_eniro_resolve(name, city, street))


def eniro_address_lookup(street: str, postal: str, city: str, limit: int = 20) -> Dict[str, Any]:
    if not street.strip() or not postal.strip() or not city.strip():
        return {"residents": [], "companies": []}
    return _run_async(_eniro_address_map_async(street, postal, city, limit)) or {"residents": [], "companies": []}


def eniro_fetch_address_property(resident: Dict[str, str] | str) -> Optional[Dict[str, Any]]:
    url = resident.get("url", "") if isinstance(resident, dict) else str(resident)
    if not url.strip():
        return None
    return _run_async(_eniro_fetch_address_property_async(url))


# -- Eniro Company (REST) ------------------------------------------------------

def eniro_company(street: str, city: str, key: str) -> List[Dict[str, str]]:
    if not key.strip() or not street.strip():
        return []
    sn = re.split(r"\d", street)[0].strip()
    if not sn or len(sn) < 3:
        sn = street.strip()
    params = urlencode(
        {
            "profile": "APIGW",
            "key": key.strip(),
            "country": "se",
            "search_word": sn,
            **({"geo_area": city} if city else {}),
        }
    )
    req = Request(f"{ENIRO_API}?{params}", headers={"User-Agent": _ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode())
        adverts = data.get("adverts")
        if not isinstance(adverts, list):
            return []
        return [
            {
                "name": str(advert.get("companyName", "")).strip(),
                "addr": str(advert.get("address", "")).strip(),
                "phone": str(advert.get("phoneNumber", "")).strip(),
                "city": str(advert.get("city", "")).strip(),
            }
            for advert in adverts[:5]
            if advert.get("companyName")
        ]
    except Exception:
        return []


def guess_owner(companies: List[Dict[str, str]], street: str) -> str:
    keywords = ("bostads", "fastighet", "hyres", "brf", "bostad", "hemfosa", "stena", "rikshem", "vasakrona")
    street_lower = street.lower()
    for company in companies:
        name = company.get("name", "")
        if any(keyword in name.lower() for keyword in keywords):
            return f"{name} {company.get('phone', '')}".strip()
        if any(word in company.get("addr", "").lower() for word in street_lower.split()[:2]):
            return f"{name} {company.get('phone', '')}".strip()
    return ""


# -- PAP -----------------------------------------------------------------------

def pap(postal: str, key: str) -> Optional[Dict[str, str]]:
    clean = _npostal(postal)
    if not re.fullmatch(r"\d{5}", clean) or not key.strip():
        return None
    params = urlencode({"query": clean, "format": "json", "apikey": key.strip()})
    req = Request(f"{PAP_API}?{params}", headers={"User-Agent": _ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=8) as response:
            data = json.loads(response.read().decode())
        item = (data.get("results") or [None])[0]
        return {
            "postal": clean,
            "city": str(item["city"]).strip(),
            "mun": str(item.get("county", "")).strip(),
        } if item and item.get("city") else None
    except Exception:
        return None


# -- Validators + interactive --------------------------------------------------

def _vdate(v):
    if not v:
        return False, "Datum kravs."
    try:
        datetime.strptime(v, "%Y-%m-%d")
        return True, ""
    except Exception:
        return False, "Format: YYYY-MM-DD."


def _vpostal_r(v):
    return (True, "") if re.fullmatch(r"\d{5}", _npostal(v)) else (False, "5 siffror.")


def _vpostal_o(v):
    return (True, "") if not v else _vpostal_r(v)


def _vemail(v):
    if not v:
        return True, ""
    return (True, "") if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v) else (False, "Ogiltig.")


def _vphone(v):
    if not v:
        return True, ""
    return (True, "") if 8 <= len(re.sub(r"\D", "", v)) <= 15 else (False, "8-15 siffror.")


def ask(label, default="", req=False, norm=None, val=None):
    while True:
        suffix = f" [{default}]" if default else ""
        raw = input(f"{label}{suffix}: ").strip()
        value = raw if raw else default
        if norm:
            value = norm(value)
        if req and not value:
            print("  -> Obligatoriskt.")
            continue
        if val:
            ok, msg = val(value)
            if not ok:
                print(f"  -> {msg}")
                continue
        return value


def yesno(label, dflt=True):
    suffix = " [Y/n]" if dflt else " [y/N]"
    while True:
        value = input(f"{label}{suffix}: ").strip().lower()
        if not value:
            return dflt
        if value in ("y", "yes", "j", "ja"):
            return True
        if value in ("n", "no", "nej"):
            return False


# -- Payload builders ----------------------------------------------------------

def _rn(f):
    name = f.get("name", "").strip()
    return name or " ".join(x for x in [f.get("firstName", ""), f.get("lastName", "")] if x.strip()).strip()


def build_flyttio(f):
    return {
        k: (f.get(k, "") or "").strip()
        for k in (
            "firstName",
            "lastName",
            "personalNumber",
            "email",
            "fromStreet",
            "fromPostal",
            "fromCity",
            "toStreet",
            "toPostal",
            "toCity",
            "apartmentNumber",
            "propertyDesignation",
            "propertyOwner",
            "moveDate",
        )
    } | {"name": _rn(f), "phone": _dphone(f.get("phone", ""))}


def build_skv(f):
    return {
        "inflyttningsdatum": f.get("moveDate", "").strip(),
        "period": f.get("period", "true").strip() or "true",
        "gatuadress": f.get("toStreet", "").strip(),
        "postnummer": _npostal(f.get("toPostal", "")),
        "postort": f.get("toCity", "").strip(),
        "lagenhetsnummer": f.get("apartmentNumber", "").strip(),
        "fastighetsbeteckning": f.get("propertyDesignation", "").strip(),
        "fastighetsagare": f.get("propertyOwner", "").strip(),
        "telefonnummer": _dphone(f.get("phone", "")),
        "email": _nemail(f.get("email", "")),
        "name": _rn(f),
        "personalNumber": f.get("personalNumber", "").strip(),
    }


def missing_req(skv):
    return [k for k in ("inflyttningsdatum", "period", "gatuadress", "postnummer", "postort") if not skv.get(k, "").strip()]


# -- Contact cache (stores phone/email per PNR between runs) -------------------

CACHE_FILE = Path(__file__).resolve().parent / ".contact_cache.json"


def _load_cache() -> Dict[str, Dict[str, str]]:
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
    except Exception:
        return {}


def _save_cache(cache: Dict[str, Dict[str, str]]):
    try:
        CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except Exception:
        pass


CACHE_TTL_HOURS = 48


def _cache_get(pnr: str) -> Dict[str, str]:
    return _load_cache().get(pnr, {})


def _cache_is_fresh(entry: Dict[str, str], max_hours: float = CACHE_TTL_HOURS) -> bool:
    ts = entry.get("updated", "")
    if not ts:
        return False
    try:
        updated = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - updated
        return age.total_seconds() < max_hours * 3600
    except Exception:
        return False


_CACHE_FIELDS = ("phone", "email", "fromPostal", "fromStreet", "fromCity", "fastighet")


def _cache_put(pnr: str, data: Dict[str, str]):
    values = {k: v.strip() for k, v in data.items() if k in _CACHE_FIELDS and v and v.strip()}
    if not values:
        return
    cache = _load_cache()
    entry = cache.get(pnr, {})
    entry.update(values)
    entry["updated"] = _utc_now_iso()
    cache[pnr] = entry
    _save_cache(cache)


# -- Wizard --------------------------------------------------------------------

def run(raw_pnr: str, pap_key: str, eniro_key: str, skip_eniro: bool = False,
        use_cache: bool = False):
    pnr = normalize_pnr(raw_pnr)
    lk: Dict[str, Any] = {
        "bil": None, "bilErr": None, "eniro": None, "eniroErr": None,
        "eniroCo": None, "eniroAddrResidents": None, "eniroAddrProperty": None,
        "eniroAddrErr": None, "papFrom": None, "papTo": None,
    }
    f: Dict[str, str] = {
        k: ""
        for k in (
            "personalNumber", "firstName", "lastName", "name",
            "fromStreet", "fromPostal", "fromCity",
            "toStreet", "toPostal", "toCity", "moveDate",
            "apartmentNumber", "propertyDesignation", "propertyOwner",
            "phone", "email", "period", "fastighet",
        )
    }
    f["personalNumber"] = pnr
    f["period"] = "true"

    cached: Dict[str, str] = {}
    cache_fresh = False
    if use_cache:
        cached = _cache_get(pnr)
        for ck in _CACHE_FIELDS:
            if cached.get(ck) and not f.get(ck):
                f[ck] = cached[ck]
        cache_fresh = bool(cached.get("phone") and _cache_is_fresh(cached))
        if cached:
            visible = ", ".join(f"{k}={v}" for k, v in cached.items() if k != "updated" and v)
            if visible:
                print(f"  (Cache: {visible})")

    # ══════════════════════════════════════════════════════════════════════════
    #  FAS 1: Automatiska uppslag (inga prompts)
    # ══════════════════════════════════════════════════════════════════════════

    print("\n[1] Biluppgifter.se - PNR-uppslag")
    try:
        person = biluppgifter_lookup(pnr)
        lk["bil"] = person
        if person:
            f["firstName"] = person.get("firstName", "")
            f["lastName"] = person.get("lastName", "")
            f["name"] = person.get("name", "")
            f["fromCity"] = person.get("fromCity", "")
            addr = parse_address(person.get("fromStreetRaw", ""))
            f["fromStreet"] = addr["street"]
            f["fromPostal"] = addr["postal"]
            if addr["city"]:
                f["fromCity"] = addr["city"]
            if addr["apt"]:
                f["apartmentNumber"] = addr["apt"]
            print(f"  OK: {person['name']} ({person.get('fromCity', '?')})")
            if addr["apt"]:
                print(f"  Lgh-nr: {addr['apt']}")
        else:
            print("  Ingen traff.")
    except Exception as e:
        lk["bilErr"] = str(e)
        print(f"  Fel: {e}")

    if skip_eniro:
        print("\n[2] Eniro - hoppas over (--skip-eniro)")
    elif not f["name"]:
        print("\n[2] Eniro - hoppas over (inget namn)")
    elif cache_fresh:
        print(f"\n[2] Eniro - hoppas over (cache < {CACHE_TTL_HOURS}h)")
    else:
        print("\n[2] Eniro - person-berikning")
        print(f"  Soker: {f['name']} {f['fromCity']}".strip())
        try:
            en = eniro_person(f["name"], f["fromCity"], f["fromStreet"])
            lk["eniro"] = en
            if en:
                got = []
                if en.get("telephone"):
                    f["phone"] = _dphone(en["telephone"])
                    got.append(f"tel: {en['telephone']}")
                if en.get("fastighet"):
                    f["fastighet"] = en["fastighet"]
                    got.append(f"fastighet: {en['fastighet']}")
                if en.get("postal") and not f["fromPostal"]:
                    f["fromPostal"] = _npostal(en["postal"])
                    got.append(f"postnr: {en['postal']}")
                if en.get("street") and not f["fromStreet"]:
                    f["fromStreet"] = en["street"]
                    got.append(f"adress: {en['street']}")
                if en.get("city") and not f["fromCity"]:
                    f["fromCity"] = en["city"]
                    got.append(f"ort: {en['city']}")
                print(f"  -> {', '.join(got)}" if got else "  -> Person hittad men inga nya falt.")
                _cache_put(pnr, {k: f.get(k, "") for k in _CACHE_FIELDS})
            else:
                print("  -> Ingen traff (personen saknas i Eniro).")
        except Exception as e:
            lk["eniroErr"] = str(e)
            print(f"  -> Fel: {e}")

    if eniro_key and f["fromStreet"] and f["fromCity"]:
        print("\n[2b] Eniro foretagssok (nuv. adress)")
        companies = eniro_company(f["fromStreet"], f["fromCity"], eniro_key)
        lk["eniroCo"] = companies
        owner = guess_owner(companies, f["fromStreet"])
        if owner:
            print(f"  -> Mojlig agare: {owner}")
        elif companies:
            print(f"  -> {len(companies)} foretag, ingen tydlig agare.")
        else:
            print("  -> Inga foretag hittades.")

    if pap_key and f["fromPostal"]:
        p = pap(f["fromPostal"], pap_key)
        lk["papFrom"] = p
        if p and p.get("city") and not f["fromCity"]:
            f["fromCity"] = p["city"]
            print(f"  PAP: fromCity -> {p['city']}")

    # ══════════════════════════════════════════════════════════════════════════
    #  FAS 2: Sammanfattning + komplettering av tomma falt
    # ══════════════════════════════════════════════════════════════════════════

    print(f"\n{'─' * 50}")
    print("  Auto-ifyllt fran PNR:")
    print(f"    Namn:       {f['name'] or '?'}")
    print(f"    Adress:     {f['fromStreet'] or '?'}, {f['fromPostal'] or '?'} {f['fromCity'] or '?'}")
    if f["apartmentNumber"]:
        print(f"    Lgh-nr:     {f['apartmentNumber']}")
    if f["phone"]:
        print(f"    Telefon:    {f['phone']}")
    if f["fastighet"]:
        print(f"    Fastighet:  {f['fastighet']} (nuv.adr)")
    print(f"{'─' * 50}")

    if not f["firstName"] or not f["lastName"]:
        f["firstName"] = ask("Fornamn", f["firstName"], req=True)
        f["lastName"] = ask("Efternamn", f["lastName"], req=True)
        f["name"] = f"{f['firstName']} {f['lastName']}".strip()
    if not f["fromStreet"]:
        f["fromStreet"] = ask("Nuvarande gatuadress", req=True)
    if not f["fromPostal"]:
        f["fromPostal"] = ask("Nuvarande postnr", norm=_npostal, val=_vpostal_r, req=True)
    if f["fromPostal"] and not f["fromCity"] and pap_key:
        p = pap(f["fromPostal"], pap_key)
        if p and p.get("city"):
            f["fromCity"] = p["city"]
            print(f"  PAP: -> {f['fromCity']}")
    if not f["fromCity"]:
        f["fromCity"] = ask("Nuvarande ort", req=True)

    # ══════════════════════════════════════════════════════════════════════════
    #  FAS 3: Ny adress (alltid manuellt) + auto-uppslag
    # ══════════════════════════════════════════════════════════════════════════

    print("\n  Ange den NYA adressen:")
    f["toStreet"] = ask("  Ny gatuadress", f["toStreet"], req=True)
    while True:
        f["toPostal"] = ask("  Nytt postnr", f["toPostal"], norm=_npostal, val=_vpostal_o)
        pt = pap(f["toPostal"], pap_key) if f["toPostal"] and pap_key else None
        if pt:
            lk["papTo"] = pt
        suggested_city = f["toCity"] or (pt["city"] if pt and pt.get("city") else "")
        if pt and pt.get("city") and not f["toCity"]:
            print(f"  PAP: -> {pt['city']}")
        f["toCity"] = ask("  Ny ort", suggested_city)
        if not f["toPostal"] and f["toCity"]:
            print("  Postnr kravs.")
            f["toPostal"] = ask("  Nytt postnr", req=True, norm=_npostal, val=_vpostal_r)
        if not f["toCity"] and f["toPostal"]:
            pt = pap(f["toPostal"], pap_key) if pap_key else None
            if pt and pt.get("city"):
                f["toCity"] = pt["city"]
                print(f"  PAP: -> {f['toCity']}")
            else:
                f["toCity"] = ask("  Ny ort", req=True)
        if f["toPostal"] and f["toCity"]:
            break
        print("  Bade postnr och ort behovs.")

    f["moveDate"] = ask("  Inflyttningsdatum (YYYY-MM-DD)", f["moveDate"], req=True, val=_vdate)

    print(f"\n[3] Eniro adress-uppslag (ny adress)")
    if skip_eniro:
        print("  Hoppar over (--skip-eniro).")
    else:
        print(f"  Soker foretag + boende pa {f['toStreet']}, {f['toPostal']} {f['toCity']}...")
        try:
            map_data = eniro_address_lookup(f["toStreet"], f["toPostal"], f["toCity"])
            residents = map_data["residents"]
            map_companies = map_data["companies"]
            lk["eniroAddrResidents"] = residents
            lk["eniroAddrCompanies"] = map_companies

            if map_companies:
                print(f"  -> {len(map_companies)} foretag pa adressen.")
                owner_from_companies = _guess_owner_name(map_companies)
                if owner_from_companies:
                    f["propertyOwner"] = owner_from_companies
                    print(f"  -> Fastighetsagare: {owner_from_companies}")
                else:
                    print(f"  -> Ingen BRF/fastighetsbolag bland: {', '.join(map_companies[:5])}")
            else:
                print("  -> Inga foretag hittades pa adressen.")

            if residents:
                first = residents[0]
                rname = first.get("name", "") or first.get("url", "")
                print(f"  -> {len(residents)} boende. Hamtar personsida for {rname}...")
                addr_property = eniro_fetch_address_property(first)
                lk["eniroAddrProperty"] = addr_property
                if addr_property:
                    if addr_property.get("fastighet") and not f["propertyDesignation"]:
                        f["propertyDesignation"] = addr_property["fastighet"]
                    if addr_property.get("propertyOwnerGuess") and not f["propertyOwner"]:
                        f["propertyOwner"] = addr_property["propertyOwnerGuess"]
                    if addr_property.get("fastighet"):
                        print(f"  -> Fastighetsbeteckning: {addr_property['fastighet']}")
                    else:
                        print("  -> Ingen fastighetsbeteckning synlig pa personsidan.")
                else:
                    print("  -> Kunde inte lasa personsidan for vald boende.")
            else:
                print("  -> Inga boende hittades pa adressen.")
        except Exception as e:
            lk["eniroAddrErr"] = str(e)
            print(f"  -> Fel: {e}")

    # ══════════════════════════════════════════════════════════════════════════
    #  FAS 4: Komplettera resterande tomma falt
    # ══════════════════════════════════════════════════════════════════════════

    remaining: List[Tuple[str, str, Optional[Any], Optional[Any]]] = []
    if not f["phone"]:
        remaining.append(("phone", "Telefonnummer", _dphone, _vphone))
    if not f["email"]:
        remaining.append(("email", "E-post", _nemail, _vemail))
    if not f["propertyDesignation"]:
        current_fastighet = (lk.get("eniro") or {}).get("fastighet", "") or f.get("fastighet", "")
        if current_fastighet:
            print(f"  Tips: '{current_fastighet}' ar fastighetsbeteckning for nuvarande adress.")
        remaining.append(("propertyDesignation", "Fastighetsbeteckning (ny adress)", None, None))
    if not f["propertyOwner"]:
        owner_hint = ""
        map_cos = lk.get("eniroAddrCompanies") or []
        if map_cos:
            owner_hint = _guess_owner_name(map_cos)
        if not owner_hint:
            addr_prop = lk.get("eniroAddrProperty") or {}
            owner_hint = addr_prop.get("propertyOwnerGuess", "") or addr_prop.get("foretag_pa_adressen", "")
        if not owner_hint and lk.get("eniroCo"):
            owner_hint = guess_owner(lk.get("eniroCo") or [], f.get("toStreet", ""))
        if owner_hint:
            print(f"  Tips: '{owner_hint}' hittades pa adressen.")
        remaining.append(("propertyOwner", "Fastighetsagare (t.ex. 'egen' eller hyresvard)", None, None))

    if remaining:
        print(f"\n  {len(remaining)} falt kvar att fylla i:")
        for key, label, norm, val in remaining:
            f[key] = ask(f"  {label}", f[key], norm=norm, val=val)

    if not yesno("  Period = 'Tills vidare'?"):
        f["period"] = "false"

    _cache_put(pnr, {k: f.get(k, "") for k in _CACHE_FIELDS})

    flio = build_flyttio(f)
    skv = build_skv(f)
    miss = missing_req(skv)
    diag = []
    if not lk.get("eniro") and not skip_eniro and not cache_fresh:
        diag.append("Eniro: personen saknas i registret.")
    if not lk.get("eniroAddrResidents") and not skip_eniro:
        diag.append("Eniro adress: hittade inga boende pa nya adressen.")
    if not f.get("phone"):
        diag.append("Telefon: ingen kalla levererade det automatiskt.")
    if not f.get("email"):
        diag.append("E-post: kan aldrig hamtas automatiskt.")

    return {
        "generatedAt": _utc_now_iso(),
        "version": "v6",
        "status": "complete" if not miss else "partial",
        "lookups": lk,
        "flyttioPayload": flio,
        "skvPayload": skv,
        "requiredMissing": miss,
        "diagnostics": diag,
    }


# -- Output --------------------------------------------------------------------

def show(r):
    s = r["skvPayload"]
    lookups = r.get("lookups") or {}
    en = lookups.get("eniro") or {}
    en_addr = lookups.get("eniroAddrProperty") or {}
    residents = lookups.get("eniroAddrResidents") or []
    print(f"\n{'=' * 60}\n  RESULTAT (v6)\n{'=' * 60}")
    print(f"  Status:     {r['status']}")
    print(f"  Namn:       {s.get('name', '')}")
    print(f"  PNR:        {s.get('personalNumber', '')}")
    print(f"  Ny adress:  {s.get('gatuadress', '')}, {s.get('postnummer', '')} {s.get('postort', '')}")
    print(f"  Lgh-nr:     {s.get('lagenhetsnummer', '') or '(ej)'}")
    print(f"  Datum:      {s.get('inflyttningsdatum', '')}")
    print(f"  Telefon:    {s.get('telefonnummer', '') or '(saknas)'}")
    print(f"  E-post:     {s.get('email', '') or '(saknas)'}")
    print(f"  Fast.bet:   {s.get('fastighetsbeteckning', '') or '(ej)'}")
    print(f"  Fast.agare: {s.get('fastighetsagare', '') or '(ej)'}")
    if en:
        ex = [
            f"tel={en['telephone']}" if en.get("telephone") else None,
            f"fast={en['fastighet']}" if en.get("fastighet") else None,
        ]
        ex = [x for x in ex if x]
        if ex:
            print(f"\n  Eniro (nuv.adr): {', '.join(ex)}")
    map_cos = lookups.get("eniroAddrCompanies") or []
    addr_parts = [
        f"boende={len(residents)}" if residents else None,
        f"foretag={len(map_cos)}" if map_cos else None,
        f"fast={en_addr['fastighet']}" if en_addr.get("fastighet") else None,
    ]
    addr_parts = [x for x in addr_parts if x]
    if addr_parts:
        print(f"  Eniro (ny adr):   {', '.join(addr_parts)}")
    if r.get("requiredMissing"):
        print(f"\n  SAKNAS: {', '.join(r['requiredMissing'])}")
    else:
        print("\n  Alla kravfalt OK.")
    if r.get("diagnostics"):
        for d in r["diagnostics"]:
            print(f"  ! {d}")
    print("=" * 60)


# -- CLI -----------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description="PNR lookup v6 - maximal auto-ifyllning.")
    p.add_argument("personnummer", nargs="?", help="Personnummer (10/12 siffror).")
    p.add_argument("--pap-api-key", default="")
    p.add_argument("--eniro-api-key", default="")
    p.add_argument("--skip-eniro", action="store_true")
    p.add_argument("--cache", action="store_true", help="Anvand lokal cache (hoppa over Eniro om < 48h).")
    p.add_argument("--out", default="")
    a = p.parse_args()
    print("PNR lookup v6\n")
    raw = a.personnummer or input("Ange personnummer: ").strip()
    if not raw:
        print("Inget PNR.")
        return 1
    pk = (a.pap_api_key or os.environ.get("PAP_API_KEY", "")).strip()
    ek = (a.eniro_api_key or os.environ.get("ENIRO_API_KEY", "")).strip()
    try:
        result = run(raw, pk, ek, a.skip_eniro, use_cache=a.cache)
    except Exception as e:
        print(f"Fel: {e}")
        return 1
    out = Path(a.out).expanduser().resolve() if a.out else Path(__file__).resolve().parent / "pnr_lookup_v6_output.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    show(result)
    print(f"\nJSON: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
