#!/usr/bin/env python3
"""
PNR lookup v7 — maximal auto-ifyllning från bara personnummer.

Flöde:
  1. PNR -> Biluppgifter.se  (namn, stad, gatuadress inkl. lgh-nr + postnr)
  2. Namn+stad -> Eniro person (telefon, fastighetsbeteckning, postnr, adress)
  3. Postnr -> PAP API (ort, kommun, län)
  4. Manuellt: ny adress, flyttdatum, e-post + övriga SKV-fält
  4b. Ny adress -> Eniro kart-API (boende → personsida → fastighet/ägare)
  5. Bygg slutpayload för flyttblanketten

Kör:
    python pnr_lookup_v7.py 19860324XXXX
    python pnr_lookup_v7.py 860324-XXXX
    python pnr_lookup_v7.py "860324 XXXX"
    python pnr_lookup_v7.py --dry-run 19860324XXXX
"""
from __future__ import annotations

import argparse
import json
import os
import re
import signal
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared import (  # noqa: E402
    _bold, _cyan, _dim, _green, _red, _yellow,
    _dphone, _nemail, _npostal, _normalize_date, _utc_now_iso, _CACHE_FIELDS,
    _guess_owner_name, _vdate, _vemail, _vphone, _vpostal_o, _vpostal_r,
    ask, biluppgifter_lookup, build_flyttio, build_skv, cache_get,
    cache_is_fresh, cache_put, CACHE_TTL_HOURS, eniro_address_lookup,
    eniro_company, eniro_fetch_address_property, eniro_person, format_pnr,
    guess_owner, make_cache, missing_req, normalize_pnr, pap, parse_address,
    yesno,
)

_SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_FILE = make_cache(_SCRIPT_DIR)


# -- Wizard --------------------------------------------------------------------

def run(raw_pnr: str, pap_key: str, eniro_key: str, skip_eniro: bool = False,
        use_cache: bool = False, dry_run: bool = False):
    pnr = normalize_pnr(raw_pnr)
    print(f"  Personnummer: {_bold(format_pnr(pnr))}")

    if dry_run:
        print(_yellow("\n  [DRY RUN] Visar vad som skulle hämtas:\n"))
        print(f"  1. Biluppgifter.se → namn, adress, stad (PNR: {format_pnr(pnr)})")
        print(f"  2. Eniro person    → telefon, fastighet, postnr  {'(hoppas över)' if skip_eniro else ''}")
        print(f"  3. PAP API         → ort, kommun, län            {'(ingen nyckel)' if not pap_key else ''}")
        print(f"  4. Manuell input   → ny adress, flyttdatum, e-post")
        print(f"  5. Eniro kart-API  → BRF/ägare, fastighetsbeteckning {'(hoppas över)' if skip_eniro else ''}")
        return {"generatedAt": _utc_now_iso(), "version": "v7", "status": "dry-run", "pnr": format_pnr(pnr)}

    lk: Dict[str, Any] = {
        "bil": None, "bilErr": None, "eniro": None, "eniroErr": None,
        "eniroCo": None, "eniroAddrResidents": None, "eniroAddrProperty": None,
        "eniroAddrErr": None, "papFrom": None, "papTo": None,
    }
    f: Dict[str, str] = {k: "" for k in (
        "personalNumber", "firstName", "lastName", "name",
        "fromStreet", "fromPostal", "fromCity",
        "toStreet", "toPostal", "toCity", "moveDate",
        "apartmentNumber", "propertyDesignation", "propertyOwner",
        "phone", "email", "period", "fastighet",
    )}
    f["personalNumber"] = pnr
    f["period"] = "true"

    cached: Dict[str, str] = {}
    cache_fresh = False
    if use_cache:
        cached = cache_get(CACHE_FILE, pnr)
        for ck in _CACHE_FIELDS:
            if cached.get(ck) and not f.get(ck):
                f[ck] = cached[ck]
        cache_fresh = bool(cached.get("phone") and cache_is_fresh(cached))
        if cached:
            visible = ", ".join(f"{k}={v}" for k, v in cached.items() if k != "updated" and v)
            if visible:
                print(_dim(f"  (Cache: {visible})"))

    # ══ FAS 1: Automatiska uppslag ════════════════════════════════════════════

    print(f"\n{_bold('[1]')} Biluppgifter.se — PNR-uppslag")
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
            print(_green(f"  ✓ {person['name']} ({person.get('fromCity', '?')})"))
            if addr["apt"]:
                print(_green(f"  ✓ Lgh-nr: {addr['apt']}"))
        else:
            print(_yellow("  — Ingen träff."))
    except Exception as e:
        lk["bilErr"] = str(e)
        print(_red(f"  ✗ Fel: {e}"))

    if skip_eniro:
        print(f"\n{_bold('[2]')} Eniro — {_dim('hoppas över (--skip-eniro)')}")
    elif not f["name"]:
        print(f"\n{_bold('[2]')} Eniro — {_dim('hoppas över (inget namn)')}")
    elif cache_fresh:
        print(f"\n{_bold('[2]')} Eniro — {_dim(f'hoppas över (cache < {CACHE_TTL_HOURS}h)')}")
    else:
        print(f"\n{_bold('[2]')} Eniro — personberikning")
        print(_dim(f"  Söker: {f['name']} {f['fromCity']}".strip()))
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
                print(_green(f"  ✓ {', '.join(got)}") if got else _yellow("  — Person hittad men inga nya fält."))
                cache_put(CACHE_FILE, pnr, {k: f.get(k, "") for k in _CACHE_FIELDS})
            else:
                print(_yellow("  — Ingen träff (personen saknas i Eniro)."))
        except Exception as e:
            lk["eniroErr"] = str(e)
            print(_red(f"  ✗ Fel: {e}"))

    if eniro_key and f["fromStreet"] and f["fromCity"]:
        print(f"\n{_bold('[2b]')} Eniro företagssök (nuv. adress)")
        companies = eniro_company(f["fromStreet"], f["fromCity"], eniro_key)
        lk["eniroCo"] = companies
        owner = guess_owner(companies, f["fromStreet"])
        if owner:
            print(_green(f"  ✓ Möjlig ägare: {owner}"))
        elif companies:
            print(_yellow(f"  — {len(companies)} företag, ingen tydlig ägare."))
        else:
            print(_yellow("  — Inga företag hittades."))

    if pap_key and f["fromPostal"]:
        p = pap(f["fromPostal"], pap_key)
        lk["papFrom"] = p
        if p and p.get("city") and not f["fromCity"]:
            f["fromCity"] = p["city"]
            print(_green(f"  ✓ PAP: fromCity → {p['city']}"))

    # ══ FAS 2: Sammanfattning + komplettering ═════════════════════════════════

    print(f"\n{'─' * 50}")
    print(_bold("  Auto-ifyllt från PNR:"))
    print(f"    Namn:       {_green(f['name']) if f['name'] else _yellow('?')}")
    print(f"    Adress:     {f['fromStreet'] or '?'}, {f['fromPostal'] or '?'} {f['fromCity'] or '?'}")
    if f["apartmentNumber"]:
        print(f"    Lgh-nr:     {f['apartmentNumber']}")
    if f["phone"]:
        print(f"    Telefon:    {f['phone']}")
    if f["fastighet"]:
        print(f"    Fastighet:  {f['fastighet']} (nuv.adr)")
    print(f"{'─' * 50}")

    if not f["firstName"] or not f["lastName"]:
        f["firstName"] = ask("Förnamn", f["firstName"], req=True)
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
            print(_green(f"  ✓ PAP: → {f['fromCity']}"))
    if not f["fromCity"]:
        f["fromCity"] = ask("Nuvarande ort", req=True)

    # ══ FAS 3: Ny adress + auto-uppslag ══════════════════════════════════════

    print(_bold("\n  Ange den NYA adressen:"))
    f["toStreet"] = ask("  Ny gatuadress", f["toStreet"], req=True)
    while True:
        f["toPostal"] = ask("  Nytt postnr", f["toPostal"], norm=_npostal, val=_vpostal_o)
        pt = pap(f["toPostal"], pap_key) if f["toPostal"] and pap_key else None
        if pt:
            lk["papTo"] = pt
        suggested_city = f["toCity"] or (pt["city"] if pt and pt.get("city") else "")
        if pt and pt.get("city") and not f["toCity"]:
            print(_green(f"  ✓ PAP: → {pt['city']}"))
        f["toCity"] = ask("  Ny ort", suggested_city)
        if not f["toPostal"] and f["toCity"]:
            print(_yellow("  Postnr krävs."))
            f["toPostal"] = ask("  Nytt postnr", req=True, norm=_npostal, val=_vpostal_r)
        if not f["toCity"] and f["toPostal"]:
            pt = pap(f["toPostal"], pap_key) if pap_key else None
            if pt and pt.get("city"):
                f["toCity"] = pt["city"]
                print(_green(f"  ✓ PAP: → {f['toCity']}"))
            else:
                f["toCity"] = ask("  Ny ort", req=True)
        if f["toPostal"] and f["toCity"]:
            break
        print(_yellow("  Både postnr och ort behövs."))

    f["moveDate"] = ask("  Inflyttningsdatum (YYYY-MM-DD)", f["moveDate"], req=True,
                        norm=_normalize_date, val=_vdate)

    print(f"\n{_bold('[3]')} Eniro adress-uppslag (ny adress)")
    if skip_eniro:
        print(_dim("  Hoppar över (--skip-eniro)."))
    else:
        print(_dim(f"  Söker företag + boende på {f['toStreet']}, {f['toPostal']} {f['toCity']}..."))
        try:
            map_data = eniro_address_lookup(f["toStreet"], f["toPostal"], f["toCity"])
            residents = map_data["residents"]
            map_companies = map_data["companies"]
            lk["eniroAddrResidents"] = residents
            lk["eniroAddrCompanies"] = map_companies
            if map_companies:
                print(_green(f"  ✓ {len(map_companies)} företag på adressen."))
                owner_from_companies = _guess_owner_name(map_companies)
                if owner_from_companies:
                    f["propertyOwner"] = owner_from_companies
                    print(_green(f"  ✓ Fastighetsägare: {owner_from_companies}"))
                else:
                    print(_yellow(f"  — Ingen BRF/fastighetsbolag bland: {', '.join(map_companies[:5])}"))
            else:
                print(_yellow("  — Inga företag hittades på adressen."))
            if residents:
                first = residents[0]
                rname = first.get("name", "") or first.get("url", "")
                print(_dim(f"  Hämtar personsida för {rname}..."))
                addr_property = eniro_fetch_address_property(first)
                lk["eniroAddrProperty"] = addr_property
                if addr_property:
                    if addr_property.get("fastighet") and not f["propertyDesignation"]:
                        f["propertyDesignation"] = addr_property["fastighet"]
                    if addr_property.get("propertyOwnerGuess") and not f["propertyOwner"]:
                        f["propertyOwner"] = addr_property["propertyOwnerGuess"]
                    if addr_property.get("fastighet"):
                        print(_green(f"  ✓ Fastighetsbeteckning: {addr_property['fastighet']}"))
                    else:
                        print(_yellow("  — Ingen fastighetsbeteckning synlig på personsidan."))
                else:
                    print(_yellow("  — Kunde inte läsa personsidan för vald boende."))
            else:
                print(_yellow("  — Inga boende hittades på adressen."))
        except Exception as e:
            lk["eniroAddrErr"] = str(e)
            print(_red(f"  ✗ Fel: {e}"))

    # ══ FAS 4: Komplettera resterande tomma fält ═════════════════════════════

    remaining: List[Tuple[str, str, Optional[Any], Optional[Any]]] = []
    if not f["phone"]:
        remaining.append(("phone", "Telefonnummer", _dphone, _vphone))
    if not f["email"]:
        remaining.append(("email", "E-post", _nemail, _vemail))
    if not f["propertyDesignation"]:
        current_fastighet = (lk.get("eniro") or {}).get("fastighet", "") or f.get("fastighet", "")
        if current_fastighet:
            print(_dim(f"  Tips: '{current_fastighet}' är fastighetsbeteckning för nuvarande adress."))
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
            print(_dim(f"  Tips: '{owner_hint}' hittades på adressen."))
        remaining.append(("propertyOwner", "Fastighetsägare (t.ex. 'egen' eller hyresvärd)", None, None))

    if remaining:
        print(f"\n  {_yellow(f'{len(remaining)} fält kvar att fylla i:')}")
        for key, label, norm, val in remaining:
            f[key] = ask(f"  {label}", f[key], norm=norm, val=val)

    if not yesno("  Period = 'Tills vidare'?"):
        f["period"] = "false"

    cache_put(CACHE_FILE, pnr, {k: f.get(k, "") for k in _CACHE_FIELDS})

    flio = build_flyttio(f)
    skv = build_skv(f)
    miss = missing_req(skv)
    diag = []
    if not lk.get("eniro") and not skip_eniro and not cache_fresh:
        diag.append("Eniro: personen saknas i registret.")
    if not lk.get("eniroAddrResidents") and not skip_eniro:
        diag.append("Eniro adress: hittade inga boende på nya adressen.")
    if not f.get("phone"):
        diag.append("Telefon: ingen källa levererade det automatiskt.")
    if not f.get("email"):
        diag.append("E-post: kan aldrig hämtas automatiskt.")

    return {
        "generatedAt": _utc_now_iso(), "version": "v7",
        "entryMethod": "personnummer",
        "status": "complete" if not miss else "partial",
        "lookups": lk, "flyttioPayload": flio, "skvPayload": skv,
        "requiredMissing": miss, "diagnostics": diag,
    }


# -- Output --------------------------------------------------------------------

def show(r):
    s = r["skvPayload"]
    lookups = r.get("lookups") or {}
    en = lookups.get("eniro") or {}
    en_addr = lookups.get("eniroAddrProperty") or {}
    residents = lookups.get("eniroAddrResidents") or []
    print(f"\n{'═' * 60}")
    print(_bold("  RESULTAT (v7)"))
    print(f"{'═' * 60}")
    status_color = _green if r["status"] == "complete" else _yellow
    print(f"  Status:     {status_color(r['status'])}")
    print(f"  Namn:       {s.get('name', '')}")
    print(f"  PNR:        {s.get('personalNumber', '')}")
    print(f"  Ny adress:  {s.get('gatuadress', '')}, {s.get('postnummer', '')} {s.get('postort', '')}")
    print(f"  Lgh-nr:     {s.get('lagenhetsnummer', '') or _dim('(ej)')}")
    print(f"  Datum:      {s.get('inflyttningsdatum', '')}")
    print(f"  Telefon:    {s.get('telefonnummer', '') or _dim('(saknas)')}")
    print(f"  E-post:     {s.get('email', '') or _dim('(saknas)')}")
    print(f"  Fast.bet:   {s.get('fastighetsbeteckning', '') or _dim('(ej)')}")
    print(f"  Fast.ägare: {s.get('fastighetsagare', '') or _dim('(ej)')}")
    if en:
        ex = [f"tel={en['telephone']}" if en.get("telephone") else None,
              f"fast={en['fastighet']}" if en.get("fastighet") else None]
        ex = [x for x in ex if x]
        if ex:
            print(f"\n  Eniro (nuv.adr): {', '.join(ex)}")
    map_cos = lookups.get("eniroAddrCompanies") or []
    addr_parts = [f"boende={len(residents)}" if residents else None,
                  f"företag={len(map_cos)}" if map_cos else None,
                  f"fast={en_addr['fastighet']}" if en_addr.get("fastighet") else None]
    addr_parts = [x for x in addr_parts if x]
    if addr_parts:
        print(f"  Eniro (ny adr):   {', '.join(addr_parts)}")
    if r.get("requiredMissing"):
        print(_red(f"\n  SAKNAS: {', '.join(r['requiredMissing'])}"))
    else:
        print(_green("\n  ✓ Alla krävda fält OK."))
    if r.get("diagnostics"):
        for d in r["diagnostics"]:
            print(_yellow(f"  ! {d}"))
    print(f"{'═' * 60}")


# -- CLI -----------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(
        description="PNR lookup v7 — maximal auto-ifyllning från personnummer.",
        epilog="Accepterar personnummer med/utan bindestreck, mellanslag, etc.",
    )
    p.add_argument("personnummer", nargs="?",
                    help="Personnummer (valfritt format: 19860324XXXX, 860324-XXXX, etc.)")
    p.add_argument("--pap-api-key", default="")
    p.add_argument("--eniro-api-key", default="")
    p.add_argument("--skip-eniro", action="store_true", help="Hoppa över Eniro-uppslag.")
    p.add_argument("--cache", action="store_true", help="Använd lokal cache (hoppar över Eniro om < 48h).")
    p.add_argument("--dry-run", action="store_true", help="Visa vad som skulle hämtas utan att göra det.")
    p.add_argument("--out", default="", help="Sökväg för output-JSON.")
    a = p.parse_args()

    print(_bold("PNR lookup v7\n"))
    raw = a.personnummer or ask("Ange personnummer", req=True)
    if not raw:
        print(_red("Inget personnummer angivet."))
        return 1

    pk = (a.pap_api_key or os.environ.get("PAP_API_KEY", "")).strip()
    ek = (a.eniro_api_key or os.environ.get("ENIRO_API_KEY", "")).strip()

    def _cleanup(sig, frame):
        print(_yellow("\n\nAvbryter... (Ctrl+C)"))
        sys.exit(130)
    signal.signal(signal.SIGINT, _cleanup)

    try:
        result = run(raw, pk, ek, a.skip_eniro, use_cache=a.cache, dry_run=a.dry_run)
    except KeyboardInterrupt:
        print(_yellow("\n\nAvbrutet av användaren."))
        return 130
    except Exception as e:
        print(_red(f"\nFel: {e}"))
        return 1

    if a.dry_run:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0

    if a.out:
        out = Path(a.out).expanduser().resolve()
    else:
        pnr_clean = re.sub(r"\D", "", raw)[:12]
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out = _SCRIPT_DIR / f"pnr_lookup_{pnr_clean}_{ts}.json"
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    show(result)
    print(f"\n  JSON: {_cyan(str(out))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
