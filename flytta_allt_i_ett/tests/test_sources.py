#!/usr/bin/env python3
"""
Källtest — verifiera att alla datakällor svarar och ger vad de ska.

Testar:
  1. Ratsit /health + /lookup PNR
  2. Ratsit /search namn
  3. Biluppgifter PNR → namn + adress
  4. PAP API postnr → ort
  5. Eniro namnsök → JSON-LD (telefon, fastighet)

Kör:
    python test_sources.py              # kör alla
    python test_sources.py --only pnr   # bara PNR-kedjan
    python test_sources.py --only name  # bara namnsökning
    python test_sources.py --pnr 19860528-0299
    python test_sources.py --namn "Jakob Eberg"
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared import (
    _bold, _dim, _green, _red, _yellow,
    RATSIT_SCRAPER_URL, ENRICH_API_SECRET,
    biluppgifter_lookup, eniro_person_list, format_pnr,
    normalize_pnr, pap, ratsit_lookup, ratsit_search,
)

SEPARATOR = "─" * 56
PAP_KEY = os.environ.get("PAP_API_KEY", "")
TEST_PNR = "19860528-0299"        # Jakob Eberg
TEST_NAMN = "Jakob Eberg"
TEST_POSTNR = "11827"             # Stockholm, Folkungagatan


def header(title: str):
    print(f"\n{SEPARATOR}")
    print(_bold(f"  {title}"))
    print(SEPARATOR)


def ok(msg: str):
    print(_green(f"  ✓ {msg}"))


def fail(msg: str):
    print(_red(f"  ✗ {msg}"))


def warn(msg: str):
    print(_yellow(f"  ! {msg}"))


def info(msg: str):
    print(_dim(f"  {msg}"))


# ── 1. Ratsit health ──────────────────────────────────────────────────────────

def test_ratsit_health() -> bool:
    header("1. Ratsit-scraper — health")
    info(f"URL: {RATSIT_SCRAPER_URL}")
    info(f"Secret: {'✓ satt' if ENRICH_API_SECRET else '(ej satt)'}")
    url = RATSIT_SCRAPER_URL.rstrip("/") + "/health"
    try:
        with urlopen(Request(url, headers={"User-Agent": "test"}), timeout=8) as r:
            d = json.loads(r.read())
        if d.get("ok"):
            ok(f"Scraper OK: {d.get('service')} v{d.get('version')}")
            return True
        fail(f"ok=false: {d}")
        return False
    except Exception as e:
        fail(str(e))
        info("Tips: RATSIT_SCRAPER_URL i .env.local → Render-URL:en")
        return False


# ── 2. Ratsit /lookup (PNR) ───────────────────────────────────────────────────

def test_ratsit_lookup(pnr: str) -> bool:
    header(f"2. Ratsit /lookup — PNR: {pnr}")
    try:
        d = ratsit_lookup(pnr)
        if not d:
            fail("Ingen träff / fel svar")
            return False
        ok(f"Namn:    {d.get('name')}")
        ok(f"Adress:  {d.get('address')}")
        ok(f"PNR:     {d.get('personnummer')}")
        if d.get("medboende"):
            ok(f"Medboende: {len(d['medboende'])} st")
        if d.get("fordonAdress"):
            ok(f"Fordon:  {len(d['fordonAdress'])} st")
        if d.get("snittLonGata"):
            ok(f"Snittlön: {d['snittLonGata']:,} kr".replace(",", " "))
        return True
    except Exception as e:
        fail(str(e))
        return False


# ── 3. Ratsit /search (namn) ──────────────────────────────────────────────────

def test_ratsit_search(namn: str) -> bool:
    header(f"3. Ratsit /search — namn: '{namn}'")
    parts = namn.split()
    fornamn = " ".join(parts[:-1]) if len(parts) > 1 else ""
    efternamn = parts[-1] if parts else ""
    try:
        result = ratsit_search(fornamn=namn)
        hits = result.get("hits", [])
        total = result.get("totalCount", 0)
        if result.get("error"):
            fail(f"Scraper-fel: {result['error']}")
            return False
        ok(f"{len(hits)} träffar (totalt {total})")
        for i, h in enumerate(hits[:3], 1):
            pnr_tag = _green("PNR ✓") if h.get("personnummer") else _yellow("PNR ?")
            print(f"    {i}. {h.get('name')} ({h.get('age')} år, {h.get('city')}) [{pnr_tag}]")
            if h.get("personnummer"):
                print(f"       PNR: {h['personnummer']}")
        return len(hits) > 0
    except Exception as e:
        fail(str(e))
        return False


# ── 4. Biluppgifter (PNR → namn + adress) ─────────────────────────────────────

def test_biluppgifter(pnr: str) -> bool:
    header(f"4. Biluppgifter.se — PNR: {pnr}")
    info("Scrape via Playwright/curl_cffi. Kan ta 10-20s.")
    try:
        d = biluppgifter_lookup(normalize_pnr(pnr))
        if not d:
            warn("Ingen träff (skyddat/saknas)")
            return False
        ok(f"Namn:     {d.get('name')}")
        ok(f"Stad:     {d.get('fromCity')}")
        if d.get("fromStreetRaw"):
            ok(f"Adress:   {d.get('fromStreetRaw')}")
        if d.get("age"):
            ok(f"Ålder:    {d.get('age')}")
        return True
    except Exception as e:
        fail(str(e))
        return False


# ── 5. PAP API (postnr → ort) ─────────────────────────────────────────────────

def test_pap(postnr: str) -> bool:
    header(f"5. PAP API — postnr: {postnr}")
    if not PAP_KEY:
        warn("PAP_API_KEY ej satt — hoppar över")
        return False
    try:
        d = pap(postnr, PAP_KEY)
        if not d:
            fail("Ingen träff")
            return False
        ok(f"Ort:     {d.get('city')}")
        ok(f"Kommun:  {d.get('mun')}")
        return True
    except Exception as e:
        fail(str(e))
        return False


# ── 6. Eniro JSON-LD (namn → telefon/fastighet) ───────────────────────────────

def test_eniro(namn: str) -> bool:
    header(f"6. Eniro JSON-LD — namn: '{namn}'")
    info("Playwright-sökning. Kan ta 20-40s.")
    try:
        hits = eniro_person_list(namn, "", mx=3)
        if not hits:
            warn("Inga träffar (normal för de flesta namn)")
            return False
        for i, h in enumerate(hits[:3], 1):
            has_ld = any(h.get(k) for k in ("telephone", "fastighet", "postal", "birthDate"))
            ld_tag = _green("JSON-LD ✓") if has_ld else _yellow("JSON-LD tom")
            print(f"    {i}. {h.get('name')} ({h.get('city')}) [{ld_tag}]")
            if h.get("telephone"):
                ok(f"   Telefon: {h['telephone']}")
            if h.get("postal"):
                ok(f"   Postnr:  {h['postal']}")
            if h.get("fastighet"):
                ok(f"   Fastigh: {h['fastighet']}")
            if h.get("birthDate"):
                ok(f"   Född:    {h['birthDate']}")
        return True
    except Exception as e:
        fail(str(e))
        return False


# ── Kedjetest: bilregistret → allt ────────────────────────────────────────────

def test_full_chain_from_pnr(pnr: str):
    """
    Simulerar hela kedjan:
      PNR → Biluppgifter (namn) → Ratsit lookup (adress, medboende, fordon) → PAP (ort)
    """
    header(f"KEDJETEST: PNR → alla källor")
    info(f"Ingångsvärde: {pnr}")

    results: Dict[str, Any] = {"pnr": pnr}

    # Steg 1: Biluppgifter
    print(f"\n  {_bold('[1]')} Biluppgifter")
    try:
        bil = biluppgifter_lookup(normalize_pnr(pnr))
        if bil:
            results["namn"] = bil["name"]
            results["stad"] = bil.get("fromCity")
            results["adress"] = bil.get("fromStreetRaw")
            ok(f"{bil['name']} — {bil.get('fromCity')}")
        else:
            warn("Biluppgifter: ingen träff")
    except Exception as e:
        fail(f"Biluppgifter: {e}")

    # Steg 2: Ratsit /lookup (ger medboende, fordon, mm)
    print(f"\n  {_bold('[2]')} Ratsit /lookup")
    try:
        rl = ratsit_lookup(pnr)
        if rl:
            results["ratsit"] = rl
            ok(f"Namn: {rl.get('name')}, Adress: {rl.get('address')}")
            if rl.get("medboende"):
                ok(f"Medboende: {[m.get('name') for m in rl['medboende'][:3]]}")
            if rl.get("fordonAdress"):
                ok(f"Fordon: {[v.get('make','?') for v in rl['fordonAdress'][:3]]}")
        else:
            warn("Ratsit: ingen träff")
    except Exception as e:
        fail(f"Ratsit: {e}")

    # Steg 3: PAP
    if results.get("adress") and PAP_KEY:
        print(f"\n  {_bold('[3]')} PAP")
        pm = re.search(r"\b(\d{3}\s?\d{2})\b", results.get("adress", ""))
        postnr = re.sub(r"\s", "", pm.group(1)) if pm else ""
        if postnr:
            try:
                p = pap(postnr, PAP_KEY)
                if p:
                    results["ort"] = p["city"]
                    ok(f"Ort: {p['city']}, Kommun: {p['mun']}")
            except Exception as e:
                fail(f"PAP: {e}")

    print(f"\n  {_bold('Samlat resultat:')}")
    print(json.dumps({k: v for k, v in results.items() if k != "ratsit"},
                     indent=2, ensure_ascii=False))
    return results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Testa alla datakällor.")
    p.add_argument("--only", choices=["pnr", "name", "health", "pap", "bil", "eniro"],
                   help="Kör bara specifikt test")
    p.add_argument("--pnr", default=TEST_PNR, help=f"PNR att testa (default: {TEST_PNR})")
    p.add_argument("--namn", default=TEST_NAMN, help=f"Namn att testa (default: '{TEST_NAMN}')")
    p.add_argument("--postnr", default=TEST_POSTNR, help=f"Postnr att testa (default: {TEST_POSTNR})")
    p.add_argument("--chain", action="store_true", help="Kör fullständigt kedjetest PNR → alla")
    a = p.parse_args()

    print(_bold("\nKälltest — flytta_allt_i_ett\n"))

    results = {}

    if a.chain:
        test_full_chain_from_pnr(a.pnr)
        return 0

    only = a.only
    ok_count = fail_count = 0

    tests = [
        ("health",  lambda: test_ratsit_health()),
        ("pnr",     lambda: test_ratsit_lookup(a.pnr)),
        ("name",    lambda: test_ratsit_search(a.namn)),
        ("bil",     lambda: test_biluppgifter(a.pnr)),
        ("pap",     lambda: test_pap(a.postnr)),
        ("eniro",   lambda: test_eniro(a.namn)),
    ]

    for key, fn in tests:
        if only and key != only:
            continue
        try:
            passed = fn()
        except KeyboardInterrupt:
            print(_yellow("\n\nAvbrutet."))
            return 130
        (ok_count if passed else fail_count).__class__   # just for scoping
        if passed:
            ok_count += 1
        else:
            fail_count += 1

    print(f"\n{SEPARATOR}")
    total = ok_count + fail_count
    if fail_count == 0:
        print(_green(f"  ✓ Alla {total} tester OK"))
    else:
        print(_yellow(f"  {ok_count}/{total} tester OK, {fail_count} misslyckades"))
    print(SEPARATOR)
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
