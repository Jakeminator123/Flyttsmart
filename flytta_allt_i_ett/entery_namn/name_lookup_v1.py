#!/usr/bin/env python3
"""
Namnuppslag v1 — auto-ifyllning med namn som startpunkt.

Flöde:
  1. Namn (+ valfri stad) -> Eniro personsök -> lista med träffar
  2. Användaren väljer rätt person -> birthDate (8 av 12 PNR-siffror)
  3. Ange de sista 4 siffrorna -> fullständigt PNR (Luhn-validerat)
  4. PNR -> Biluppgifter (adress, lgh-nr — bekräftar identitet)
  5. Resten: samma pipeline som PNR-skriptet (PAP, ny adress, Eniro karta)

Namnformat (alla fungerar):
    "Anna Karlsson"           → förnamn + efternamn
    "Anna Maria Karlsson"     → förnamn + mellannamn + efternamn
    "Karlsson"                → enbart efternamn (bredare sökning)
    "anna karlsson"           → gemener funkar
    "ANNA KARLSSON"           → versaler funkar

Kör:
    python name_lookup_v1.py "Anna Karlsson"
    python name_lookup_v1.py "Karlsson" --city Stockholm
    python name_lookup_v1.py --dry-run "Anna Karlsson"
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
    ask, biluppgifter_lookup, build_flyttio, build_skv,
    build_pnr_from_birthdate_and_suffix, cache_get, cache_is_fresh, cache_put,
    CACHE_TTL_HOURS, choose, eniro_address_lookup, eniro_company,
    eniro_fetch_address_property, eniro_person_list, format_pnr, guess_owner,
    make_cache, missing_req, normalize_pnr, pap, parse_address, ratsit_lookup,
    ratsit_search, split_name, yesno, eniro_person, eniro_company, guess_owner,
)

_SCRIPT_DIR = Path(__file__).resolve().parent
CACHE_FILE = make_cache(_SCRIPT_DIR)


# -- Name parsing --------------------------------------------------------------

def parse_name_input(raw: str) -> Dict[str, str]:
    """Parse flexible name input into structured parts.

    Returns dict with: raw, firstName, lastName, middleName, searchQuery.
    """
    clean = " ".join(raw.split()).strip()
    parts = clean.split()

    if not parts:
        return {"raw": "", "firstName": "", "lastName": "", "middleName": "", "searchQuery": ""}

    if len(parts) == 1:
        return {"raw": clean, "firstName": "", "lastName": parts[0],
                "middleName": "", "searchQuery": parts[0]}

    if len(parts) == 2:
        return {"raw": clean, "firstName": parts[0], "lastName": parts[1],
                "middleName": "", "searchQuery": clean}

    return {"raw": clean, "firstName": parts[0], "lastName": parts[-1],
            "middleName": " ".join(parts[1:-1]), "searchQuery": clean}


def _format_person_for_list(p: Dict[str, Any]) -> Dict[str, str]:
    """Flatten an Eniro person result for the choose() display."""
    name = p.get("name", "?")
    extras = []
    if p.get("city"):
        extras.append(p["city"])
    if p.get("street"):
        extras.append(p["street"])
    if p.get("birthDate"):
        extras.append(f"född {p['birthDate']}")
    if p.get("telephone"):
        extras.append(f"tel {p['telephone']}")
    return {"name": name, "detail": ", ".join(extras), "birthDate": p.get("birthDate", ""),
            "url": p.get("url", ""), **{k: p.get(k, "") for k in
            ("givenName", "familyName", "street", "postal", "city",
             "telephone", "fastighet", "propertyOwnerGuess")}}


# -- Wizard --------------------------------------------------------------------

def run(raw_name: str, city: str, pap_key: str, eniro_key: str,
        skip_eniro: bool = False, dry_run: bool = False):
    parsed = parse_name_input(raw_name)
    if not parsed["searchQuery"]:
        raise ValueError("Inget namn angivet.")

    print(f"  Söker: {_bold(parsed['searchQuery'])}")
    if city:
        print(f"  Stad:  {_bold(city)}")

    if dry_run:
        print(_yellow("\n  [DRY RUN] Visar vad som skulle hämtas:\n"))
        print(f"  1a. Ratsit-scraper   → '{parsed['searchQuery']}' {city} (PNR direkt)".strip())
        print(f"  1b. Eniro personsök  → fallback om Ratsit ej nåbar")
        print(f"  2.  Biluppgifter.se  → bekräfta identitet + adress")
        print(f"  3.  PAP API          → ort, kommun, län   {'(ingen nyckel)' if not pap_key else ''}")
        print(f"  4.  Manuell input    → ny adress, flyttdatum, e-post")
        print(f"  5.  Eniro kart-API   → BRF/ägare, fastighetsbeteckning")
        return {"generatedAt": _utc_now_iso(), "version": "name-v1",
                "status": "dry-run", "searchQuery": parsed["searchQuery"]}

    lk: Dict[str, Any] = {
        "ratsitSearch": None, "ratsitSearchErr": None,
        "eniroSearch": None, "eniroSearchErr": None, "selectedPerson": None,
        "bil": None, "bilErr": None, "eniroAddrResidents": None,
        "eniroAddrProperty": None, "eniroAddrErr": None,
        "eniroCo": None, "papFrom": None, "papTo": None,
    }
    f: Dict[str, str] = {k: "" for k in (
        "personalNumber", "firstName", "lastName", "name",
        "fromStreet", "fromPostal", "fromCity",
        "toStreet", "toPostal", "toCity", "moveDate",
        "apartmentNumber", "propertyDesignation", "propertyOwner",
        "phone", "email", "period", "fastighet",
    )}
    f["period"] = "true"
    if parsed["firstName"]:
        f["firstName"] = parsed["firstName"]
    if parsed["lastName"]:
        f["lastName"] = parsed["lastName"]

    person_found = False

    # ══ FAS 1a: Ratsit-scraper (ger PNR direkt) ═════════════════════════════

    print(f"\n{_bold('[1a]')} Ratsit — personsök")
    ratsit_query = parsed["searchQuery"]
    print(_dim(f"  Söker: {ratsit_query} {city}".strip()))

    try:
        ratsit_result = ratsit_search(
            fornamn=ratsit_query,
            stad=city,
        )
        hits = ratsit_result.get("hits") or []
        lk["ratsitSearch"] = ratsit_result

        if hits:
            print(_green(f"  ✓ {len(hits)} träff(ar) ({ratsit_result.get('totalCount', '?')} totalt)"))

            display_hits = []
            for h in hits:
                parts = [h.get("city", ""), h.get("streetAddress", "")]
                if h.get("age"):
                    parts.append(f"{h['age']} år")
                if h.get("personnummer"):
                    parts.append(f"PNR: {h['personnummer']}")
                display_hits.append({
                    "name": h.get("name", "?"),
                    "detail": ", ".join(p for p in parts if p),
                    "_raw": h,
                })
            selected = choose("  Vilken person?", display_hits)
            if selected:
                person_found = True
                hit = selected.get("_raw", selected)
                lk["selectedPerson"] = hit
                f["name"] = hit.get("name", "")
                f["firstName"] = hit.get("firstName", "") or parsed["firstName"]
                f["lastName"] = hit.get("lastName", "") or parsed["lastName"]
                if hit.get("city"):
                    f["fromCity"] = hit["city"]
                if hit.get("personnummer"):
                    try:
                        pnr = normalize_pnr(hit["personnummer"])
                        f["personalNumber"] = pnr
                        print(_green(f"  ✓ PNR från Ratsit: {format_pnr(pnr)}"))
                    except ValueError:
                        pass

                if hit.get("streetAddress"):
                    addr = parse_address(hit["streetAddress"])
                    f["fromStreet"] = addr["street"] or hit["streetAddress"]
                    if addr["apt"] and not f["apartmentNumber"]:
                        f["apartmentNumber"] = addr["apt"]
                    if addr["postal"] and not f["fromPostal"]:
                        f["fromPostal"] = addr["postal"]
                if hit.get("apartmentNumber") and not f["apartmentNumber"]:
                    f["apartmentNumber"] = str(hit["apartmentNumber"]).strip()

                print(f"\n  {_green('Vald:')} {_bold(f['name'])}")
                if f["fromStreet"]:
                    print(f"    Adress:   {f['fromStreet']}, {f['fromCity']}")
                if f["apartmentNumber"]:
                    print(f"    Lgh-nr:   {f['apartmentNumber']}")
        else:
            if ratsit_result.get("error"):
                print(_yellow(f"  — Ratsit-scraper ej nåbar: {ratsit_result['error']}"))
            else:
                print(_yellow("  — Inga träffar i Ratsit."))

    except KeyboardInterrupt:
        raise
    except Exception as e:
        lk["ratsitSearchErr"] = str(e)
        print(_yellow(f"  — Ratsit-scraper: {e}"))

    # ══ FAS 1b: Eniro fallback (om Ratsit inte hittade) ═════════════════════

    if not person_found and not skip_eniro:
        print(f"\n{_bold('[1b]')} Eniro — personsök (fallback)")
        print(_dim(f"  Söker: {parsed['searchQuery']} {city}".strip()))

        try:
            persons = eniro_person_list(parsed["searchQuery"], city, mx=8)
            lk["eniroSearch"] = persons
            if persons:
                print(_green(f"  ✓ {len(persons)} träff(ar)"))
                display_list = [_format_person_for_list(p) for p in persons]
                selected = choose("  Vilken person?", display_list)
                if selected:
                    person_found = True
                    idx = display_list.index(selected)
                    person_data = persons[idx]
                    lk["selectedPerson"] = person_data
                    f["name"] = person_data.get("name", "")
                    f["firstName"] = person_data.get("givenName", "") or parsed["firstName"]
                    f["lastName"] = person_data.get("familyName", "") or parsed["lastName"]
                    if person_data.get("telephone"):
                        f["phone"] = _dphone(person_data["telephone"])
                    if person_data.get("street"):
                        f["fromStreet"] = person_data["street"]
                    if person_data.get("postal"):
                        f["fromPostal"] = _npostal(person_data["postal"])
                    if person_data.get("city"):
                        f["fromCity"] = person_data["city"]
                    if person_data.get("fastighet"):
                        f["fastighet"] = person_data["fastighet"]
                    print(f"\n  {_green('Vald:')} {_bold(f['name'])}")
                    if f["fromStreet"]:
                        print(f"    Adress:   {f['fromStreet']}, {f['fromPostal']} {f['fromCity']}")
            else:
                print(_yellow("  — Inga träffar i Eniro heller."))
        except KeyboardInterrupt:
            raise
        except Exception as e:
            lk["eniroSearchErr"] = str(e)
            print(_red(f"  ✗ Fel: {e}"))

    if not person_found:
        print(_dim("\n  Ingen källa hittade personen. Fyll i manuellt:"))
        f["name"] = ask("Fullständigt namn", parsed["searchQuery"], req=True)
        fn, ln = split_name(f["name"])
        f["firstName"] = fn
        f["lastName"] = ln

    # ══ FAS 2: PNR (fråga bara om Ratsit inte redan gav det) ════════════════

    if not f["personalNumber"]:
        print(f"\n{_bold('[2]')} Personnummer")

        birth_date = (lk.get("selectedPerson") or {}).get("birthDate", "")

        if birth_date:
            bd_digits = re.sub(r"\D", "", birth_date)
            print(f"  Födelsedatum: {_bold(birth_date)} (= {bd_digits[:8]} i PNR)")
            print(_dim("  Ange de sista 4 siffrorna för att låsa upp personnumret."))

            while True:
                suffix = ask("  Sista 4 siffror i personnumret", req=True)
                suffix_clean = re.sub(r"\D", "", suffix)
                if len(suffix_clean) != 4:
                    print(_red(f"  → Förväntar 4 siffror, fick {len(suffix_clean)}."))
                    continue
                try:
                    pnr = build_pnr_from_birthdate_and_suffix(birth_date, suffix_clean)
                    f["personalNumber"] = pnr
                    print(_green(f"  ✓ Personnummer: {format_pnr(pnr)}"))
                    break
                except ValueError as e:
                    print(_red(f"  → {e}"))
        else:
            print(_dim("  Ange fullständigt personnummer."))
            while True:
                raw_pnr = ask("  Personnummer (valfritt format)", req=True)
                try:
                    pnr = normalize_pnr(raw_pnr)
                    f["personalNumber"] = pnr
                    print(_green(f"  ✓ Personnummer: {format_pnr(pnr)}"))
                    break
                except ValueError as e:
                    print(_red(f"  → {e}"))

    # ══ FAS 2b: Ratsit /lookup berikning (medboende, fordon, lönedata) ══════

    if f["personalNumber"]:
        print(f"\n{_bold('[2b]')} Ratsit — fullständig berikning")
        print(_dim(f"  /lookup {format_pnr(f['personalNumber'])}"))
        try:
            rl = ratsit_lookup(format_pnr(f["personalNumber"]))
            lk["ratsitLookup"] = rl
            if rl:
                got = []
                medboende = rl.get("medboende") or []
                if medboende:
                    names = [m.get("name", "?") for m in medboende[:5]]
                    f["_medboende"] = ", ".join(names)
                    got.append(f"medboende: {len(medboende)} st")
                fordon = rl.get("fordonAdress") or []
                if fordon:
                    f["_fordon"] = ", ".join(
                        f"{v.get('make', '')} {v.get('model', '')}".strip() or v.get("regNr", "?")
                        for v in fordon[:3]
                    )
                    got.append(f"fordon: {len(fordon)}")
                if rl.get("snittLonGata"):
                    f["_snittLon"] = str(rl["snittLonGata"])
                    got.append(f"snittlön gata: {rl['snittLonGata']:,} kr".replace(",", " "))
                if rl.get("anmarkningProcent"):
                    f["_anmProcent"] = str(rl["anmarkningProcent"])
                    got.append(f"anmärkningar: {rl['anmarkningProcent']}%")
                if got:
                    print(_green(f"  ✓ {', '.join(got)}"))
                else:
                    print(_dim("  — Inga extra fält."))
            else:
                print(_yellow("  — Ingen data från /lookup."))
        except Exception as e:
            print(_dim(f"  — Ratsit lookup: {e}"))

    # ══ FAS 2c: Eniro JSON-LD berikning (telefon, postnr, fastighet) ══════

    if f["name"] and not skip_eniro:
        print(f"\n{_bold('[2b]')} Eniro — personberikning (JSON-LD)")

        en: Optional[Dict[str, Any]] = None

        # Strategi 1: sök på namn
        print(_dim(f"  Söker: {f['name']} {f['fromCity']}".strip()))
        try:
            en = eniro_person(f["name"], f["fromCity"], f["fromStreet"])
        except Exception:
            pass

        # Strategi 2: sök på PNR (Eniro accepterar personnummer som sökterm)
        if not en and f["personalNumber"]:
            pnr_query = format_pnr(f["personalNumber"])
            print(_dim(f"  Namn gav inget — provar PNR: {pnr_query}"))
            try:
                pnr_hits = eniro_person_list(pnr_query, "", mx=3)
                if pnr_hits:
                    en = pnr_hits[0]
            except Exception:
                pass

        lk["eniroEnrich"] = en
        if en:
            got = []
            if en.get("telephone") and not f["phone"]:
                f["phone"] = _dphone(en["telephone"])
                got.append(f"tel: {en['telephone']}")
            if en.get("fastighet") and not f["fastighet"]:
                f["fastighet"] = en["fastighet"]
                got.append(f"fastighet: {en['fastighet']}")
            if en.get("postal") and not f["fromPostal"]:
                f["fromPostal"] = _npostal(en["postal"])
                got.append(f"postnr: {en['postal']}")
            if en.get("birthDate"):
                got.append(f"född: {en['birthDate']}")
            if got:
                print(_green(f"  ✓ {', '.join(got)}"))
            else:
                print(_dim("  — Person hittad men inga nya fält."))
        else:
            print(_yellow("  — Personen saknas i Eniro (varken namn eller PNR)."))

    # ══ FAS 2d: Eniro företagssök (nuvarande adress → ägare) ════════════════

    eniro_key = os.environ.get("ENIRO_API_KEY", "")
    if eniro_key and f["fromStreet"] and f["fromCity"]:
        print(f"\n{_bold('[2d]')} Eniro — företagssök (nuv. adress)")
        companies = eniro_company(f["fromStreet"], f["fromCity"], eniro_key)
        lk["eniroCo"] = companies
        owner = guess_owner(companies, f["fromStreet"])
        if owner:
            print(_green(f"  ✓ Möjlig ägare (nuv. adress): {owner}"))
        elif companies:
            print(_yellow(f"  — {len(companies)} företag, ingen tydlig ägare."))
        else:
            print(_dim("  — Inga företag hittades."))

    # ══ FAS 3: Biluppgifter-berikning (bekräftar identitet) ══════════════════

    print(f"\n{_bold('[3]')} Biluppgifter.se — PNR-berikning")
    try:
        bil = biluppgifter_lookup(f["personalNumber"])
        lk["bil"] = bil
        if bil:
            if not f["name"]:
                f["name"] = bil.get("name", "")
            if not f["firstName"]:
                f["firstName"] = bil.get("firstName", "")
            if not f["lastName"]:
                f["lastName"] = bil.get("lastName", "")
            if not f["fromCity"]:
                f["fromCity"] = bil.get("fromCity", "")
            addr = parse_address(bil.get("fromStreetRaw", ""))
            if not f["fromStreet"] and addr["street"]:
                f["fromStreet"] = addr["street"]
            if not f["fromPostal"] and addr["postal"]:
                f["fromPostal"] = addr["postal"]
            if addr["city"] and not f["fromCity"]:
                f["fromCity"] = addr["city"]
            if addr["apt"] and not f["apartmentNumber"]:
                f["apartmentNumber"] = addr["apt"]

            bil_name = bil.get("name", "?")
            name_match = set(f["name"].lower().split()) & set(bil_name.lower().split())
            if name_match:
                print(_green(f"  ✓ Bekräftad: {bil_name} ({bil.get('fromCity', '?')})"))
            else:
                print(_yellow(f"  ⚠ Biluppgifter gav: {bil_name} — matchar inte '{f['name']}'"))
                if not yesno("  Fortsätta ändå?"):
                    raise ValueError("Avbruten av användaren (namnmismatch).")
            if f["apartmentNumber"]:
                print(_green(f"  ✓ Lgh-nr: {f['apartmentNumber']}"))
        else:
            print(_yellow("  — Ingen träff i Biluppgifter."))
    except KeyboardInterrupt:
        raise
    except ValueError:
        raise
    except Exception as e:
        lk["bilErr"] = str(e)
        print(_red(f"  ✗ Fel: {e}"))

    if pap_key and f["fromPostal"]:
        p = pap(f["fromPostal"], pap_key)
        lk["papFrom"] = p
        if p and p.get("city") and not f["fromCity"]:
            f["fromCity"] = p["city"]
            print(_green(f"  ✓ PAP: fromCity → {p['city']}"))

    # ══ FAS 4: Sammanfattning + komplettering ═════════════════════════════════

    print(f"\n{'─' * 50}")
    print(_bold("  Summering (namn + PNR):"))
    print(f"    Namn:       {_green(f['name']) if f['name'] else _yellow('?')}")
    print(f"    PNR:        {format_pnr(f['personalNumber'])}")
    print(f"    Adress:     {f['fromStreet'] or '?'}, {f['fromPostal'] or '?'} {f['fromCity'] or '?'}")
    if f["apartmentNumber"]:
        print(f"    Lgh-nr:     {f['apartmentNumber']}")
    if f["phone"]:
        print(f"    Telefon:    {f['phone']}")
    if f["fastighet"]:
        print(f"    Fastighet:  {f['fastighet']} (nuv.adr)")
    if f.get("_medboende"):
        print(f"    Medboende:  {f['_medboende']}")
    if f.get("_fordon"):
        print(f"    Fordon:     {f['_fordon']}")
    if f.get("_snittLon"):
        print(f"    Snittlön:   {int(f['_snittLon']):,} kr/år".replace(",", " "))
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

    # ══ FAS 5: Ny adress + auto-uppslag ══════════════════════════════════════

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

    print(f"\n{_bold('[5]')} Eniro adress-uppslag (ny adress)")
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
                        print(_yellow("  — Ingen fastighetsbeteckning synlig."))
                else:
                    print(_yellow("  — Kunde inte läsa personsidan."))
            else:
                print(_yellow("  — Inga boende hittades på adressen."))
        except Exception as e:
            lk["eniroAddrErr"] = str(e)
            print(_red(f"  ✗ Fel: {e}"))

    # ══ FAS 6: Komplettera resterande tomma fält ═════════════════════════════

    remaining: List[Tuple[str, str, Optional[Any], Optional[Any]]] = []
    if not f["phone"]:
        remaining.append(("phone", "Telefonnummer", _dphone, _vphone))
    if not f["email"]:
        remaining.append(("email", "E-post", _nemail, _vemail))
    if not f["propertyDesignation"]:
        current_fastighet = f.get("fastighet", "")
        if current_fastighet:
            print(_dim(f"  Tips: '{current_fastighet}' är fastighetsbeteckning för nuvarande adress."))
        remaining.append(("propertyDesignation", "Fastighetsbeteckning (ny adress)", None, None))
    if not f["propertyOwner"]:
        owner_hint = ""
        map_cos = lk.get("eniroAddrCompanies") or []
        if map_cos:
            owner_hint = _guess_owner_name(map_cos)
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

    cache_put(CACHE_FILE, f["personalNumber"], {k: f.get(k, "") for k in _CACHE_FIELDS})

    flio = build_flyttio(f)
    skv = build_skv(f)
    miss = missing_req(skv)
    diag = []
    if not lk.get("eniroSearch"):
        diag.append("Eniro: namn gav inga träffar — alla fält matades in manuellt.")
    if not lk.get("bil"):
        diag.append("Biluppgifter: kunde inte bekräfta identitet via PNR.")
    if not lk.get("eniroAddrResidents") and not skip_eniro:
        diag.append("Eniro adress: hittade inga boende på nya adressen.")
    if not f.get("phone"):
        diag.append("Telefon: ingen källa levererade det automatiskt.")
    if not f.get("email"):
        diag.append("E-post: kan aldrig hämtas automatiskt.")

    enrichment = {
        "generatedAt": _utc_now_iso(),
        "personnummer": f.get("personalNumber", ""),
        "searchQuery": parsed["searchQuery"],
    }
    rl = lk.get("ratsitLookup") or {}
    if rl.get("medboende"):
        enrichment["medboende"] = rl["medboende"]
    if rl.get("fordonAdress"):
        enrichment["fordon"] = rl["fordonAdress"]
    if rl.get("snittLonGata"):
        enrichment["snittLonGata"] = rl["snittLonGata"]
    if rl.get("anmarkningProcent"):
        enrichment["anmarkningProcent"] = rl["anmarkningProcent"]
    if rl.get("married") is not None:
        enrichment["gift"] = rl["married"]
    if rl.get("hasCompany") is not None:
        enrichment["harForetag"] = rl["hasCompany"]
    if rl.get("coordinates"):
        enrichment["koordinater"] = rl["coordinates"]
    if f.get("_medboende"):
        enrichment["medboendeNamn"] = f["_medboende"]
    if f.get("_fordon"):
        enrichment["fordonSummering"] = f["_fordon"]

    main_result = {
        "generatedAt": _utc_now_iso(), "version": "name-v1",
        "entryMethod": "name",
        "status": "complete" if not miss else "partial",
        "lookups": lk, "flyttioPayload": flio, "skvPayload": skv,
        "requiredMissing": miss, "diagnostics": diag,
    }

    return main_result, enrichment


# -- Output --------------------------------------------------------------------

def show(r):
    s = r["skvPayload"]
    lookups = r.get("lookups") or {}
    en_addr = lookups.get("eniroAddrProperty") or {}
    residents = lookups.get("eniroAddrResidents") or []
    print(f"\n{'═' * 60}")
    print(_bold("  RESULTAT (namn-v1)"))
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
        description="Namnuppslag v1 — auto-ifyllning med namn som startpunkt.",
        epilog='Accepterar: "Anna Karlsson", "Karlsson", "Anna Maria Karlsson"',
    )
    p.add_argument("namn", nargs="?", help="Namn att söka (för-/efternamn, bara efternamn, etc.)")
    p.add_argument("--city", default="", help="Begränsa sökningen till en stad.")
    p.add_argument("--pap-api-key", default="")
    p.add_argument("--eniro-api-key", default="")
    p.add_argument("--skip-eniro", action="store_true", help="Hoppa över Eniro adress-uppslag (ny adress).")
    p.add_argument("--dry-run", action="store_true", help="Visa vad som skulle hämtas utan att göra det.")
    p.add_argument("--out", default="", help="Sökväg för output-JSON.")
    a = p.parse_args()

    print(_bold("Namnuppslag v1\n"))
    raw = a.namn or ask("Ange namn (för- och/eller efternamn)", req=True)
    if not raw:
        print(_red("Inget namn angivet."))
        return 1

    city = a.city or ""
    if not city and not a.namn:
        city = ask("Stad (valfritt, Enter för att hoppa över)")

    pk = (a.pap_api_key or os.environ.get("PAP_API_KEY", "")).strip()
    ek = (a.eniro_api_key or os.environ.get("ENIRO_API_KEY", "")).strip()

    def _cleanup(sig, frame):
        print(_yellow("\n\nAvbryter... (Ctrl+C)"))
        sys.exit(130)
    signal.signal(signal.SIGINT, _cleanup)

    try:
        run_result = run(raw, city, pk, ek, skip_eniro=a.skip_eniro, dry_run=a.dry_run)
    except KeyboardInterrupt:
        print(_yellow("\n\nAvbrutet av användaren."))
        return 130
    except Exception as e:
        print(_red(f"\nFel: {e}"))
        return 1

    if a.dry_run:
        print(json.dumps(run_result, indent=2, ensure_ascii=False))
        return 0

    result, enrichment = run_result

    name_slug = re.sub(r"[^a-zA-ZåäöÅÄÖ]+", "_", raw.lower()).strip("_")[:30]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"name_lookup_{name_slug}_{ts}"

    if a.out:
        out = Path(a.out).expanduser().resolve()
        out_enrichment = out.with_name(out.stem + "_enrichment.json")
    else:
        out = _SCRIPT_DIR / f"{base_name}.json"
        out_enrichment = _SCRIPT_DIR / f"{base_name}_enrichment.json"

    out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    has_enrichment = any(k for k in enrichment if k not in ("generatedAt", "personnummer", "searchQuery"))
    if has_enrichment:
        out_enrichment.write_text(json.dumps(enrichment, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    show(result)
    print(f"\n  JSON:       {_cyan(str(out))}")
    if has_enrichment:
        print(f"  Berikning:  {_cyan(str(out_enrichment))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
