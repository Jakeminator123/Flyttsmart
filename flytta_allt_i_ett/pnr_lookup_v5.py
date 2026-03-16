#!/usr/bin/env python3
"""
PNR lookup v5 — maximal auto-ifyllning fran bara personnummer.

Flode:
  1. PNR → Biluppgifter.se  (namn, stad, raadress inkl. lgh-nr + postnr)
  2. Namn+stad → Eniro person (telefon, fastighetsbeteckning, postnr, adress, fodelsedatum)
  3. Postnr → PAP API (ort, kommun, lan)
  4. Manuellt: ny adress, flyttdatum, e-post + ovriga SKV-falt
  5. Bygg slutpayload for flyttblanketten

Kor:
    python pnr_lookup_v5.py 19860324XXXX
    python pnr_lookup_v5.py --pap-api-key <KEY> --eniro-api-key <KEY>
"""
from __future__ import annotations

import argparse, asyncio, base64, importlib, json, os, random, re, time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlencode
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

# ── Constants ────────────────────────────────────────────────────────────────

BILUPPGIFTER = "https://biluppgifter.se"
ENIRO = "https://www.eniro.se"
ENIRO_API = "https://api.eniro.com/cs/search/basic"
PAP_API = "https://api.papapi.se/lite/"
BLOCKED = ("Just a moment", "Checking your browser", "Attention Required",
           "Enable JavaScript and cookies", "cf-browser-verification", "cloudflare")
NOT_FOUND = ("Kunde inte hitta brukaren", "hittar inte den sida", "Ooups")
UA = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
]
BLOCK_RES = ["**/*.{png,jpg,jpeg,gif,svg,ico,webp,avif}", "**/*.{css,woff,woff2,ttf,eot}",
             "**/api.pirsch.io/**", "**/fonts.googleapis.com/**", "**/fonts.gstatic.com/**",
             "**/www.googletagmanager.com/**", "**/www.google-analytics.com/**"]

def _ua(): return random.choice(UA)
def _jit(s: float): return max(0.2, s * (0.6 + random.random() * 0.8))
def _npostal(v: str): return re.sub(r"\s+", "", v or "")
def _nphone(v: str): return re.sub(r"[^\d+]", "", v or "")
def _nemail(v: str): return (v or "").strip().lower()

# ── PNR ──────────────────────────────────────────────────────────────────────

def _luhn(nine: str) -> int:
    t = 0
    for i, c in enumerate(nine):
        n = int(c); n = n * 2 if i % 2 == 0 else n; n = n - 9 if n > 9 else n; t += n
    return (10 - t % 10) % 10

def normalize_pnr(raw: str) -> str:
    raw = raw.strip(); d = re.sub(r"\D", "", raw)
    sep = next((c for c in raw if c in "-+"), "+")
    if len(d) == 12: norm = d
    elif len(d) == 10:
        yy = int(d[:2]); now = datetime.now(); cy = now.year % 100; cen = now.year // 100
        fy = (cen - 1) * 100 + yy if sep == "+" else (cen * 100 + yy - (100 if yy > cy else 0))
        norm = f"{fy:04d}{d[2:]}"
    else: raise ValueError("PNR: 10 eller 12 siffror kravs.")
    try: datetime.strptime(norm[:8], "%Y%m%d")
    except ValueError as e: raise ValueError("PNR: ogiltigt datum.") from e
    if _luhn(norm[2:11]) != int(norm[11]): raise ValueError("PNR: fel kontrollsiffra.")
    return norm

def split_name(n: str) -> Tuple[str, str]:
    p = [x for x in n.split() if x]
    return ("", "") if not p else (p[0], "") if len(p) == 1 else (" ".join(p[:-1]), p[-1])

# ── Biluppgifter ─────────────────────────────────────────────────────────────

def _bil_url(pnr: str) -> str:
    return f"{BILUPPGIFTER}/brukare/{base64.b64encode(pnr.encode()).decode()}/"

def _is_blocked(code: int, html: str) -> bool:
    return code >= 400 or any(b.lower() in html.lower() for b in BLOCKED)

def _fetch_cffi(url: str) -> Optional[str]:
    try:
        r = importlib.import_module("curl_cffi.requests")
    except ImportError: return None
    resp = r.get(url, impersonate="chrome124", headers={"User-Agent": _ua()}, timeout=25)
    return None if _is_blocked(resp.status_code, resp.text) else resp.text

def _fetch_pw_sync(url: str) -> str:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        br = pw.chromium.launch(headless=True)
        ctx = br.new_context(user_agent=_ua(), locale="sv-SE")
        pg = ctx.new_page()
        for p in BLOCK_RES: pg.route(p, lambda r: r.abort())
        resp = pg.goto(url, wait_until="domcontentloaded", timeout=25000)
        if not resp or resp.status >= 400: raise RuntimeError(f"HTTP {getattr(resp,'status','?')}")
        pg.wait_for_timeout(1200); html = pg.content(); br.close(); return html

def fetch_html(url: str) -> str:
    h = _fetch_cffi(url)
    return h if h else _fetch_pw_sync(url)

def biluppgifter_lookup(pnr: str) -> Optional[Dict[str, Any]]:
    html = fetch_html(_bil_url(pnr))
    soup = BeautifulSoup(html, "lxml"); text = soup.get_text(" ", True)
    if any(p in text for p in NOT_FOUND): return None
    m = re.search(r"Visa\s+(.+?)\s+(?:pa|på)\s+Ratsit", text)
    name = m.group(1).strip() if m else ""
    if not name:
        fb = re.search(r"([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-\s]{2,50}),\s+en\s+privatperson", text)
        name = fb.group(1).strip() if fb else ""
    if not name: return None
    fn, ln = split_name(name)
    age_m = re.search(r"(\d{1,3})\s+(?:ar|år)", text)
    city_m = re.search(r"bor\s+i\s+([A-ZÅÄÖ][a-zåäö]+(?:[\s-][A-ZÅÄÖ][a-zåäö]+)?)", text)
    addr_m = re.search(r"\bAdress\s+([^\n\r,]{3,80})", text)
    addr = re.split(r"\s{2,}|Kontakt|Telefon|Fordon|Visa\s", addr_m.group(1).strip())[0].strip() if addr_m else ""
    return {"pnr": pnr, "firstName": fn, "lastName": ln, "name": name,
            "fromCity": city_m.group(1).strip() if city_m else "",
            "fromStreetRaw": addr, "age": int(age_m.group(1)) if age_m else None}

# ── Address parsing (extracts lgh from raw string) ───────────────────────────

def parse_address(raw: str) -> Dict[str, str]:
    c = " ".join((raw or "").split())
    out: Dict[str, str] = {"street": "", "postal": "", "city": "", "apt": ""}
    if not c: return out
    lgh = re.search(r"\blgh\s+(\d{4})\b", c, re.I)
    if lgh: out["apt"] = lgh.group(1); c = c[:lgh.start()].strip().rstrip(",")
    full = re.search(r"^(?P<s>.+?)[,\s]+(?P<p>\d{3}\s?\d{2})\s+(?P<c>[A-Za-zÅÄÖåäö\-\s]+)$", c)
    if full:
        out["street"] = full.group("s").strip(); out["postal"] = _npostal(full.group("p")); out["city"] = full.group("c").strip()
        return out
    parts = [p.strip() for p in c.split(",") if p.strip()]
    if parts: out["street"] = parts[0]
    pm = re.search(r"\b(\d{3}\s?\d{2})\b", c)
    if pm: out["postal"] = _npostal(pm.group(1))
    cm = re.search(r"\b\d{3}\s?\d{2}\s+([A-Za-zÅÄÖåäö\-\s]+)$", c)
    if cm: out["city"] = cm.group(1).strip()
    return out

# ── Eniro Person (Playwright async) ─────────────────────────────────────────

async def _ecf(page, t: int = 20) -> bool:
    dl = time.time() + t
    while time.time() < dl:
        ti = await page.title()
        if ti and "Vänta" not in ti and "Just a moment" not in ti: return True
        await page.wait_for_timeout(400)
    return False

async def _ecookies(page):
    try:
        b = page.locator("button", has_text="GODKÄNN"); await b.wait_for(timeout=3000); await b.click(); await page.wait_for_timeout(300)
    except: pass

def _jsonld_person(html: str) -> Dict[str, Any]:
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            d = json.loads(raw.strip())
            for item in d.get("@graph", [d]):
                if item.get("@type") == "Person": return item
        except: pass
    return {}

def _vis_fastighet(html: str) -> str:
    text = BeautifulSoup(html, "lxml").get_text(" ", True)
    for m in re.finditer(r"\b([A-ZÅÄÖ][A-ZÅÄÖa-zåäö\s\-]+\d+:\d+)\b", text):
        c = m.group(1).strip()
        if 4 <= len(c) <= 60 and not any(s in c.lower() for s in ("visa ", "http", "sida")): return c
    return ""

async def _eniro_search(br, name: str, city: str = "", mx: int = 5) -> List[Dict[str, str]]:
    slug = quote_plus(f"{name} {city}".strip() if city else name)
    url = f"{ENIRO}/{slug}/personer"
    out: List[Dict[str, str]] = []
    ctx = await br.new_context(user_agent=_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
    pg = await ctx.new_page()
    try:
        await pg.goto(url, wait_until="domcontentloaded", timeout=25000)
        if not await _ecf(pg): return []
        await _ecookies(pg); await pg.wait_for_timeout(500)
        seen: set[str] = set()
        for lnk in await pg.locator("a[href*='/person']").all():
            href = await lnk.get_attribute("href")
            pid = re.search(r"/(\d{6,12})/person", href or "")
            if pid and pid.group(1) not in seen:
                seen.add(pid.group(1))
                full = f"{ENIRO}{href}" if (href or "").startswith("/") else (href or "")
                out.append({"id": pid.group(1), "url": full})
            if len(out) >= mx: break
    except: pass
    finally: await ctx.close()
    return out

async def _eniro_page(br, url: str) -> Optional[Dict[str, str]]:
    ctx = await br.new_context(user_agent=_ua(), locale="sv-SE", viewport={"width": 1366, "height": 768})
    pg = await ctx.new_page()
    try:
        await pg.goto(url, wait_until="domcontentloaded", timeout=25000)
        if not await _ecf(pg): return None
        await _ecookies(pg); await pg.wait_for_timeout(300)
        html = await pg.content()
        p = _jsonld_person(html)
        if not p.get("name"): return None
        a = p.get("address", {})
        return {
            "name": p.get("name", ""), "givenName": p.get("givenName", ""),
            "familyName": p.get("familyName", ""), "birthDate": p.get("birthDate", ""),
            "telephone": p.get("telephone", ""),
            "street": a.get("streetAddress", ""), "postal": a.get("postalCode", ""),
            "city": a.get("addressLocality", ""),
            "fastighet": _vis_fastighet(html), "url": url,
        }
    except: return None
    finally: await ctx.close()

async def _eniro_resolve(name: str, city: str = "", street: str = "") -> Optional[Dict[str, str]]:
    """Resolve person via Eniro. Uses street for disambiguation when many hits."""
    try: from playwright.async_api import async_playwright
    except ImportError: return None
    async with async_playwright() as pw:
        br = await pw.chromium.launch(headless=True)
        try:
            persons = await _eniro_search(br, name, city)
            if not persons and city:
                persons = await _eniro_search(br, name, "")
            if not persons: return None

            target_name = set(name.lower().split())
            street_words = set(re.sub(r"\d+\w*", "", street.lower()).split()) - {"lgh", ""}
            best: Optional[Dict[str, str]] = None

            for p in persons:
                await asyncio.sleep(_jit(0.5))
                data = await _eniro_page(br, p["url"])
                if not data: continue
                found_name = set(data["name"].lower().split())
                if not (target_name & found_name): continue

                if street_words:
                    eniro_street = re.sub(r"\d+\w*", "", data.get("street", "").lower())
                    if street_words & set(eniro_street.split()):
                        return data
                    if not best:
                        best = data
                else:
                    return data

            return best
        finally: await br.close()

def eniro_person(name: str, city: str = "", street: str = "") -> Optional[Dict[str, str]]:
    if not name.strip(): return None
    try: return asyncio.run(_eniro_resolve(name, city, street))
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            try:
                import nest_asyncio; nest_asyncio.apply()
                return asyncio.run(_eniro_resolve(name, city, street))
            except: return None
        return None
    except: return None

# ── Eniro Company (REST) ─────────────────────────────────────────────────────

def eniro_company(street: str, city: str, key: str) -> List[Dict[str, str]]:
    if not key.strip() or not street.strip(): return []
    sn = re.split(r"\d", street)[0].strip()
    if not sn or len(sn) < 3: sn = street.strip()
    params = urlencode({"profile": "APIGW", "key": key.strip(), "country": "se",
                        "search_word": sn, **({"geo_area": city} if city else {})})
    req = Request(f"{ENIRO_API}?{params}", headers={"User-Agent": _ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=6) as r: data = json.loads(r.read().decode())
        ads = data.get("adverts")
        if not isinstance(ads, list): return []
        return [{"name": str(a.get("companyName","")).strip(), "addr": str(a.get("address","")).strip(),
                 "phone": str(a.get("phoneNumber","")).strip(), "city": str(a.get("city","")).strip()}
                for a in ads[:5] if a.get("companyName")]
    except: return []

def guess_owner(companies: List[Dict[str, str]], street: str) -> str:
    kw = ("bostads", "fastighet", "hyres", "brf", "bostad", "hemfosa", "stena", "rikshem", "vasakrona")
    sl = street.lower()
    for c in companies:
        n = c.get("name", "")
        if any(k in n.lower() for k in kw): return f"{n} {c.get('phone','')}".strip()
        if any(w in c.get("addr","").lower() for w in sl.split()[:2]): return f"{n} {c.get('phone','')}".strip()
    return ""

# ── PAP ──────────────────────────────────────────────────────────────────────

def pap(postal: str, key: str) -> Optional[Dict[str, str]]:
    cl = _npostal(postal)
    if not re.fullmatch(r"\d{5}", cl) or not key.strip(): return None
    params = urlencode({"query": cl, "format": "json", "apikey": key.strip()})
    req = Request(f"{PAP_API}?{params}", headers={"User-Agent": _ua(), "Accept": "application/json"})
    try:
        with urlopen(req, timeout=8) as r: data = json.loads(r.read().decode())
        item = (data.get("results") or [None])[0]
        return {"postal": cl, "city": str(item["city"]).strip(), "mun": str(item.get("county","")).strip()} if item and item.get("city") else None
    except: return None

# ── Validators + interactive ─────────────────────────────────────────────────

def _vdate(v):
    if not v: return False, "Datum kravs."
    try: datetime.strptime(v, "%Y-%m-%d"); return True, ""
    except: return False, "Format: YYYY-MM-DD."
def _vpostal_r(v): return (True, "") if re.fullmatch(r"\d{5}", _npostal(v)) else (False, "5 siffror.")
def _vpostal_o(v): return (True, "") if not v else _vpostal_r(v)
def _vemail(v):
    if not v: return True, ""
    return (True, "") if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", v) else (False, "Ogiltig.")
def _vphone(v):
    if not v: return True, ""
    return (True, "") if 8 <= len(re.sub(r"\D", "", v)) <= 15 else (False, "8-15 siffror.")

def ask(label, default="", req=False, norm=None, val=None):
    while True:
        sfx = f" [{default}]" if default else ""
        raw = input(f"{label}{sfx}: ").strip()
        v = raw if raw else default
        if norm: v = norm(v)
        if req and not v: print("  -> Obligatoriskt."); continue
        if val:
            ok, msg = val(v)
            if not ok: print(f"  -> {msg}"); continue
        return v

def yesno(label, dflt=True):
    sfx = " [Y/n]" if dflt else " [y/N]"
    while True:
        v = input(f"{label}{sfx}: ").strip().lower()
        if not v: return dflt
        if v in ("y","yes","j","ja"): return True
        if v in ("n","no","nej"): return False

# ── Payload builders ─────────────────────────────────────────────────────────

def _rn(f):
    n = f.get("name","").strip()
    return n or " ".join(x for x in [f.get("firstName",""), f.get("lastName","")] if x.strip()).strip()

def build_flyttio(f):
    return {k: (f.get(k,"") or "").strip() for k in
            ("firstName","lastName","personalNumber","email","fromStreet","fromPostal","fromCity",
             "toStreet","toPostal","toCity","apartmentNumber","propertyDesignation","propertyOwner","moveDate")} | {
            "name": _rn(f), "phone": _nphone(f.get("phone","")),}

def build_skv(f):
    return {
        "inflyttningsdatum": f.get("moveDate","").strip(),
        "period": f.get("period","true").strip() or "true",
        "gatuadress": f.get("toStreet","").strip(),
        "postnummer": _npostal(f.get("toPostal","")),
        "postort": f.get("toCity","").strip(),
        "lagenhetsnummer": f.get("apartmentNumber","").strip(),
        "fastighetsbeteckning": f.get("propertyDesignation","").strip(),
        "fastighetsagare": f.get("propertyOwner","").strip(),
        "telefonnummer": _nphone(f.get("phone","")),
        "email": _nemail(f.get("email","")),
        "name": _rn(f), "personalNumber": f.get("personalNumber","").strip(),
    }

def missing_req(skv):
    return [k for k in ("inflyttningsdatum","period","gatuadress","postnummer","postort") if not skv.get(k,"").strip()]

# ── Contact cache (stores phone/email per PNR between runs) ──────────────────

CACHE_FILE = Path(__file__).resolve().parent / ".contact_cache.json"

def _load_cache() -> Dict[str, Dict[str, str]]:
    try: return json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() else {}
    except: return {}

def _save_cache(cache: Dict[str, Dict[str, str]]):
    try: CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except: pass

def _cache_get(pnr: str) -> Dict[str, str]:
    return _load_cache().get(pnr, {})

def _cache_put(pnr: str, phone: str = "", email: str = ""):
    if not phone and not email: return
    cache = _load_cache()
    entry = cache.get(pnr, {})
    if phone: entry["phone"] = phone
    if email: entry["email"] = email
    entry["updated"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    cache[pnr] = entry
    _save_cache(cache)

# ── Wizard ───────────────────────────────────────────────────────────────────

def run(raw_pnr: str, pap_key: str, eniro_key: str, skip_eniro: bool = False):
    pnr = normalize_pnr(raw_pnr)
    lk: Dict[str, Any] = {"bil": None, "bilErr": None, "eniro": None, "eniroErr": None,
                           "eniroCo": None, "papFrom": None, "papTo": None}
    f: Dict[str, str] = {k: "" for k in (
        "personalNumber","firstName","lastName","name","fromStreet","fromPostal","fromCity",
        "toStreet","toPostal","toCity","moveDate","apartmentNumber",
        "propertyDesignation","propertyOwner","phone","email","period")}
    f["personalNumber"] = pnr; f["period"] = "true"
    cached = _cache_get(pnr)
    if cached.get("phone"): f["phone"] = cached["phone"]
    if cached.get("email"): f["email"] = cached["email"]
    if cached: print(f"  (Cache: {', '.join(f'{k}={v}' for k,v in cached.items() if k != 'updated' and v)})")

    # ── 1: Biluppgifter ──────────────────────────────────────────────
    print("\n[1/5] Biluppgifter.se — PNR-uppslag")
    try:
        person = biluppgifter_lookup(pnr); lk["bil"] = person
        if person:
            f["firstName"] = person.get("firstName",""); f["lastName"] = person.get("lastName","")
            f["name"] = person.get("name",""); f["fromCity"] = person.get("fromCity","")
            addr = parse_address(person.get("fromStreetRaw",""))
            f["fromStreet"] = addr["street"]; f["fromPostal"] = addr["postal"]
            if addr["city"]: f["fromCity"] = addr["city"]
            if addr["apt"]: f["apartmentNumber"] = addr["apt"]
            print(f"  OK: {person['name']} ({person.get('fromCity','?')})")
            if addr["apt"]: print(f"  Lgh-nr: {addr['apt']}")
        else:
            print("  Ingen traff.")
    except Exception as e:
        lk["bilErr"] = str(e); print(f"  Fel: {e}")

    # ── 2: Eniro person ──────────────────────────────────────────────
    if not skip_eniro and f["name"]:
        print(f"\n[2/5] Eniro — person-berikning")
        print(f"  Soker: {f['name']} {f['fromCity']}".strip())
        try:
            en = eniro_person(f["name"], f["fromCity"], f["fromStreet"]); lk["eniro"] = en
            if en:
                got = []
                if en.get("telephone"): f["phone"] = en["telephone"]; got.append(f"tel: {en['telephone']}")
                if en.get("fastighet"): got.append(f"fastighet: {en['fastighet']}")
                if en.get("postal") and not f["fromPostal"]: f["fromPostal"] = _npostal(en["postal"]); got.append(f"postnr: {en['postal']}")
                if en.get("street") and not f["fromStreet"]: f["fromStreet"] = en["street"]; got.append(f"adress: {en['street']}")
                if en.get("city") and not f["fromCity"]: f["fromCity"] = en["city"]; got.append(f"ort: {en['city']}")
                print(f"  -> {', '.join(got)}" if got else "  -> Person hittad men inga nya falt.")
            else:
                print("  -> Ingen traff (personen saknas i Eniro).")
        except Exception as e:
            lk["eniroErr"] = str(e); print(f"  -> Fel: {e}")
    elif skip_eniro: print("\n[2/5] Eniro — hoppas over (--skip-eniro)")
    else: print("\n[2/5] Eniro — hoppas over (inget namn)")

    # ── 2b: Eniro Company (fastighetsagare) ──────────────────────────
    if eniro_key and f["fromStreet"] and f["fromCity"]:
        print(f"\n[2b] Eniro foretagssok (fastighetsagare)")
        cos = eniro_company(f["fromStreet"], f["fromCity"], eniro_key); lk["eniroCo"] = cos
        ow = guess_owner(cos, f["fromStreet"])
        if ow: print(f"  -> Mojlig agare: {ow}")
        elif cos: print(f"  -> {len(cos)} foretag, ingen tydlig agare.")
        else: print("  -> Inga foretag hittades.")

    # ── 3: PAP ───────────────────────────────────────────────────────
    if pap_key and f["fromPostal"]:
        p = pap(f["fromPostal"], pap_key); lk["papFrom"] = p
        if p and p.get("city") and not f["fromCity"]: f["fromCity"] = p["city"]; print(f"  PAP: fromCity → {p['city']}")

    # ── 4: Bekrafta + manuella falt ──────────────────────────────────
    print("\n[3/5] Bekrafta identitet")
    f["firstName"] = ask("Fornamn", f["firstName"], req=True)
    f["lastName"] = ask("Efternamn", f["lastName"], req=True)
    f["name"] = f"{f['firstName']} {f['lastName']}".strip()
    f["fromStreet"] = ask("Nuvarande gatuadress", f["fromStreet"])
    f["fromPostal"] = ask("Nuvarande postnr", f["fromPostal"], norm=_npostal, val=_vpostal_o)
    if f["fromPostal"] and not f["fromCity"] and pap_key:
        p = pap(f["fromPostal"], pap_key)
        if p and p.get("city"): f["fromCity"] = p["city"]; print(f"  PAP: → {f['fromCity']}")
    f["fromCity"] = ask("Nuvarande ort", f["fromCity"])
    f["apartmentNumber"] = ask("Lagenhetsnummer (nuv.)", f["apartmentNumber"])

    print("\n[4/5] Ny adress + flytt")
    f["toStreet"] = ask("Ny gatuadress", f["toStreet"], req=True)
    while True:
        f["toPostal"] = ask("Nytt postnr", f["toPostal"], norm=_npostal, val=_vpostal_o)
        pt = pap(f["toPostal"], pap_key) if f["toPostal"] and pap_key else None
        if pt: lk["papTo"] = pt
        sug = f["toCity"] or (pt["city"] if pt and pt.get("city") else "")
        if pt and pt.get("city") and not f["toCity"]: print(f"  PAP: → {pt['city']}")
        f["toCity"] = ask("Ny ort", sug)
        if not f["toPostal"] and f["toCity"]:
            print("  Postnr kravs."); f["toPostal"] = ask("Nytt postnr", req=True, norm=_npostal, val=_vpostal_r)
        if not f["toCity"] and f["toPostal"]:
            pt = pap(f["toPostal"], pap_key) if pap_key else None
            if pt and pt.get("city"): f["toCity"] = pt["city"]; print(f"  PAP: → {f['toCity']}")
            else: f["toCity"] = ask("Ny ort", req=True)
        if f["toPostal"] and f["toCity"]: break
        print("  Bade postnr och ort behovs.")

    f["moveDate"] = ask("Inflyttningsdatum (YYYY-MM-DD)", f["moveDate"], req=True, val=_vdate)
    f["phone"] = ask("Telefonnummer", f["phone"], norm=_nphone, val=_vphone)
    f["email"] = ask("E-post", f["email"], norm=_nemail, val=_vemail)

    print("\n[5/5] Fastighetsuppgifter (nya adressen)")
    en_data = lk.get("eniro") or {}
    fh = en_data.get("fastighet", "")
    if fh: print(f"  Tips: Eniro hittade '{fh}' for nuvarande adress.")
    f["propertyDesignation"] = ask("Fastighetsbeteckning (ny adress)", f["propertyDesignation"])
    ow_hint = guess_owner(lk.get("eniroCo") or [], f.get("toStreet",""))
    if ow_hint: print(f"  Tips: '{ow_hint}' hittades nara nuvarande adress.")
    f["propertyOwner"] = ask("Fastighetsagare (t.ex. 'egen' eller hyresvard)", f["propertyOwner"])
    if not yesno("Period = 'Tills vidare'?"): f["period"] = "false"

    _cache_put(pnr, f.get("phone",""), f.get("email",""))

    flio = build_flyttio(f); skv = build_skv(f); miss = missing_req(skv)
    diag = []
    if not lk.get("eniro") and not skip_eniro: diag.append("Eniro: personen saknas i registret.")
    if not f.get("phone"): diag.append("Telefon: ingen kalla levererade det automatiskt.")
    if not f.get("email"): diag.append("E-post: kan aldrig hamtas automatiskt.")

    return {"generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "version": "v5", "status": "complete" if not miss else "partial",
            "lookups": lk, "flyttioPayload": flio, "skvPayload": skv,
            "requiredMissing": miss, "diagnostics": diag}

# ── Output ───────────────────────────────────────────────────────────────────

def show(r):
    s = r["skvPayload"]; en = (r.get("lookups") or {}).get("eniro") or {}
    print(f"\n{'='*60}\n  RESULTAT (v5)\n{'='*60}")
    print(f"  Status:     {r['status']}")
    print(f"  Namn:       {s.get('name','')}")
    print(f"  PNR:        {s.get('personalNumber','')}")
    print(f"  Ny adress:  {s.get('gatuadress','')}, {s.get('postnummer','')} {s.get('postort','')}")
    print(f"  Lgh-nr:     {s.get('lagenhetsnummer','') or '(ej)'}")
    print(f"  Datum:      {s.get('inflyttningsdatum','')}")
    print(f"  Telefon:    {s.get('telefonnummer','') or '(saknas)'}")
    print(f"  E-post:     {s.get('email','') or '(saknas)'}")
    print(f"  Fast.bet:   {s.get('fastighetsbeteckning','') or '(ej)'}")
    print(f"  Fast.agare: {s.get('fastighetsagare','') or '(ej)'}")
    if en:
        ex = [f"tel={en['telephone']}" if en.get("telephone") else None,
              f"fast={en['fastighet']}" if en.get("fastighet") else None]
        ex = [x for x in ex if x]
        if ex: print(f"\n  Eniro (nuv.adr): {', '.join(ex)}")
    if r.get("requiredMissing"): print(f"\n  SAKNAS: {', '.join(r['requiredMissing'])}")
    else: print("\n  Alla kravfalt OK.")
    if r.get("diagnostics"):
        for d in r["diagnostics"]: print(f"  ! {d}")
    print("=" * 60)

# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="PNR lookup v5 — maximal auto-ifyllning.")
    p.add_argument("personnummer", nargs="?", help="Personnummer (10/12 siffror).")
    p.add_argument("--pap-api-key", default="")
    p.add_argument("--eniro-api-key", default="")
    p.add_argument("--skip-eniro", action="store_true")
    p.add_argument("--out", default="")
    a = p.parse_args()
    print("Beroenden: pip install -r requirements.txt\nPlaywright: playwright install chromium\n")
    raw = a.personnummer or input("Ange personnummer: ").strip()
    if not raw: print("Inget PNR."); return 1
    pk = (a.pap_api_key or os.environ.get("PAP_API_KEY","")).strip()
    ek = (a.eniro_api_key or os.environ.get("ENIRO_API_KEY","")).strip()
    try: result = run(raw, pk, ek, a.skip_eniro)
    except Exception as e: print(f"Fel: {e}"); return 1
    out = Path(a.out).expanduser().resolve() if a.out else Path(__file__).resolve().parent / "pnr_lookup_v5_output.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    show(result); print(f"\nJSON: {out}"); return 0

if __name__ == "__main__": raise SystemExit(main())
