#!/usr/bin/env python3
"""
Fristaende PNR-uppslag via biluppgifter.se.

Anvandning:
    python pnr_lookup.py
    python pnr_lookup.py 19900101-1234
"""

from __future__ import annotations

import base64
import importlib
import re
import sys
from datetime import datetime

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


def split_name(full_name: str) -> tuple[str, str]:
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


def fetch_with_curl_cffi(url: str) -> str | None:
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
                raise RuntimeError("Ingen HTTP-respons mottogs från sidan.")
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


def parse_person(html: str, pnr_digits: str) -> dict[str, str | int] | None:
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
    age = int(age_match.group(1)) if age_match else 0

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
        "fornamn": first_name,
        "efternamn": last_name,
        "namn": full_name,
        "bostadsort": city,
        "alder": age,
        "adress": address,
    }


def print_result(person: dict[str, str | int]) -> None:
    print()
    print("Resultat")
    print("--------")
    print(f"Fornamn:    {person['fornamn']}")
    print(f"Efternamn:  {person['efternamn']}")
    print(f"Bostadsort: {person['bostadsort'] or 'Okand'}")
    print(f"Alder:      {person['alder'] or 'Okand'}")
    print(f"Adress:     {person['adress'] or 'Okand'}")
    print(f"PNR:        {person['pnr']}")


def main() -> int:
    print("Installera beroenden med: pip install -r requirements.txt")
    print("Om fallback behovs: playwright install chromium")

    raw_pnr = sys.argv[1] if len(sys.argv) > 1 else input("Ange personnummer: ").strip()
    if not raw_pnr:
        print("Inget personnummer angavs.")
        return 1

    try:
        normalized = normalize_pnr(raw_pnr)
        html = fetch_html(pnr_to_url(normalized))
        person = parse_person(html, normalized)
    except Exception as exc:
        print(f"Fel: {exc}")
        return 1

    if not person:
        print("Ingen person hittades for det angivna personnumret.")
        return 1

    print_result(person)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
