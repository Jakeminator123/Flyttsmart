"""
Delad kod för alla lookup-skript (personnummer, namn, etc).

Importeras av:
  - entery_personnummer/pnr_lookup_v7.py
  - entery_namn/name_lookup_v1.py

Innehåller: env-laddning, färger, konstanter, retry, PNR-logik,
Biluppgifter, Eniro, PAP, adressparsning, validering, payloads, cache.
"""
from __future__ import annotations

import asyncio
import base64
import importlib
import json
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

# -- Env loading ---------------------------------------------------------------

_SHARED_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SHARED_DIR.parent

try:
    from dotenv import load_dotenv
    _root_env = _PROJECT_ROOT / ".env"
    _root_env_local = _PROJECT_ROOT / ".env.local"
    if _root_env.is_file():
        load_dotenv(_root_env)
    if _root_env_local.is_file():
        load_dotenv(_root_env_local, override=True)
except ImportError:
    pass

# -- Colour helpers (respects NO_COLOR / non-TTY) -----------------------------

_NO_COLOR = os.environ.get("NO_COLOR") or not sys.stdout.isatty()


def _c(code: str, text: str) -> str:
    return text if _NO_COLOR else f"\033[{code}m{text}\033[0m"


def _green(t: str) -> str: return _c("32", t)
def _yellow(t: str) -> str: return _c("33", t)
def _red(t: str) -> str: return _c("31", t)
def _cyan(t: str) -> str: return _c("36", t)
def _bold(t: str) -> str: return _c("1", t)
def _dim(t: str) -> str: return _c("2", t)


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
    "ADRESS", "POSTNUMMER", "POSTORT", "STADSDEL", "KOORDINATER",
    "TELEFONNUMMER", "PERSONNAMN", "EFTERNAMN", "TILLTALSNAMN",
    "FODELSEDATUM", "VAGBESKRIVNING",
}

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.5


# -- Small helpers -------------------------------------------------------------

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


# -- Retry wrapper -------------------------------------------------------------

def _retry(fn, *args, label: str = "", retries: int = MAX_RETRIES, **kwargs):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            return fn(*args, **kwargs)
        except KeyboardInterrupt:
            raise
        except Exception as e:
            last_err = e
            if attempt < retries:
                delay = RETRY_BASE_DELAY * (2 ** (attempt - 1)) * (0.5 + random.random())
                tag = f" ({label})" if label else ""
                print(_dim(f"  Försök {attempt}/{retries} misslyckades{tag}: {e}. Nytt försök om {delay:.1f}s..."))
                time.sleep(delay)
    raise last_err  # type: ignore[misc]


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
    """Normalize a Swedish PNR to 12 digits.

    Accepts: 19860324XXXX, 860324-XXXX, 860324 XXXX, etc.
    """
    raw = raw.strip()
    d = re.sub(r"\D", "", raw)
    sep = next((c for c in raw if c in "-+"), "-")

    if len(d) == 12:
        norm = d
    elif len(d) == 10:
        yy = int(d[:2])
        now = datetime.now()
        cy = now.year % 100
        cen = now.year // 100
        if sep == "+":
            fy = (cen - 1) * 100 + yy
        else:
            fy = cen * 100 + yy - (100 if yy > cy else 0)
        norm = f"{fy:04d}{d[2:]}"
    else:
        raise ValueError(
            f"Ogiltigt personnummer: förväntade 10 eller 12 siffror, fick {len(d)}.\n"
            f"  Accepterade format: YYYYMMDDXXXX, YYMMDD-XXXX, YYMMDD XXXX"
        )

    try:
        datetime.strptime(norm[:8], "%Y%m%d")
    except ValueError as e:
        raise ValueError(f"Ogiltigt datum i personnumret: {norm[:8]}") from e

    if _luhn(norm[2:11]) != int(norm[11]):
        raise ValueError(
            f"Ogiltig kontrollsiffra i personnumret.\n"
            f"  Tolkad som: {norm[:8]}-{norm[8:]}. Kontrollera att du skrivit rätt."
        )
    return norm


def build_pnr_from_birthdate_and_suffix(birthdate: str, suffix: str) -> str:
    """Build and validate a 12-digit PNR from YYYY-MM-DD birthdate + 4-digit suffix."""
    date_digits = re.sub(r"\D", "", birthdate)
    suffix_digits = re.sub(r"\D", "", suffix)
    if len(date_digits) != 8:
        raise ValueError(f"Födelsedatum måste ge 8 siffror, fick {len(date_digits)}: '{birthdate}'")
    if len(suffix_digits) != 4:
        raise ValueError(f"Slutsiffror måste vara 4 siffror, fick {len(suffix_digits)}: '{suffix}'")

    pnr = date_digits + suffix_digits
    try:
        datetime.strptime(pnr[:8], "%Y%m%d")
    except ValueError as e:
        raise ValueError(f"Ogiltigt datum: {pnr[:8]}") from e

    expected = _luhn(pnr[2:11])
    if expected != int(pnr[11]):
        raise ValueError(
            f"Ogiltig kontrollsiffra. Förväntat: {pnr[:11]}{expected}, "
            f"du angav: {pnr}. Kontrollera slutsiffrorna."
        )
    return pnr


def format_pnr(pnr: str) -> str:
    return f"{pnr[:8]}-{pnr[8:]}" if len(pnr) == 12 else pnr


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
        try:
            resp = pg.goto(url, wait_until="domcontentloaded", timeout=25000)
            if not resp or resp.status >= 400:
                raise RuntimeError(f"HTTP {getattr(resp, 'status', '?')}")
            pg.wait_for_timeout(1200)
            html = pg.content()
        finally:
            br.close()
        return html


def fetch_html(url: str) -> str:
    html = _fetch_cffi(url)
    return html if html else _fetch_pw_sync(url)


def biluppgifter_lookup(pnr: str) -> Optional[Dict[str, Any]]:
    html = _retry(fetch_html, _bil_url(pnr), label="Biluppgifter")
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
        if addr_m else ""
    )
    return {
        "pnr": pnr,
        "firstName": fn, "lastName": ln, "name": name,
        "fromCity": city_m.group(1).strip() if city_m else "",
        "fromStreetRaw": addr,
        "age": int(age_m.group(1)) if age_m else None,
    }


# -- Address parsing -----------------------------------------------------------

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
    pattern = re.compile(r"\b([A-ZÅÄÖ][A-ZÅÄÖ\-]+(?:\s+[A-ZÅÄÖ][A-ZÅÄÖ\-]+)*\s+\d+(?::\d+)?)\b")
    for match in pattern.finditer(text):
        candidate = " ".join(match.group(1).split()).strip()
        parts = candidate.split()
        if not parts or parts[0] in FASTIGHET_STOPWORDS:
            continue
        if 4 <= len(candidate) <= 60:
            return candidate
    return ""


def _extract_companies_at_address(html: str) -> List[str]:
    text = BeautifulSoup(html, "lxml").get_text(" ", True)
    match = re.search(
        r"Det finns \d+ företag på adressen\.\s*(.+?)(?=(?:Gatuadress|Stadsdel|Postort|Postnummer|Koordinater|Hur många vill köpa|Bostäder till salu|Skicka blommor till|Vanliga frågor om|Historiska flygfoton|[A-ZÅÄÖ][A-Za-zÅÄÖåäö\-]+s namnregistrering|$))",
        text, re.S,
    )
    if not match:
        return []
    segment = " ".join(match.group(1).split())
    out: List[str] = []
    seen: set[str] = set()
    for part in re.split(r"\s*,\s*", segment):
        name = re.sub(r"\s+", " ", part).strip(" .")
        if name and len(name) >= 2 and name not in seen:
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
            best, best_tier = company, 2
        elif best_tier > 3 and any(kw in lowered for kw in tier3):
            best, best_tier = company, 3
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
            label = _clean_eniro_link_name(await link.inner_text())
            pid = re.search(r"/(\d{6,12})/person", href or "")
            if pid and pid.group(1) not in seen:
                seen.add(pid.group(1))
                full = f"{ENIRO}{href}" if (href or "").startswith("/") else (href or "")
                out.append({"id": pid.group(1), "url": full, "name": label})
            if len(out) >= mx:
                break
    except Exception:
        pass
    finally:
        await ctx.close()
    return out


async def _eniro_map_companies_async(slug: str) -> List[str]:
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
                residents.append({"id": ident, "name": label,
                                  "url": f"{ENIRO}{href}" if href.startswith("/") else href})
                if len(residents) >= mx:
                    break
            return residents
        except Exception:
            return []
        finally:
            await ctx.close()
            await br.close()


async def _eniro_address_map_async(street: str, postal: str, city: str, mx: int = 30) -> Dict[str, Any]:
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


async def eniro_search_all(name: str, city: str = "", mx: int = 10) -> List[Dict[str, Any]]:
    """Search Eniro and return enriched data for ALL matching persons.

    Used by the name-entry script to let the user pick the right person.
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        try:
            search_hits = await _eniro_search(br, name, city, mx=mx)
            if not search_hits and city:
                search_hits = await _eniro_search(br, name, "", mx=mx)
            results: List[Dict[str, Any]] = []
            for hit in search_hits:
                await asyncio.sleep(_jit(0.4))
                data = await _eniro_page(br, hit["url"])
                if data:
                    results.append(data)
            return results
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


# -- Eniro sync wrappers -------------------------------------------------------

def eniro_person(name: str, city: str = "", street: str = "") -> Optional[Dict[str, Any]]:
    if not name.strip():
        return None
    return _run_async(_eniro_resolve(name, city, street))


def eniro_person_list(name: str, city: str = "", mx: int = 10) -> List[Dict[str, Any]]:
    """Return all matching Eniro persons (with full page data) for disambiguation."""
    if not name.strip():
        return []
    return _run_async(eniro_search_all(name, city, mx)) or []


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
    params = urlencode({
        "profile": "APIGW", "key": key.strip(), "country": "se", "search_word": sn,
        **({"geo_area": city} if city else {}),
    })
    req = Request(f"{ENIRO_API}?{params}", headers={"User-Agent": _ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode())
        adverts = data.get("adverts")
        if not isinstance(adverts, list):
            return []
        return [
            {"name": str(a.get("companyName", "")).strip(),
             "addr": str(a.get("address", "")).strip(),
             "phone": str(a.get("phoneNumber", "")).strip(),
             "city": str(a.get("city", "")).strip()}
            for a in adverts[:5] if a.get("companyName")
        ]
    except Exception:
        return []


def guess_owner(companies: List[Dict[str, str]], street: str) -> str:
    keywords = ("bostads", "fastighet", "hyres", "brf", "bostad", "hemfosa", "stena", "rikshem", "vasakrona")
    street_lower = street.lower()
    for company in companies:
        name = company.get("name", "")
        if any(kw in name.lower() for kw in keywords):
            return f"{name} {company.get('phone', '')}".strip()
        if any(w in company.get("addr", "").lower() for w in street_lower.split()[:2]):
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
        return {"postal": clean, "city": str(item["city"]).strip(),
                "mun": str(item.get("county", "")).strip()} if item and item.get("city") else None
    except Exception:
        return None


# -- Validators + interactive --------------------------------------------------

def _vdate(v):
    if not v:
        return False, "Datum krävs (format: YYYY-MM-DD)."
    v = v.strip().replace("/", "-").replace(".", "-")
    try:
        datetime.strptime(v, "%Y-%m-%d")
        return True, ""
    except Exception:
        pass
    try:
        datetime.strptime(v, "%y%m%d")
        return True, ""
    except Exception:
        pass
    return False, "Ogiltigt datum. Använd formatet YYYY-MM-DD (t.ex. 2025-04-01)."


def _normalize_date(v: str) -> str:
    v = v.strip()
    clean = v.replace("/", "-").replace(".", "-")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", clean):
        return clean
    digits = re.sub(r"\D", "", v)
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    if len(digits) == 6:
        yy = int(digits[:2])
        now = datetime.now()
        century = now.year // 100
        year = century * 100 + yy
        return f"{year}-{digits[2:4]}-{digits[4:6]}"
    return clean


def _vpostal_r(v):
    return (True, "") if re.fullmatch(r"\d{5}", _npostal(v)) else (False, "Postnumret ska vara 5 siffror (t.ex. 11122).")


def _vpostal_o(v):
    return (True, "") if not v else _vpostal_r(v)


def _vemail(v):
    if not v:
        return True, ""
    return (True, "") if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v) else (False, "Ogiltig e-postadress.")


def _vphone(v):
    if not v:
        return True, ""
    return (True, "") if 8 <= len(re.sub(r"\D", "", v)) <= 15 else (False, "Telefonnummer ska ha 8–15 siffror.")


def ask(label, default="", req=False, norm=None, val=None):
    while True:
        suffix = f" [{_cyan(default)}]" if default else ""
        try:
            raw = input(f"{label}{suffix}: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            raise KeyboardInterrupt
        value = raw if raw else default
        if norm:
            value = norm(value)
        if req and not value:
            print(_red("  → Obligatoriskt fält."))
            continue
        if val:
            ok, msg = val(value)
            if not ok:
                print(_red(f"  → {msg}"))
                continue
        return value


def yesno(label, dflt=True):
    suffix = f" [{_cyan('Y/n')}]" if dflt else f" [{_cyan('y/N')}]"
    while True:
        try:
            value = input(f"{label}{suffix}: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print()
            raise KeyboardInterrupt
        if not value:
            return dflt
        if value in ("y", "yes", "j", "ja"):
            return True
        if value in ("n", "no", "nej"):
            return False


def choose(label: str, options: List[Dict[str, str]], key: str = "name",
           detail_key: str = "detail") -> Optional[Dict[str, str]]:
    """Present a numbered list and let the user pick one.

    Shows 'key' as the main label and 'detail_key' as secondary info.
    Keys starting with '_' are hidden from display.
    """
    if not options:
        return None
    if len(options) == 1:
        detail = options[0].get(detail_key, "")
        suffix = f"  {_dim(detail)}" if detail else ""
        print(f"  {_green('→')} Enda träffen: {_bold(options[0].get(key, '?'))}{suffix}")
        return options[0]
    print(f"\n{label}")
    for i, opt in enumerate(options, 1):
        display = opt.get(key, "?")
        detail = opt.get(detail_key, "")
        line = f"  {_bold(str(i))}. {display}"
        if detail:
            line += f"  {_dim(detail)}"
        print(line)
    while True:
        try:
            raw = input(f"  Välj (1-{len(options)}) [1]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            raise KeyboardInterrupt
        if not raw:
            return options[0]
        try:
            idx = int(raw) - 1
            if 0 <= idx < len(options):
                return options[idx]
        except ValueError:
            pass
        print(_red(f"  → Ange ett nummer 1–{len(options)}."))


# -- Payload builders ----------------------------------------------------------

def _rn(f):
    name = f.get("name", "").strip()
    return name or " ".join(x for x in [f.get("firstName", ""), f.get("lastName", "")] if x.strip()).strip()


def build_flyttio(f):
    return {
        k: (f.get(k, "") or "").strip()
        for k in (
            "firstName", "lastName", "personalNumber", "email",
            "fromStreet", "fromPostal", "fromCity",
            "toStreet", "toPostal", "toCity",
            "apartmentNumber", "propertyDesignation", "propertyOwner", "moveDate",
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


# -- Contact cache -------------------------------------------------------------

def make_cache(script_dir: Path) -> Path:
    return script_dir / ".contact_cache.json"


CACHE_TTL_HOURS = 48
_CACHE_FIELDS = ("phone", "email", "fromPostal", "fromStreet", "fromCity", "fastighet")


def _load_cache(path: Path) -> Dict[str, Dict[str, str]]:
    try:
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except Exception:
        return {}


def _save_cache(path: Path, cache: Dict[str, Dict[str, str]]):
    try:
        path.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except Exception:
        pass


def cache_get(cache_path: Path, key: str) -> Dict[str, str]:
    return _load_cache(cache_path).get(key, {})


def cache_is_fresh(entry: Dict[str, str], max_hours: float = CACHE_TTL_HOURS) -> bool:
    ts = entry.get("updated", "")
    if not ts:
        return False
    try:
        updated = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - updated
        return age.total_seconds() < max_hours * 3600
    except Exception:
        return False


def cache_put(cache_path: Path, key: str, data: Dict[str, str]):
    values = {k: v.strip() for k, v in data.items() if k in _CACHE_FIELDS and v and v.strip()}
    if not values:
        return
    cache = _load_cache(cache_path)
    entry = cache.get(key, {})
    entry.update(values)
    entry["updated"] = _utc_now_iso()
    cache[key] = entry
    _save_cache(cache_path, cache)


# -- Ratsit scraper (via rats_meri_docker_scraper REST API) --------------------

RATSIT_SCRAPER_URL = os.environ.get("RATSIT_SCRAPER_URL", "http://localhost:8766")
ENRICH_API_SECRET = os.environ.get("ENRICH_API_SECRET", "")


def ratsit_search(
    fornamn: str = "",
    efternamn: str = "",
    stad: str = "",
    pnr: str = "",
    kon: str = "",
    scraper_url: str = "",
    api_secret: str = "",
) -> Dict[str, Any]:
    """Search for a person via the rats_meri_docker_scraper /search endpoint.

    Returns {"hits": [...], "totalCount": N, "strategy": "..."} or empty on failure.
    """
    url = (scraper_url or RATSIT_SCRAPER_URL).rstrip("/") + "/search"
    secret = api_secret or ENRICH_API_SECRET

    body: Dict[str, str] = {}
    if fornamn:
        body["fornamn"] = fornamn
    if efternamn:
        body["efternamn"] = efternamn
    if stad:
        body["stad"] = stad
    if pnr:
        body["pnr"] = pnr
    if kon:
        body["kon"] = kon
    if not body:
        return {"hits": [], "totalCount": 0}

    payload = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": _ua()}
    if secret:
        headers["x-api-key"] = secret

    req = Request(url, data=payload, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        return data
    except Exception as e:
        print(_dim(f"  Ratsit-scraper ({url}): {e}"))
        return {"hits": [], "totalCount": 0, "error": str(e)}


def ratsit_lookup(
    pnr: str,
    scraper_url: str = "",
    api_secret: str = "",
) -> Optional[Dict[str, Any]]:
    """Lookup a single person by PNR via /lookup endpoint."""
    url = (scraper_url or RATSIT_SCRAPER_URL).rstrip("/") + "/lookup"
    secret = api_secret or ENRICH_API_SECRET

    payload = json.dumps({"pnr": pnr}).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": _ua()}
    if secret:
        headers["x-api-key"] = secret

    req = Request(url, data=payload, headers=headers, method="POST")
    try:
        with urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        return data if not data.get("error") else None
    except Exception:
        return None
