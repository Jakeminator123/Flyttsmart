#!/usr/bin/env python3
"""
PNR lookup v2 - stegvis datainsamling for slutlig flyttanmalan.

Mal:
1) Starta med personnummer.
2) Hamta sa mycket som mojligt automatiskt (namn + delar av nuvarande adress).
3) Fraga bara efter det som maste fyllas manuellt.
4) Bygg en slutpayload for blanketten.

Anvandning:
    python pnr_lookup_v2.py
    python pnr_lookup_v2.py 19900101-1234
    python pnr_lookup_v2.py 19900101-1234 --pap-api-key <KEY> --out out.json
"""

from __future__ import annotations

import argparse
import base64
import importlib
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

BASE_URL = "https://biluppgifter.se"
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
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
PAP_API_URL = "https://api.papapi.se/lite/"


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
    parts = [part for part in full_name.split() if part]
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


def pnr_to_url(pnr_digits: str) -> str:
    encoded = base64.b64encode(pnr_digits.encode()).decode()
    return f"{BASE_URL}/brukare/{encoded}/"


def is_blocked_response(status_code: int, html: str) -> bool:
    if status_code >= 400:
        return True
    lowered = html.lower()
    return any(phrase.lower() in lowered for phrase in BLOCKED_PHRASES)


def fetch_with_curl_cffi(url: str) -> Optional[str]:
    try:
        requests = importlib.import_module("curl_cffi.requests")
    except ImportError:
        return None

    response = requests.get(
        url,
        impersonate="chrome124",
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
        },
        timeout=25,
    )
    if is_blocked_response(response.status_code, response.text):
        return None
    return response.text


def fetch_with_playwright(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright saknas. Kor: pip install playwright && playwright install chromium"
        ) from exc

    block_patterns = [
        "**/*.{png,jpg,jpeg,gif,svg,ico,webp,avif}",
        "**/*.{css,woff,woff2,ttf,eot}",
        "**/api.pirsch.io/**",
        "**/fonts.googleapis.com/**",
        "**/fonts.gstatic.com/**",
        "**/www.googletagmanager.com/**",
        "**/www.google-analytics.com/**",
    ]

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=USER_AGENT,
                locale="sv-SE",
                extra_http_headers={"Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8"},
            )
            page = context.new_page()
            for pattern in block_patterns:
                page.route(pattern, lambda route: route.abort())
            response = page.goto(url, wait_until="domcontentloaded", timeout=25000)
            if response is None:
                raise RuntimeError("Ingen HTTP-respons mottogs fran sidan.")
            if response.status >= 400:
                raise RuntimeError(f"HTTP {response.status} fran biluppgifter.se")
            page.wait_for_timeout(1200)
            html = page.content()
            browser.close()
            return html
    except Exception as exc:
        raise RuntimeError(f"Playwright kunde inte hamta sidan: {exc}") from exc


def fetch_html(url: str) -> str:
    html = fetch_with_curl_cffi(url)
    if html:
        return html
    return fetch_with_playwright(url)


def parse_person(html: str, pnr_digits: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator=" ", strip=True)

    if any(phrase in text for phrase in NOT_FOUND_PHRASES):
        return None

    name_match = re.search(r"Visa\s+(.+?)\s+pa\s+Ratsit", text)
    if not name_match:
        name_match = re.search(r"Visa\s+(.+?)\s+på\s+Ratsit", text)
    if name_match:
        full_name = name_match.group(1).strip()
    else:
        fallback_match = re.search(
            r"([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ][a-zåäöA-ZÅÄÖ\-\s]{1,50}),\s+en\s+privatperson",
            text,
        )
        full_name = fallback_match.group(1).strip() if fallback_match else ""

    if not full_name:
        raise RuntimeError("Kunde inte tolka namn fran sidan.")

    first_name, last_name = split_name(full_name)

    age_match = re.search(r"(\d{1,3})\s+ar", text)
    if not age_match:
        age_match = re.search(r"(\d{1,3})\s+år", text)
    age = int(age_match.group(1)) if age_match else None

    city_match = re.search(
        r"bor\s+i\s+([A-ZÅÄÖ][a-zåäö]+(?:[\s-][A-ZÅÄÖ][a-zåäö]+)?)",
        text,
    )
    city = city_match.group(1).strip() if city_match else ""

    address_match = re.search(r"\bAdress\s+([^\n\r,]{3,80})", text)
    if address_match:
        address = address_match.group(1).strip()
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
    }


def normalize_postal(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def normalize_phone(value: str) -> str:
    return re.sub(r"[^\d+]", "", value or "")


def normalize_email(value: str) -> str:
    return (value or "").strip().lower()


def parse_address_guess(raw_address: str) -> Dict[str, str]:
    compact = " ".join((raw_address or "").split())
    out = {"fromStreet": "", "fromPostal": "", "fromCity": ""}
    if not compact:
        return out

    # Typical pattern: "Street 1, 11122 Stockholm"
    full_match = re.search(
        r"^(?P<street>.+?)[,\s]+(?P<postal>\d{3}\s?\d{2})\s+(?P<city>[A-Za-zÅÄÖåäö\-\s]+)$",
        compact,
    )
    if full_match:
        out["fromStreet"] = full_match.group("street").strip()
        out["fromPostal"] = normalize_postal(full_match.group("postal"))
        out["fromCity"] = full_match.group("city").strip()
        return out

    pieces = [piece.strip() for piece in compact.split(",") if piece.strip()]
    if pieces:
        out["fromStreet"] = pieces[0]

    postal_match = re.search(r"\b(\d{3}\s?\d{2})\b", compact)
    if postal_match:
        out["fromPostal"] = normalize_postal(postal_match.group(1))

    city_after_postal = re.search(
        r"\b\d{3}\s?\d{2}\s+([A-Za-zÅÄÖåäö\-\s]+)$", compact
    )
    if city_after_postal:
        out["fromCity"] = city_after_postal.group(1).strip()

    return out


def pap_lookup(postal_code: str, pap_api_key: str) -> Optional[Dict[str, str]]:
    clean = normalize_postal(postal_code)
    if not re.fullmatch(r"\d{5}", clean):
        return None
    if not pap_api_key.strip():
        return None

    params = urlencode(
        {
            "query": clean,
            "format": "json",
            "apikey": pap_api_key.strip(),
        }
    )
    req = Request(
        f"{PAP_API_URL}?{params}",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=8) as response:
            payload = response.read().decode("utf-8")
        data = json.loads(payload)
        item = (data.get("results") or [None])[0]
        if not item or not item.get("city"):
            return None
        return {
            "postalCode": clean,
            "city": str(item.get("city", "")).strip(),
            "municipality": str(item.get("county", "")).strip(),
            "county": str(item.get("state", "")).strip(),
            "latitude": str(item.get("latitude", "")).strip(),
            "longitude": str(item.get("longitude", "")).strip(),
            "source": "pap",
        }
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
        return None


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
    if not value:
        return True, ""
    return validate_postal_required(value)


def validate_email_optional(value: str) -> Tuple[bool, str]:
    if not value:
        return True, ""
    if re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
        return True, ""
    return False, "Ogiltig e-postadress."


def validate_phone_optional(value: str) -> Tuple[bool, str]:
    if not value:
        return True, ""
    digits = re.sub(r"[^\d]", "", value)
    if 8 <= len(digits) <= 15:
        return True, ""
    return False, "Telefonnummer bor vara 8-15 siffror."


def ask_text(
    label: str,
    default: str = "",
    required: bool = False,
    normalizer=None,
    validator=None,
) -> str:
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


def build_flyttio_payload(form: Dict[str, str]) -> Dict[str, str]:
    first_name = form.get("firstName", "").strip()
    last_name = form.get("lastName", "").strip()
    full_name = form.get("name", "").strip() or " ".join(
        part for part in [first_name, last_name] if part
    ).strip()

    return {
        "name": full_name,
        "firstName": first_name,
        "lastName": last_name,
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
    first_name = form.get("firstName", "").strip()
    last_name = form.get("lastName", "").strip()
    full_name = form.get("name", "").strip() or " ".join(
        part for part in [first_name, last_name] if part
    ).strip()

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
        "name": full_name,
        "personalNumber": form.get("personalNumber", "").strip(),
    }


def get_required_missing(skv_payload: Dict[str, str]) -> list[str]:
    required = [
        "inflyttningsdatum",
        "period",
        "gatuadress",
        "postnummer",
        "postort",
    ]
    return [field for field in required if not skv_payload.get(field, "").strip()]


def collect_destination_address(
    form: Dict[str, str],
    pap_api_key: str,
    lookups: Dict[str, Any],
) -> None:
    print("\nSteg 3/5 - Ny adress (obligatorisk for slutblankett)")
    form["toStreet"] = ask_text(
        "Ny gatuadress (toStreet)",
        default=form.get("toStreet", ""),
        required=True,
    )

    while True:
        form["toPostal"] = ask_text(
            "Nytt postnummer (toPostal)",
            default=form.get("toPostal", ""),
            required=False,
            normalizer=normalize_postal,
            validator=validate_postal_optional,
        )

        pap_to = None
        if form["toPostal"]:
            pap_to = pap_lookup(form["toPostal"], pap_api_key)
            lookups["toPostalPap"] = pap_to

        suggested_city = form.get("toCity", "")
        if pap_to and pap_to.get("city"):
            suggested_city = pap_to["city"]
            if not form.get("toCity"):
                print(f"  -> PAP: postnummer {form['toPostal']} gav ort {suggested_city}.")

        form["toCity"] = ask_text(
            "Ny ort (toCity)",
            default=suggested_city,
            required=False,
        )

        if not form["toPostal"] and form["toCity"]:
            print("  -> Postnummer saknas. Ange postnummer (krav for blanketten).")
            form["toPostal"] = ask_text(
                "Nytt postnummer (toPostal)",
                required=True,
                normalizer=normalize_postal,
                validator=validate_postal_required,
            )
            pap_to = pap_lookup(form["toPostal"], pap_api_key)
            lookups["toPostalPap"] = pap_to
            if pap_to and pap_to.get("city") and not form["toCity"]:
                form["toCity"] = pap_to["city"]

        if not form["toCity"] and form["toPostal"]:
            pap_to = pap_lookup(form["toPostal"], pap_api_key)
            lookups["toPostalPap"] = pap_to
            if pap_to and pap_to.get("city"):
                form["toCity"] = pap_to["city"]
                print(f"  -> PAP: satte toCity till {form['toCity']}.")
            else:
                form["toCity"] = ask_text("Ny ort (toCity)", required=True)

        if form["toPostal"] and form["toCity"]:
            break

        print("  -> Bade toPostal och toCity behovs for komplett slutblankett.")


def run_wizard(raw_pnr: str, pap_api_key: str) -> Dict[str, Any]:
    normalized_pnr = normalize_pnr(raw_pnr)
    lookups: Dict[str, Any] = {
        "personLookup": None,
        "personLookupError": None,
        "fromPostalPap": None,
        "toPostalPap": None,
    }

    print("\nSteg 1/5 - Personuppslag fran personnummer")
    try:
        html = fetch_html(pnr_to_url(normalized_pnr))
        person = parse_person(html, normalized_pnr)
        lookups["personLookup"] = person
        if person:
            print(f"  -> Hittade person: {person.get('name', 'okand')}")
        else:
            print("  -> Ingen person hittades, fortsatter manuellt.")
    except Exception as exc:
        lookups["personLookupError"] = str(exc)
        print(f"  -> Personuppslag misslyckades: {exc}")

    form: Dict[str, str] = {
        "personalNumber": normalized_pnr,
        "firstName": "",
        "lastName": "",
        "name": "",
        "fromStreet": "",
        "fromPostal": "",
        "fromCity": "",
        "toStreet": "",
        "toPostal": "",
        "toCity": "",
        "moveDate": "",
        "apartmentNumber": "",
        "propertyDesignation": "",
        "propertyOwner": "",
        "phone": "",
        "email": "",
        "period": "true",
    }

    person_lookup = lookups.get("personLookup")
    if person_lookup:
        form["firstName"] = str(person_lookup.get("firstName", "")).strip()
        form["lastName"] = str(person_lookup.get("lastName", "")).strip()
        form["name"] = str(person_lookup.get("name", "")).strip()
        form["fromCity"] = str(person_lookup.get("fromCity", "")).strip()

        guessed_address = parse_address_guess(
            str(person_lookup.get("fromStreetRaw", "")).strip()
        )
        form["fromStreet"] = guessed_address.get("fromStreet", "")
        form["fromPostal"] = guessed_address.get("fromPostal", "")
        if guessed_address.get("fromCity"):
            form["fromCity"] = guessed_address["fromCity"]

    print("\nSteg 2/5 - Bekrafta identitet och nuvarande adress")
    form["firstName"] = ask_text("Fornamn", default=form["firstName"], required=True)
    form["lastName"] = ask_text("Efternamn", default=form["lastName"], required=True)
    form["name"] = " ".join([form["firstName"], form["lastName"]]).strip()

    form["fromStreet"] = ask_text(
        "Nuvarande gatuadress (fromStreet)",
        default=form["fromStreet"],
        required=False,
    )
    form["fromPostal"] = ask_text(
        "Nuvarande postnummer (fromPostal)",
        default=form["fromPostal"],
        required=False,
        normalizer=normalize_postal,
        validator=validate_postal_optional,
    )

    if form["fromPostal"] and not form["fromCity"]:
        pap_from = pap_lookup(form["fromPostal"], pap_api_key)
        lookups["fromPostalPap"] = pap_from
        if pap_from and pap_from.get("city"):
            form["fromCity"] = pap_from["city"]
            print(f"  -> PAP: satte fromCity till {form['fromCity']}.")

    form["fromCity"] = ask_text(
        "Nuvarande ort (fromCity)",
        default=form["fromCity"],
        required=False,
    )

    collect_destination_address(form, pap_api_key, lookups)

    print("\nSteg 4/5 - Flyttdatum och kontakt")
    form["moveDate"] = ask_text(
        "Inflyttningsdatum (YYYY-MM-DD)",
        default=form["moveDate"],
        required=True,
        validator=validate_date,
    )
    form["phone"] = ask_text(
        "Telefonnummer (valfritt)",
        default=form["phone"],
        required=False,
        normalizer=normalize_phone,
        validator=validate_phone_optional,
    )
    form["email"] = ask_text(
        "E-post (valfritt)",
        default=form["email"],
        required=False,
        normalizer=normalize_email,
        validator=validate_email_optional,
    )

    print("\nSteg 5/5 - Ovriga blankettfalt")
    form["apartmentNumber"] = ask_text(
        "Lagenhetsnummer (valfritt/vid behov)",
        default=form["apartmentNumber"],
        required=False,
    )
    form["propertyDesignation"] = ask_text(
        "Fastighetsbeteckning (valfritt)",
        default=form["propertyDesignation"],
        required=False,
    )
    form["propertyOwner"] = ask_text(
        "Fastighetsagare (valfritt)",
        default=form["propertyOwner"],
        required=False,
    )

    if not ask_yes_no("Anvand period = 'Tills vidare'?", default_yes=True):
        form["period"] = "false"
        print("  -> OBS: period='false' ar satt, men de flesta floden anvander 'true'.")
    else:
        form["period"] = "true"

    flyttio_payload = build_flyttio_payload(form)
    skv_payload = build_skv_payload(form)
    missing = get_required_missing(skv_payload)

    return {
        "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "status": "complete" if not missing else "partial",
        "lookups": lookups,
        "flyttioPayload": flyttio_payload,
        "skvPayload": skv_payload,
        "requiredMissing": missing,
        "notes": [
            "PNR kan ge namn + delar av nuvarande adress, men inte hela flyttanmalan.",
            "Ny adress och flyttdatum maste normalt anges manuellt.",
        ],
    }


def print_summary(result: Dict[str, Any]) -> None:
    skv_payload = result["skvPayload"]
    print("\nResultat")
    print("--------")
    print(f"Status: {result['status']}")
    print(f"Namn:   {skv_payload.get('name', '')}")
    print(f"PNR:    {skv_payload.get('personalNumber', '')}")
    print(
        "Ny adress: "
        f"{skv_payload.get('gatuadress', '')}, "
        f"{skv_payload.get('postnummer', '')} {skv_payload.get('postort', '')}"
    )
    print(f"Flyttdatum: {skv_payload.get('inflyttningsdatum', '')}")
    if result.get("requiredMissing"):
        print("Saknade kravfalt: " + ", ".join(result["requiredMissing"]))
    else:
        print("Alla kravfalt for slutblanketten ar ifyllda.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PNR lookup v2 - samla slutdata for flyttanmalan."
    )
    parser.add_argument(
        "personnummer",
        nargs="?",
        help="Personnummer (10 eller 12 siffror, med eller utan separator).",
    )
    parser.add_argument(
        "--pap-api-key",
        default="",
        help="PAP API key for postnummer -> ort. Om tom anvands bara manuellt/stegvis fallback.",
    )
    parser.add_argument(
        "--out",
        default="",
        help="Sokvag till output-JSON. Default: flytta_allt_i_ett/pnr_lookup_v2_output.json",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    print("Installera beroenden med: pip install -r requirements.txt")
    print("Om fallback behovs: playwright install chromium")

    raw_pnr = args.personnummer or input("Ange personnummer: ").strip()
    if not raw_pnr:
        print("Inget personnummer angavs.")
        return 1

    pap_api_key = (args.pap_api_key or "").strip()
    if not pap_api_key:
        # Try env var if CLI argument is empty.
        pap_api_key = os.environ.get("PAP_API_KEY", "").strip()

    try:
        result = run_wizard(raw_pnr, pap_api_key)
    except Exception as exc:
        print(f"Fel: {exc}")
        return 1

    out_path = (
        Path(args.out).expanduser().resolve()
        if args.out
        else Path(__file__).resolve().parent / "pnr_lookup_v2_output.json"
    )
    out_path.write_text(
        json.dumps(result, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    print_summary(result)
    print(f"\nJSON sparad till: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

