#!/usr/bin/env python3
"""
Snabbtest: verifiera att Ratsit-scrapern svarar och kan söka på namn.

Kör:
    python test_ratsit_search.py
    python test_ratsit_search.py "Anna Karlsson"
    python test_ratsit_search.py "Jakob" "Eberg"
    python test_ratsit_search.py --city Stockholm "Karlsson"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared import (
    _bold, _cyan, _dim, _green, _red, _yellow,
    ratsit_search, RATSIT_SCRAPER_URL, ENRICH_API_SECRET,
)


def test_health():
    url = RATSIT_SCRAPER_URL.rstrip("/") + "/health"
    print(f"\n{_bold('1. Health check')}")
    print(_dim(f"  GET {url}"))
    try:
        req = Request(url, headers={"User-Agent": "test"})
        with urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        if data.get("ok"):
            print(_green(f"  ✓ Scraper OK: {data.get('service', '?')} v{data.get('version', '?')}"))
            return True
        else:
            print(_red(f"  ✗ Scraper svarade men ok=false: {data}"))
            return False
    except Exception as e:
        print(_red(f"  ✗ Kan inte nå scrapern: {e}"))
        print(_dim(f"  Kör scrapern lokalt: cd rats_meri_docker_scraper && npm start"))
        print(_dim(f"  Eller sätt RATSIT_SCRAPER_URL i .env till Render-URL:en."))
        return False


def test_search(fornamn: str, efternamn: str, stad: str):
    print(f"\n{_bold('2. Namnsökning')}")
    query_parts = [f"fornamn={fornamn}" if fornamn else "",
                   f"efternamn={efternamn}" if efternamn else "",
                   f"stad={stad}" if stad else ""]
    print(_dim(f"  POST /search  {', '.join(p for p in query_parts if p)}"))

    result = ratsit_search(fornamn=fornamn, efternamn=efternamn, stad=stad)

    if result.get("error"):
        print(_red(f"  ✗ Fel: {result['error']}"))
        return

    hits = result.get("hits", [])
    total = result.get("totalCount", 0)
    print(_green(f"  ✓ {len(hits)} träffar (totalt {total})"))

    for i, h in enumerate(hits[:5], 1):
        pnr_tag = _green("PNR ✓") if h.get("personnummer") else _yellow("PNR ?")
        name = h.get("name", "?")
        age = h.get("age", "?")
        city = h.get("city", "?")
        street = h.get("streetAddress", "")
        apt = h.get("apartmentNumber", "")
        pnr = h.get("personnummer", "")

        print(f"\n  {_bold(str(i))}. {name} ({age} år, {city})  [{pnr_tag}]")
        if street:
            addr = street
            if apt:
                addr += f" lgh {apt}"
            print(f"     Adress: {addr}")
        if pnr:
            print(f"     PNR:    {_cyan(pnr)}")

    if len(hits) > 5:
        print(_dim(f"\n  ... och {len(hits) - 5} fler."))

    print(f"\n{_bold('Rå JSON (första träffen):')}")
    if hits:
        print(json.dumps(hits[0], indent=2, ensure_ascii=False))


def main():
    p = argparse.ArgumentParser(description="Testa Ratsit-scraper sökning.")
    p.add_argument("namn", nargs="*", help="Förnamn [Efternamn] att söka.")
    p.add_argument("--city", default="", help="Begränsa till stad.")
    a = p.parse_args()

    print(_bold("Ratsit-scraper test"))
    print(_dim(f"  URL:    {RATSIT_SCRAPER_URL}"))
    print(_dim(f"  Secret: {'✓ satt' if ENRICH_API_SECRET else '(ej satt)'}"))

    if not test_health():
        return 1

    if a.namn:
        if len(a.namn) == 1:
            parts = a.namn[0].split()
            if len(parts) >= 2:
                fornamn, efternamn = " ".join(parts[:-1]), parts[-1]
            else:
                fornamn, efternamn = "", parts[0]
        else:
            fornamn, efternamn = a.namn[0], a.namn[-1]
    else:
        fornamn = input("Förnamn (Enter för att hoppa över): ").strip()
        efternamn = input("Efternamn: ").strip()
        if not efternamn and not fornamn:
            print(_red("Inget namn angivet."))
            return 1

    test_search(fornamn, efternamn, a.city)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
